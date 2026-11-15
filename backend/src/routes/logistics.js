import express from 'express';
import crypto from 'node:crypto';
import {
  Shipment,
  CONTAINER_SPECS,
  SHIPMENT_MILESTONES,
  EXPORT_DOCUMENT_TYPES,
  generateShipmentNumber,
  generateBookingReference
} from '../models/Shipment.js';
import { Order } from '../models/Order.js';
import { AggregationLot } from '../models/AggregationLot.js';
import { User } from '../models/User.js';
import { asyncHandler, ApiError } from '../middleware/http.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

function getContainerCapacity(type) {
  return CONTAINER_SPECS[type]?.maxCapacityKg || 29000;
}

/**
 * GET /api/logistics/shipments
 * List shipments with role-based filtering and status query parameters.
 */
router.get('/shipments', asyncHandler(async (req, res) => {
  const filter = {};

  if (req.user.role === 'buyer') {
    filter.buyer = req.user._id;
  } else if (req.user.role === 'farmer') {
    filter.exporter = req.user._id;
  }

  if (req.query.status) {
    filter.status = req.query.status;
  }
  if (req.query.shippingLine) {
    filter.shippingLine = new RegExp(req.query.shippingLine, 'i');
  }
  if (req.query.containerId) {
    filter.containerId = new RegExp(req.query.containerId, 'i');
  }
  if (req.query.destinationPort) {
    filter.destinationPort = new RegExp(req.query.destinationPort, 'i');
  }
  if (req.query.q) {
    const rx = new RegExp(req.query.q, 'i');
    filter.$or = [
      { shipmentNumber: rx },
      { bookingReference: rx },
      { containerId: rx },
      { cropName: rx },
      { destinationPort: rx },
      { vesselName: rx }
    ];
  }

  const shipments = await Shipment.find(filter)
    .populate('buyer', 'name email companyName country')
    .populate('exporter', 'name email')
    .populate('order', 'invoiceNumber totalInr paymentStatus')
    .populate('aggregationLot', 'lotId cropName grade totalQuantityKg')
    .sort('-createdAt')
    .limit(Number(req.query.limit) || 100);

  res.json({ count: shipments.length, shipments });
}));

/**
 * GET /api/logistics/shipments/:id
 * Retrieve details for a single shipment.
 */
router.get('/shipments/:id', asyncHandler(async (req, res) => {
  const query = req.params.id.startsWith('SHP-')
    ? { shipmentNumber: req.params.id.toUpperCase() }
    : req.params.id.startsWith('BK-')
    ? { bookingReference: req.params.id.toUpperCase() }
    : { _id: req.params.id };

  const shipment = await Shipment.findOne(query)
    .populate('buyer', 'name email companyName country verificationStatus')
    .populate('exporter', 'name email')
    .populate('order')
    .populate('aggregationLot');

  if (!shipment) throw new ApiError(404, 'Shipment not found');

  if (req.user.role === 'buyer' && String(shipment.buyer._id || shipment.buyer) !== String(req.user._id)) {
    throw new ApiError(403, 'Access denied to this shipment');
  }

  res.json({ shipment });
}));

/**
 * POST /api/logistics/shipments
 * Book and create an international agricultural shipment.
 * Strictly prevents container over-allocation.
 */
router.post('/shipments', asyncHandler(async (req, res) => {
  const {
    orderId,
    lotId,
    buyerId,
    cropName,
    grade = 'A',
    totalWeightKg,
    packageCount = 0,
    packageType = 'Export Ventilated Cartons',
    containerType = '40ft High Cube Reefer',
    containerId = '',
    sealNumber = '',
    allocatedWeightKg,
    temperatureSetpoint = 4.0,
    humiditySetpoint = 85,
    ventilationCmh = 15,
    shippingLine = 'Maersk Line',
    vesselName = 'Maersk Mc-Kinney',
    voyageNumber = '2611W',
    originPort = 'JNPT Mumbai (Nhava Sheva)',
    destinationPort,
    destinationCountry = '',
    departureDate,
    estimatedArrivalDate,
    notes = ''
  } = req.body || {};

  if (!cropName || !destinationPort) {
    throw new ApiError(400, 'cropName and destinationPort are required');
  }

  const weight = Number(allocatedWeightKg || totalWeightKg || 0);
  if (weight <= 0) {
    throw new ApiError(400, 'A valid positive cargo weight is required');
  }

  // Validate container capacity and prevent over-allocation
  const maxCap = getContainerCapacity(containerType);
  if (weight > maxCap) {
    throw new ApiError(
      400,
      `Container capacity exceeded. Maximum capacity for ${containerType} is ${maxCap.toLocaleString()} kg, but ${weight.toLocaleString()} kg was requested. Container over-allocation prevented.`
    );
  }

  let orderDoc = null;
  let buyerRef = buyerId;
  let buyerName = '';
  let buyerCountry = destinationCountry;
  let invNumber = '';

  if (orderId) {
    orderDoc = await Order.findById(orderId);
    if (orderDoc) {
      buyerRef = orderDoc.buyer;
      invNumber = orderDoc.invoiceNumber || '';
      buyerCountry = buyerCountry || orderDoc.buyerCountry || '';
    }
  }

  if (buyerRef) {
    const buyerUser = await User.findById(buyerRef);
    if (buyerUser) {
      buyerName = buyerUser.companyName || buyerUser.name;
      buyerCountry = buyerCountry || buyerUser.country;
    }
  } else {
    buyerRef = req.user._id;
    buyerName = req.user.companyName || req.user.name;
  }

  let lotDoc = null;
  if (lotId) {
    lotDoc = lotId.startsWith('LOT-')
      ? await AggregationLot.findOne({ lotId: lotId.toUpperCase() })
      : await AggregationLot.findById(lotId);
  }

  const shipmentNumber = generateShipmentNumber();
  const bookingReference = generateBookingReference();

  // Initialize the 6 required export trade documents with status 'pending'
  const initialDocuments = [
    {
      docType: 'phytosanitary_certificate',
      title: 'Phytosanitary Certificate',
      issuingAuthority: 'National Plant Protection / APEDA',
      status: 'pending'
    },
    {
      docType: 'certificate_of_origin',
      title: 'Certificate of Origin',
      issuingAuthority: 'Export Inspection Council / Indian Chamber of Commerce',
      status: 'pending'
    },
    {
      docType: 'commercial_invoice',
      title: 'Commercial Export Invoice',
      docNumber: invNumber || `INV-${shipmentNumber.slice(4)}`,
      issuingAuthority: 'AgriGlobal Hub Exporter',
      status: invNumber ? 'issued' : 'pending'
    },
    {
      docType: 'packing_list',
      title: 'Export Packing List & Weight Specification',
      issuingAuthority: 'AgriGlobal Cold Chain Hub',
      status: 'pending'
    },
    {
      docType: 'bill_of_lading',
      title: 'Ocean Bill of Lading (B/L)',
      issuingAuthority: shippingLine,
      status: 'pending'
    },
    {
      docType: 'quality_lab_certificate',
      title: 'Quality & Pesticide Residue Analysis Report',
      issuingAuthority: 'SGS / Eurofins Certified Lab',
      status: 'pending'
    }
  ];

  const shipment = new Shipment({
    shipmentNumber,
    bookingReference,
    order: orderDoc?._id || undefined,
    invoiceNumber: invNumber,
    aggregationLot: lotDoc?._id || undefined,
    lotId: lotDoc?.lotId || undefined,
    buyer: buyerRef,
    buyerName,
    buyerCountry,
    exporter: req.user._id,
    exporterName: req.user.name,
    cropName,
    grade,
    totalWeightKg: weight,
    packageCount: Number(packageCount) || Math.ceil(weight / 10),
    packageType,
    containerType,
    containerCapacityKg: maxCap,
    containerId: containerId ? containerId.toUpperCase().trim() : '',
    sealNumber: sealNumber ? sealNumber.toUpperCase().trim() : '',
    allocatedWeightKg: weight,
    grossWeightKg: weight + 4500, // tare + net
    temperatureSetpoint: Number(temperatureSetpoint) || 4.0,
    temperatureMinAllowed: (Number(temperatureSetpoint) || 4.0) - 2.0,
    temperatureMaxAllowed: (Number(temperatureSetpoint) || 4.0) + 2.0,
    humiditySetpoint: Number(humiditySetpoint) || 85,
    ventilationCmh: Number(ventilationCmh) || 15,
    containerStatus: containerId ? 'allocated' : 'unallocated',
    shippingLine,
    vesselName,
    voyageNumber,
    originPort,
    destinationPort,
    destinationCountry: buyerCountry,
    departureDate: departureDate ? new Date(departureDate) : new Date(Date.now() + 3 * 86400000),
    estimatedArrivalDate: estimatedArrivalDate ? new Date(estimatedArrivalDate) : new Date(Date.now() + 18 * 86400000),
    status: 'booked',
    timeline: [
      {
        status: 'booked',
        location: originPort,
        description: `Shipment booked with ${shippingLine} (Vessel: ${vesselName}, Voyage: ${voyageNumber})`,
        recordedAt: new Date(),
        recordedBy: req.user.name
      }
    ],
    documents: initialDocuments,
    notes
  });

  await shipment.save();

  // Sync with Order
  if (orderDoc) {
    orderDoc.containerId = shipment.containerId;
    orderDoc.sealNumber = shipment.sealNumber;
    orderDoc.destinationPort = shipment.destinationPort;
    orderDoc.shipmentTracking = {
      status: 'booked',
      carrier: shipment.shippingLine,
      vesselName: shipment.vesselName,
      trackingNumber: shipment.bookingReference,
      eta: shipment.estimatedArrivalDate
    };
    await orderDoc.save();
  }

  // Sync with AggregationLot
  if (lotDoc) {
    lotDoc.containerId = shipment.containerId;
    lotDoc.sealNumber = shipment.sealNumber;
    lotDoc.containerType = shipment.containerType;
    lotDoc.containerCapacityKg = shipment.containerCapacityKg;
    lotDoc.shippingLine = shipment.shippingLine;
    lotDoc.vesselName = shipment.vesselName;
    lotDoc.portOfLoading = shipment.originPort;
    lotDoc.portOfDischarge = shipment.destinationPort;
    lotDoc.shipmentStatus = 'booked';
    await lotDoc.save();
  }

  res.status(201).json({
    message: 'International shipment booked successfully',
    shipment
  });
}));

/**
 * PATCH /api/logistics/shipments/:id/container
 * Update container assignment, seal number, and cold-chain setpoints.
 * Strictly prevents over-allocation.
 */
router.patch('/shipments/:id/container', asyncHandler(async (req, res) => {
  const query = req.params.id.startsWith('SHP-')
    ? { shipmentNumber: req.params.id.toUpperCase() }
    : { _id: req.params.id };

  const shipment = await Shipment.findOne(query);
  if (!shipment) throw new ApiError(404, 'Shipment not found');

  const {
    containerType,
    containerId,
    sealNumber,
    allocatedWeightKg,
    temperatureSetpoint,
    humiditySetpoint,
    ventilationCmh,
    containerStatus
  } = req.body || {};

  if (containerType) {
    if (!CONTAINER_SPECS[containerType]) {
      throw new ApiError(400, 'Invalid containerType');
    }
    shipment.containerType = containerType;
    shipment.containerCapacityKg = getContainerCapacity(containerType);
  }

  const weight = allocatedWeightKg !== undefined ? Number(allocatedWeightKg) : shipment.allocatedWeightKg;
  if (weight > shipment.containerCapacityKg) {
    throw new ApiError(
      400,
      `Container capacity exceeded. Maximum capacity for ${shipment.containerType} is ${shipment.containerCapacityKg.toLocaleString()} kg, but ${weight.toLocaleString()} kg was requested. Container over-allocation prevented.`
    );
  }

  if (allocatedWeightKg !== undefined) {
    shipment.allocatedWeightKg = weight;
    shipment.totalWeightKg = weight;
    shipment.grossWeightKg = weight + shipment.tareWeightKg;
  }

  if (containerId !== undefined) shipment.containerId = containerId.toUpperCase().trim();
  if (sealNumber !== undefined) shipment.sealNumber = sealNumber.toUpperCase().trim();
  if (temperatureSetpoint !== undefined) {
    const t = Number(temperatureSetpoint);
    shipment.temperatureSetpoint = t;
    shipment.temperatureMinAllowed = t - 2.0;
    shipment.temperatureMaxAllowed = t + 2.0;
  }
  if (humiditySetpoint !== undefined) shipment.humiditySetpoint = Number(humiditySetpoint);
  if (ventilationCmh !== undefined) shipment.ventilationCmh = Number(ventilationCmh);
  if (containerStatus) shipment.containerStatus = containerStatus;

  // If container and seal provided, mark milestone if currently booked
  if (shipment.containerId && shipment.sealNumber && shipment.status === 'booked') {
    shipment.status = 'container_allocated';
    shipment.timeline.push({
      status: 'container_allocated',
      location: shipment.originPort,
      description: `Container ${shipment.containerId} stuffed and secured with customs seal ${shipment.sealNumber}`,
      recordedAt: new Date(),
      recordedBy: req.user.name
    });
  }

  await shipment.save();

  // Sync to Order and AggregationLot
  if (shipment.order) {
    await Order.findByIdAndUpdate(shipment.order, {
      containerId: shipment.containerId,
      sealNumber: shipment.sealNumber
    });
  }
  if (shipment.aggregationLot) {
    await AggregationLot.findByIdAndUpdate(shipment.aggregationLot, {
      containerId: shipment.containerId,
      sealNumber: shipment.sealNumber,
      containerType: shipment.containerType,
      containerCapacityKg: shipment.containerCapacityKg
    });
  }

  res.json({ message: 'Container details updated successfully', shipment });
}));

/**
 * PATCH /api/logistics/shipments/:id/booking
 * Update shipping line, vessel, voyage, ports, or ETD/ETA.
 */
router.patch('/shipments/:id/booking', asyncHandler(async (req, res) => {
  const query = req.params.id.startsWith('SHP-')
    ? { shipmentNumber: req.params.id.toUpperCase() }
    : { _id: req.params.id };

  const shipment = await Shipment.findOne(query);
  if (!shipment) throw new ApiError(404, 'Shipment not found');

  const {
    shippingLine,
    vesselName,
    voyageNumber,
    billOfLadingNumber,
    originPort,
    destinationPort,
    departureDate,
    estimatedArrivalDate
  } = req.body || {};

  if (shippingLine) shipment.shippingLine = shippingLine;
  if (vesselName) shipment.vesselName = vesselName;
  if (voyageNumber) shipment.voyageNumber = voyageNumber;
  if (billOfLadingNumber) shipment.billOfLadingNumber = billOfLadingNumber;
  if (originPort) shipment.originPort = originPort;
  if (destinationPort) shipment.destinationPort = destinationPort;
  if (departureDate) shipment.departureDate = new Date(departureDate);
  if (estimatedArrivalDate) shipment.estimatedArrivalDate = new Date(estimatedArrivalDate);

  await shipment.save();

  res.json({ message: 'Booking details updated successfully', shipment });
}));

/**
 * PATCH /api/logistics/shipments/:id/milestone
 * Advance milestone through shipment lifecycle and sync with Order & AggregationLot.
 */
router.patch('/shipments/:id/milestone', asyncHandler(async (req, res) => {
  const query = req.params.id.startsWith('SHP-')
    ? { shipmentNumber: req.params.id.toUpperCase() }
    : { _id: req.params.id };

  const shipment = await Shipment.findOne(query);
  if (!shipment) throw new ApiError(404, 'Shipment not found');

  const { status, location = '', description = '' } = req.body || {};

  if (!status || !SHIPMENT_MILESTONES.includes(status)) {
    throw new ApiError(400, `Valid milestone status is required: ${SHIPMENT_MILESTONES.join(', ')}`);
  }

  shipment.status = status;

  if (status === 'in_transit' && !shipment.actualDepartureDate) {
    shipment.actualDepartureDate = new Date();
  }
  if (['arrived_at_destination', 'delivered'].includes(status) && !shipment.actualArrivalDate) {
    shipment.actualArrivalDate = new Date();
  }

  shipment.timeline.push({
    status,
    location: location || shipment.destinationPort || shipment.originPort,
    description: description || `Status updated to ${status.replace(/_/g, ' ')}`,
    recordedAt: new Date(),
    recordedBy: req.user.name
  });

  await shipment.save();

  // Sync Order tracking
  if (shipment.order) {
    const orderUpdate = {
      'shipmentTracking.status': status,
      'shipmentTracking.vesselName': shipment.vesselName,
      'shipmentTracking.carrier': shipment.shippingLine,
      'shipmentTracking.trackingNumber': shipment.billOfLadingNumber || shipment.bookingReference
    };
    if (status === 'in_transit') orderUpdate.status = 'In Transit';
    if (status === 'delivered') orderUpdate.status = 'Completed';
    await Order.findByIdAndUpdate(shipment.order, orderUpdate);
  }

  // Sync AggregationLot tracking
  if (shipment.aggregationLot) {
    let lotShipmentStatus = 'booked';
    if (status === 'loaded_at_port') lotShipmentStatus = 'loaded_at_port';
    if (status === 'in_transit') lotShipmentStatus = 'in_transit_sea';
    if (status === 'customs_clearance') lotShipmentStatus = 'customs_cleared';
    if (status === 'delivered') lotShipmentStatus = 'delivered_to_importer';

    await AggregationLot.findByIdAndUpdate(shipment.aggregationLot, {
      shipmentStatus: lotShipmentStatus,
      status: status === 'delivered' ? 'exported' : status === 'in_transit' ? 'in_transit' : undefined
    });
  }

  res.json({ message: `Milestone updated to ${status}`, shipment });
}));

/**
 * POST /api/logistics/shipments/:id/cold-chain-log
 * Submit reefer telemetry. Automatically checks setpoints and logs excursion alerts.
 */
router.post('/shipments/:id/cold-chain-log', asyncHandler(async (req, res) => {
  const query = req.params.id.startsWith('SHP-')
    ? { shipmentNumber: req.params.id.toUpperCase() }
    : { _id: req.params.id };

  const shipment = await Shipment.findOne(query);
  if (!shipment) throw new ApiError(404, 'Shipment not found');

  const {
    temperature,
    humidity,
    powerStatus = 'connected',
    batteryPercent = 100,
    ambientTemperature = 28,
    sensorId = 'REEFER-IOT-01',
    location = 'In Transit'
  } = req.body || {};

  if (temperature === undefined || humidity === undefined) {
    throw new ApiError(400, 'temperature and humidity are required');
  }

  const temp = Number(temperature);
  const hum = Number(humidity);

  const logEntry = {
    timestamp: new Date(),
    temperature: temp,
    humidity: hum,
    powerStatus,
    batteryPercent: Number(batteryPercent),
    ambientTemperature: Number(ambientTemperature),
    sensorId,
    location,
    recordedBy: req.user.name
  };

  shipment.telemetryLogs.push(logEntry);

  // Analyze for cold chain excursions
  const newAlerts = [];

  if (temp > shipment.temperatureMaxAllowed) {
    const diff = temp - shipment.temperatureSetpoint;
    const severity = diff >= 3.0 ? 'critical' : 'warning';
    const alertId = `ALT-HI-${Date.now().toString().slice(-6)}-${crypto.randomInt(10, 99)}`;
    const alert = {
      alertId,
      severity,
      type: 'temperature_high',
      message: `Reefer temperature of ${temp}°C exceeds maximum threshold of ${shipment.temperatureMaxAllowed}°C (Setpoint: ${shipment.temperatureSetpoint}°C).`,
      reading: temp,
      threshold: shipment.temperatureMaxAllowed,
      timestamp: new Date(),
      resolved: false
    };
    shipment.coldChainAlerts.push(alert);
    newAlerts.push(alert);
    shipment.hasActiveAlerts = true;
  } else if (temp < shipment.temperatureMinAllowed) {
    const diff = shipment.temperatureSetpoint - temp;
    const severity = diff >= 3.0 ? 'critical' : 'warning';
    const alertId = `ALT-LO-${Date.now().toString().slice(-6)}-${crypto.randomInt(10, 99)}`;
    const alert = {
      alertId,
      severity,
      type: 'temperature_low',
      message: `Reefer temperature of ${temp}°C dropped below minimum threshold of ${shipment.temperatureMinAllowed}°C (Chilling injury risk).`,
      reading: temp,
      threshold: shipment.temperatureMinAllowed,
      timestamp: new Date(),
      resolved: false
    };
    shipment.coldChainAlerts.push(alert);
    newAlerts.push(alert);
    shipment.hasActiveAlerts = true;
  }

  if (powerStatus === 'interrupted') {
    const alertId = `ALT-PWR-${Date.now().toString().slice(-6)}-${crypto.randomInt(10, 99)}`;
    const alert = {
      alertId,
      severity: 'critical',
      type: 'power_failure',
      message: 'Reefer container power connection interrupted! Genset failover required immediately.',
      timestamp: new Date(),
      resolved: false
    };
    shipment.coldChainAlerts.push(alert);
    newAlerts.push(alert);
    shipment.hasActiveAlerts = true;
  }

  if (hum < 60 || hum > 96) {
    const alertId = `ALT-HUM-${Date.now().toString().slice(-6)}-${crypto.randomInt(10, 99)}`;
    const alert = {
      alertId,
      severity: 'warning',
      type: 'humidity_exceeded',
      message: `Reefer humidity reading of ${hum}% is outside safe fresh-produce range (60% - 95%).`,
      reading: hum,
      threshold: 85,
      timestamp: new Date(),
      resolved: false
    };
    shipment.coldChainAlerts.push(alert);
    newAlerts.push(alert);
    shipment.hasActiveAlerts = true;
  }

  await shipment.save();

  res.status(201).json({
    message: 'Cold chain telemetry recorded successfully',
    logEntry,
    newAlertsCount: newAlerts.length,
    newAlerts
  });
}));

/**
 * PATCH /api/logistics/shipments/:id/cold-chain-alerts/:alertId/resolve
 * Resolve a cold-chain alarm with corrective action notes.
 */
router.patch('/shipments/:id/cold-chain-alerts/:alertId/resolve', asyncHandler(async (req, res) => {
  const query = req.params.id.startsWith('SHP-')
    ? { shipmentNumber: req.params.id.toUpperCase() }
    : { _id: req.params.id };

  const shipment = await Shipment.findOne(query);
  if (!shipment) throw new ApiError(404, 'Shipment not found');

  const alert = shipment.coldChainAlerts.find(
    (a) => a.alertId === req.params.alertId || String(a._id) === req.params.alertId
  );
  if (!alert) throw new ApiError(404, 'Alert not found');

  alert.resolved = true;
  alert.resolvedAt = new Date();
  alert.resolutionNotes = req.body?.resolutionNotes || 'Inspected and verified within operational tolerance';

  shipment.hasActiveAlerts = shipment.coldChainAlerts.some((a) => !a.resolved);
  await shipment.save();

  res.json({ message: 'Alert resolved successfully', alert });
}));

/**
 * POST /api/logistics/shipments/:id/documents
 * Upload or attach an export trade document.
 */
router.post('/shipments/:id/documents', asyncHandler(async (req, res) => {
  const query = req.params.id.startsWith('SHP-')
    ? { shipmentNumber: req.params.id.toUpperCase() }
    : { _id: req.params.id };

  const shipment = await Shipment.findOne(query);
  if (!shipment) throw new ApiError(404, 'Shipment not found');

  const {
    docType,
    title,
    docNumber = '',
    issuingAuthority = '',
    issueDate,
    validUntil,
    fileUrl = '',
    verificationNotes = '',
    status = 'issued'
  } = req.body || {};

  if (!docType || !EXPORT_DOCUMENT_TYPES.includes(docType)) {
    throw new ApiError(400, `Valid docType is required: ${EXPORT_DOCUMENT_TYPES.join(', ')}`);
  }

  const existingDoc = shipment.documents.find((d) => d.docType === docType);
  if (existingDoc) {
    if (title) existingDoc.title = title;
    if (docNumber) existingDoc.docNumber = docNumber;
    if (issuingAuthority) existingDoc.issuingAuthority = issuingAuthority;
    if (issueDate) existingDoc.issueDate = new Date(issueDate);
    if (validUntil) existingDoc.validUntil = new Date(validUntil);
    if (fileUrl) existingDoc.fileUrl = fileUrl;
    if (verificationNotes) existingDoc.verificationNotes = verificationNotes;
    existingDoc.status = status;
  } else {
    shipment.documents.push({
      docType,
      title: title || docType.replace(/_/g, ' ').toUpperCase(),
      docNumber,
      issuingAuthority,
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : undefined,
      fileUrl,
      verificationNotes,
      status
    });
  }

  await shipment.save();

  res.status(201).json({ message: 'Document updated successfully', documents: shipment.documents });
}));

/**
 * PATCH /api/logistics/shipments/:id/documents/:docId/verify
 * Admin verifies an export document.
 */
router.patch('/shipments/:id/documents/:docId/verify', asyncHandler(async (req, res) => {
  const query = req.params.id.startsWith('SHP-')
    ? { shipmentNumber: req.params.id.toUpperCase() }
    : { _id: req.params.id };

  const shipment = await Shipment.findOne(query);
  if (!shipment) throw new ApiError(404, 'Shipment not found');

  const doc = shipment.documents.find(
    (d) => d._id?.toString() === req.params.docId || d.docType === req.params.docId
  );
  if (!doc) throw new ApiError(404, 'Document not found');

  const { status = 'verified', verificationNotes = '' } = req.body || {};
  doc.status = status;
  doc.verificationNotes = verificationNotes;
  doc.verifiedAt = new Date();
  doc.verifiedBy = req.user.name;

  await shipment.save();

  res.json({ message: `Document marked as ${status}`, doc });
}));

/**
 * PATCH /api/logistics/shipments/:id/customs
 * Update origin and destination customs clearance statuses.
 */
router.patch('/shipments/:id/customs', asyncHandler(async (req, res) => {
  const query = req.params.id.startsWith('SHP-')
    ? { shipmentNumber: req.params.id.toUpperCase() }
    : { _id: req.params.id };

  const shipment = await Shipment.findOne(query);
  if (!shipment) throw new ApiError(404, 'Shipment not found');

  const {
    originShippingBillNumber,
    originStatus,
    originRemarks,
    destBillOfEntryNumber,
    destStatus,
    destDutyAmountPaid,
    destRemarks
  } = req.body || {};

  if (originShippingBillNumber !== undefined) shipment.originCustoms.shippingBillNumber = originShippingBillNumber;
  if (originStatus) {
    shipment.originCustoms.status = originStatus;
    if (originStatus === 'cleared') shipment.originCustoms.clearedAt = new Date();
  }
  if (originRemarks !== undefined) shipment.originCustoms.inspectionRemarks = originRemarks;

  if (destBillOfEntryNumber !== undefined) shipment.destinationCustoms.billOfEntryNumber = destBillOfEntryNumber;
  if (destStatus) {
    shipment.destinationCustoms.status = destStatus;
    if (destStatus === 'cleared') {
      shipment.destinationCustoms.clearedAt = new Date();
      if (shipment.status === 'in_transit') {
        shipment.status = 'customs_clearance';
        shipment.timeline.push({
          status: 'customs_clearance',
          location: shipment.destinationPort,
          description: `Customs cleared at ${shipment.destinationPort}. Import duty settled.`,
          recordedAt: new Date(),
          recordedBy: req.user.name
        });
      }
    }
  }
  if (destDutyAmountPaid !== undefined) shipment.destinationCustoms.dutyAmountPaid = Number(destDutyAmountPaid);
  if (destRemarks !== undefined) shipment.destinationCustoms.remarks = destRemarks;

  await shipment.save();

  res.json({
    message: 'Customs clearance records updated successfully',
    originCustoms: shipment.originCustoms,
    destinationCustoms: shipment.destinationCustoms
  });
}));

/**
 * POST /api/logistics/shipments/:id/proof-of-delivery
 * Importer/buyer confirms delivery and signs Proof of Delivery (POD).
 * Transitions shipment to 'delivered' and Order to 'Completed'.
 */
router.post('/shipments/:id/proof-of-delivery', asyncHandler(async (req, res) => {
  const query = req.params.id.startsWith('SHP-')
    ? { shipmentNumber: req.params.id.toUpperCase() }
    : { _id: req.params.id };

  const shipment = await Shipment.findOne(query);
  if (!shipment) throw new ApiError(404, 'Shipment not found');

  const {
    recipientName = req.user.name,
    receivedQuantityKg,
    conditionOnArrival = 'Excellent - Cold Chain Maintained',
    acknowledgmentRef = '',
    remarks = ''
  } = req.body || {};

  shipment.proofOfDelivery = {
    recipientName,
    receivedQuantityKg: Number(receivedQuantityKg) || shipment.allocatedWeightKg,
    conditionOnArrival,
    acknowledgmentRef: acknowledgmentRef || `POD-${shipment.shipmentNumber}-${Date.now().toString().slice(-4)}`,
    deliveredAt: new Date(),
    remarks
  };

  shipment.status = 'delivered';
  shipment.actualArrivalDate = new Date();
  shipment.timeline.push({
    status: 'delivered',
    location: shipment.destinationPort,
    description: `Cargo successfully delivered to ${recipientName}. Condition: ${conditionOnArrival}.`,
    recordedAt: new Date(),
    recordedBy: req.user.name
  });

  await shipment.save();

  if (shipment.order) {
    await Order.findByIdAndUpdate(shipment.order, {
      status: 'Completed',
      'shipmentTracking.status': 'delivered'
    });
  }

  if (shipment.aggregationLot) {
    await AggregationLot.findByIdAndUpdate(shipment.aggregationLot, {
      status: 'exported',
      shipmentStatus: 'delivered_to_importer'
    });
  }

  res.json({
    message: 'Proof of Delivery (POD) confirmed successfully',
    proofOfDelivery: shipment.proofOfDelivery,
    shipment
  });
}));

/**
 * GET /api/logistics/analytics
 * Container fleet utilization, cold-chain telemetry health, and shipment status breakdown.
 */
router.get('/analytics', asyncHandler(async (req, res) => {
  const shipments = await Shipment.find({});

  let totalAllocatedWeightKg = 0;
  let totalContainerCapacityKg = 0;
  let totalTeus = 0;
  let totalActiveAlerts = 0;
  let totalCriticalExcursions = 0;
  let totalTelemetryPoints = 0;
  let sumTemperatures = 0;

  const statusCounts = {
    booked: 0,
    container_allocated: 0,
    loaded_at_port: 0,
    in_transit: 0,
    customs_clearance: 0,
    arrived_at_destination: 0,
    delivered: 0,
    cancelled: 0
  };

  const containerTypeCounts = {
    '20ft Reefer': { count: 0, allocatedWeightKg: 0, capacityKg: 0 },
    '40ft Reefer': { count: 0, allocatedWeightKg: 0, capacityKg: 0 },
    '40ft High Cube Reefer': { count: 0, allocatedWeightKg: 0, capacityKg: 0 }
  };

  for (const s of shipments) {
    if (statusCounts[s.status] !== undefined) {
      statusCounts[s.status]++;
    }

    if (s.status !== 'cancelled') {
      totalAllocatedWeightKg += s.allocatedWeightKg || 0;
      totalContainerCapacityKg += s.containerCapacityKg || 29000;
      const teu = CONTAINER_SPECS[s.containerType]?.teu || 2.0;
      totalTeus += teu;

      if (containerTypeCounts[s.containerType]) {
        containerTypeCounts[s.containerType].count++;
        containerTypeCounts[s.containerType].allocatedWeightKg += s.allocatedWeightKg || 0;
        containerTypeCounts[s.containerType].capacityKg += s.containerCapacityKg || 29000;
      }
    }

    for (const a of s.coldChainAlerts || []) {
      if (!a.resolved) totalActiveAlerts++;
      if (a.severity === 'critical') totalCriticalExcursions++;
    }

    for (const log of s.telemetryLogs || []) {
      totalTelemetryPoints++;
      sumTemperatures += log.temperature;
    }
  }

  const overallUtilizationPercent = totalContainerCapacityKg > 0
    ? Number(((totalAllocatedWeightKg / totalContainerCapacityKg) * 100).toFixed(1))
    : 0;

  const avgTransitTemperature = totalTelemetryPoints > 0
    ? Number((sumTemperatures / totalTelemetryPoints).toFixed(1))
    : 4.2;

  res.json({
    fleet: {
      totalShipments: shipments.length,
      activeShipments: shipments.filter((s) => !['delivered', 'cancelled'].includes(s.status)).length,
      totalTeus,
      totalAllocatedWeightKg,
      totalContainerCapacityKg,
      overallUtilizationPercent,
      containerTypeBreakdown: containerTypeCounts
    },
    statusBreakdown: statusCounts,
    coldChainHealth: {
      activeAlerts: totalActiveAlerts,
      criticalExcursions: totalCriticalExcursions,
      totalTelemetryPoints,
      avgTransitTemperature
    }
  });
}));

export default router;
