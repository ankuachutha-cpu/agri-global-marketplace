import { Router } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Crop } from '../models/Crop.js';
import { Order } from '../models/Order.js';
import { Company } from '../models/Company.js';
import { AggregationLot } from '../models/AggregationLot.js';
import { CollectionRequest } from '../models/CollectionRequest.js';
import { AuditLog, logAdminAction } from '../models/AuditLog.js';
import { asyncHandler, ApiError, objectId } from '../middleware/http.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { updateCollectionStatus } from '../services/collection.js';

const router = Router();
router.use(authenticate, requireRole('admin'));

// ==========================================
// 1. OVERVIEW & COMPREHENSIVE KPI METRICS
// ==========================================

router.get('/stats', asyncHandler(async (_req, res) => {
  const [farmers, buyers, crops, orders, companies, verified] = await Promise.all([
    User.countDocuments({ role: 'farmer' }),
    User.countDocuments({ role: 'buyer' }),
    Crop.countDocuments(),
    Order.countDocuments(),
    Company.countDocuments(),
    Company.countDocuments({ verificationStatus: 'verified' })
  ]);
  res.json({ farmers, buyers, crops, orders, companies, verifiedCompanies: verified });
}));

router.get('/overview-metrics', asyncHandler(async (_req, res) => {
  const [
    farmersCount,
    buyersCount,
    adminsCount,
    cropsCount,
    ordersCount,
    companiesCount,
    verifiedCompaniesCount,
    lots,
    collections,
    orders
  ] = await Promise.all([
    User.countDocuments({ role: 'farmer' }),
    User.countDocuments({ role: 'buyer' }),
    User.countDocuments({ role: 'admin' }),
    Crop.countDocuments(),
    Order.countDocuments(),
    Company.countDocuments(),
    Company.countDocuments({ verificationStatus: 'verified' }),
    AggregationLot.find(),
    CollectionRequest.find(),
    Order.find()
  ]);

  // Aggregation Metrics
  let totalAggregatedVolumeKg = 0;
  let activeLotsCount = 0;
  let exportReadyLotsCount = 0;
  let shippedLotsCount = 0;
  let grossExportValueInr = 0;
  let platformCommissionInr = 0;

  for (const lot of lots) {
    totalAggregatedVolumeKg += lot.totalQuantityKg || 0;
    if (['forming', 'ready_for_inspection', 'inspected', 'allocated_for_export'].includes(lot.status)) {
      activeLotsCount++;
    }
    if (['ready_for_inspection', 'inspected', 'allocated_for_export', 'in_transit', 'exported'].includes(lot.status)) {
      exportReadyLotsCount++;
    }
    if (['in_transit', 'exported'].includes(lot.status)) {
      shippedLotsCount++;
    }

    const lotVal = (lot.totalExportValueInr && lot.totalExportValueInr > 0)
      ? lot.totalExportValueInr
      : (lot.totalQuantityKg || 0) * (lot.weightedAvgPricePerKg || 0);

    if (['allocated_for_export', 'in_transit', 'exported'].includes(lot.status)) {
      grossExportValueInr += lotVal;
      platformCommissionInr += (lot.platformCommissionInr && lot.platformCommissionInr > 0)
        ? lot.platformCommissionInr
        : Math.round(lotVal * 0.05); // 5% standard facilitation commission
    }
  }

  // Collections & Payout Metrics
  let totalScheduledProduceKg = 0;
  let totalAcceptedProduceKg = 0;
  let totalSettledFarmerPayoutsInr = 0;
  let totalPendingFarmerPayoutsInr = 0;
  let activePickupsCount = 0;

  for (const col of collections) {
    if (['scheduled', 'in_transit', 'inspected_at_farm', 'delivered_to_hub'].includes(col.status)) {
      activePickupsCount++;
      totalScheduledProduceKg += col.estimatedQuantityKg || 0;
      totalPendingFarmerPayoutsInr += col.totalEstimatedPayoutInr || 0;
    }
    if (col.status === 'accepted') {
      totalAcceptedProduceKg += col.acceptedQuantityKg || 0;
      if (col.paymentStatus === 'paid') {
        totalSettledFarmerPayoutsInr += col.totalFinalPayoutInr || 0;
      } else {
        totalPendingFarmerPayoutsInr += col.totalFinalPayoutInr || 0;
      }
    }
  }

  // Direct Marketplace Orders Volume
  let marketplaceOrdersTotalInr = 0;
  for (const o of orders) {
    marketplaceOrdersTotalInr += o.totalInr || 0;
  }

  res.json({
    users: {
      total: farmersCount + buyersCount + adminsCount,
      farmers: farmersCount,
      buyers: buyersCount,
      admins: adminsCount
    },
    crops: {
      total: cropsCount
    },
    companies: {
      total: companiesCount,
      verified: verifiedCompaniesCount
    },
    aggregation: {
      totalLots: lots.length,
      activeLots: activeLotsCount,
      exportReadyLots: exportReadyLotsCount,
      shippedLots: shippedLotsCount,
      totalAggregatedKg: totalAggregatedVolumeKg,
      totalAggregatedMT: Number((totalAggregatedVolumeKg / 1000).toFixed(2))
    },
    collections: {
      total: collections.length,
      activePickups: activePickupsCount,
      scheduledKg: totalScheduledProduceKg,
      acceptedKg: totalAcceptedProduceKg
    },
    financials: {
      settledFarmerPayoutsInr: totalSettledFarmerPayoutsInr,
      pendingFarmerPayoutsInr: totalPendingFarmerPayoutsInr,
      grossExportValueInr,
      platformCommissionInr,
      marketplaceOrdersTotalInr
    }
  });
}));

// ==========================================
// 2. AGGREGATION MANAGEMENT
// ==========================================

router.get('/aggregation/lots', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.state) filter.state = req.query.state;
  if (req.query.cropName) filter.cropName = new RegExp(req.query.cropName, 'i');
  if (req.query.grade) filter.grade = req.query.grade;

  const lots = await AggregationLot.find(filter)
    .populate('exportBuyer', 'name country city buyerType')
    .populate('assignedCollectionCenter', 'name city state')
    .sort('-createdAt')
    .limit(Number(req.query.limit) || 100);

  res.json({ count: lots.length, lots });
}));

router.get('/aggregation/lots/:id', asyncHandler(async (req, res) => {
  const query = req.params.id.startsWith('LOT-')
    ? { lotId: req.params.id.toUpperCase() }
    : { _id: req.params.id };

  const lot = await AggregationLot.findOne(query)
    .populate('contributions.farmer', 'name email phone state district farmLocation')
    .populate('contributions.crop')
    .populate('exportBuyer')
    .populate('assignedCollectionCenter');

  if (!lot) throw new ApiError(404, 'Aggregation lot not found');
  res.json({ lot });
}));

router.patch('/aggregation/lots/:id/status', asyncHandler(async (req, res) => {
  const { status, notes } = req.body || {};
  if (!status) throw new ApiError(400, 'Target status is required');

  const query = req.params.id.startsWith('LOT-')
    ? { lotId: req.params.id.toUpperCase() }
    : { _id: req.params.id };

  const lot = await AggregationLot.findOne(query);
  if (!lot) throw new ApiError(404, 'Aggregation lot not found');

  const oldStatus = lot.status;
  lot.status = status;
  if (notes) lot.notes = notes;
  await lot.save();

  await logAdminAction({
    action: 'LOT_STATUS_UPDATED',
    req,
    targetModel: 'AggregationLot',
    targetId: lot.lotId,
    description: `Updated lot ${lot.lotId} status from ${oldStatus} to ${status}`,
    metadata: { oldStatus, newStatus: status, notes }
  });

  res.json({ message: `Lot status updated to ${status}`, lot });
}));

router.post('/aggregation/lots/:id/inspection', asyncHandler(async (req, res) => {
  const { inspectorName, passed, gradeAssigned, moisturePercent, notes } = req.body || {};

  const query = req.params.id.startsWith('LOT-')
    ? { lotId: req.params.id.toUpperCase() }
    : { _id: req.params.id };

  const lot = await AggregationLot.findOne(query);
  if (!lot) throw new ApiError(404, 'Aggregation lot not found');

  lot.inspectionReport = {
    inspectorName: inspectorName || req.user.name,
    passed: passed !== undefined ? Boolean(passed) : true,
    gradeAssigned: gradeAssigned || lot.grade,
    moisturePercent: moisturePercent ? Number(moisturePercent) : undefined,
    inspectedAt: new Date(),
    notes: notes || 'Inspection verified by Admin QC Officer'
  };

  if (passed === false) {
    lot.status = 'ready_for_inspection';
  } else {
    lot.status = 'inspected';
  }

  await lot.save();

  await logAdminAction({
    action: 'LOT_INSPECTED',
    req,
    targetModel: 'AggregationLot',
    targetId: lot.lotId,
    description: `Conducted QC inspection on lot ${lot.lotId}. Passed: ${lot.inspectionReport.passed}`,
    metadata: lot.inspectionReport
  });

  res.json({ message: 'Inspection report recorded successfully', lot });
}));

router.post('/aggregation/lots/:id/container', asyncHandler(async (req, res) => {
  const {
    containerType,
    containerCapacityKg,
    containerId,
    sealNumber,
    temperatureSetpoint,
    shippingLine,
    vesselName,
    portOfLoading,
    portOfDischarge,
    shipmentStatus
  } = req.body || {};

  const query = req.params.id.startsWith('LOT-')
    ? { lotId: req.params.id.toUpperCase() }
    : { _id: req.params.id };

  const lot = await AggregationLot.findOne(query);
  if (!lot) throw new ApiError(404, 'Aggregation lot not found');

  if (containerType) lot.containerType = containerType;
  if (containerCapacityKg) lot.containerCapacityKg = Number(containerCapacityKg);
  if (containerId) lot.containerId = containerId;
  if (sealNumber) lot.sealNumber = sealNumber;
  if (temperatureSetpoint) lot.temperatureSetpoint = temperatureSetpoint;
  if (shippingLine) lot.shippingLine = shippingLine;
  if (vesselName) lot.vesselName = vesselName;
  if (portOfLoading) lot.portOfLoading = portOfLoading;
  if (portOfDischarge) lot.portOfDischarge = portOfDischarge;
  if (shipmentStatus) lot.shipmentStatus = shipmentStatus;

  await lot.save();

  await logAdminAction({
    action: 'CONTAINER_ALLOCATED',
    req,
    targetModel: 'AggregationLot',
    targetId: lot.lotId,
    description: `Allocated container ${lot.containerId || 'TBD'} to lot ${lot.lotId}`,
    metadata: { containerId: lot.containerId, sealNumber: lot.sealNumber, shippingLine: lot.shippingLine }
  });

  res.json({ message: 'Container and logistics allocation saved', lot });
}));

router.post('/aggregation/lots/:id/buyer', asyncHandler(async (req, res) => {
  const {
    exportBuyerId,
    buyerName,
    destinationCountry,
    exportSalePricePerKg,
    platformCommissionPercent
  } = req.body || {};

  const query = req.params.id.startsWith('LOT-')
    ? { lotId: req.params.id.toUpperCase() }
    : { _id: req.params.id };

  const lot = await AggregationLot.findOne(query);
  if (!lot) throw new ApiError(404, 'Aggregation lot not found');

  if (exportBuyerId && mongoose.isValidObjectId(exportBuyerId)) {
    lot.exportBuyer = exportBuyerId;
    const co = await Company.findById(exportBuyerId);
    if (co) {
      lot.buyerName = co.name;
      lot.destinationCountry = co.country;
    }
  }

  if (buyerName) lot.buyerName = buyerName;
  if (destinationCountry) lot.destinationCountry = destinationCountry;

  const salePrice = Number(exportSalePricePerKg) > 0 ? Number(exportSalePricePerKg) : lot.weightedAvgPricePerKg;
  lot.exportSalePricePerKg = salePrice;
  lot.totalExportValueInr = Math.round(lot.totalQuantityKg * salePrice);

  const commPct = Number(platformCommissionPercent) >= 0 ? Number(platformCommissionPercent) : 5;
  lot.platformCommissionPercent = commPct;
  lot.platformCommissionInr = Math.round(lot.totalExportValueInr * (commPct / 100));
  lot.netFarmerDisbursalInr = Math.round(lot.totalExportValueInr - lot.platformCommissionInr);

  lot.status = 'allocated_for_export';
  await lot.save();

  await logAdminAction({
    action: 'BUYER_ASSIGNED',
    req,
    targetModel: 'AggregationLot',
    targetId: lot.lotId,
    description: `Assigned international buyer ${lot.buyerName} (${lot.destinationCountry}) to lot ${lot.lotId}`,
    metadata: {
      buyerName: lot.buyerName,
      destinationCountry: lot.destinationCountry,
      totalExportValueInr: lot.totalExportValueInr,
      platformCommissionInr: lot.platformCommissionInr
    }
  });

  res.json({ message: 'International buyer and export financial allocations set', lot });
}));

router.post('/aggregation/lots/:id/documents', asyncHandler(async (req, res) => {
  const { docType, docNumber, issuedBy, issueDate, status, fileUrl } = req.body || {};
  if (!docType) throw new ApiError(400, 'docType is required');

  const query = req.params.id.startsWith('LOT-')
    ? { lotId: req.params.id.toUpperCase() }
    : { _id: req.params.id };

  const lot = await AggregationLot.findOne(query);
  if (!lot) throw new ApiError(404, 'Aggregation lot not found');

  const doc = {
    docType,
    docNumber: docNumber || '',
    issuedBy: issuedBy || '',
    issueDate: issueDate ? new Date(issueDate) : new Date(),
    status: status || 'issued',
    fileUrl: fileUrl || ''
  };

  lot.documents.push(doc);
  await lot.save();

  await logAdminAction({
    action: 'DOCUMENT_ADDED',
    req,
    targetModel: 'AggregationLot',
    targetId: lot.lotId,
    description: `Added ${docType} (${docNumber || 'no ref'}) to lot ${lot.lotId}`,
    metadata: doc
  });

  res.json({ message: 'Export document recorded', lot });
}));

// ==========================================
// 3. COLLECTION MANAGEMENT
// ==========================================

router.get('/collections', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
  if (req.query.cropName) filter.cropName = new RegExp(req.query.cropName, 'i');

  const collections = await CollectionRequest.find(filter)
    .populate('farmer', 'name email phone state district farmLocation')
    .populate('crop', 'name quantity unit priceInr images coordinates farmAddress')
    .populate('aggregationLot', 'lotId cropName grade totalQuantityKg')
    .sort('-createdAt')
    .limit(Number(req.query.limit) || 200);

  res.json({ count: collections.length, collections });
}));

router.patch('/collections/:id/assign-center', asyncHandler(async (req, res) => {
  const { centerId, centerName } = req.body || {};
  const query = req.params.id.startsWith('COL-') ? { collectionId: req.params.id } : { _id: req.params.id };

  const col = await CollectionRequest.findOne(query);
  if (!col) throw new ApiError(404, 'Collection request not found');

  if (centerId && mongoose.isValidObjectId(centerId)) col.collectionCenter = centerId;
  if (centerName) col.centerName = centerName;
  await col.save();

  await logAdminAction({
    action: 'COLLECTION_CENTER_ASSIGNED',
    req,
    targetModel: 'CollectionRequest',
    targetId: col.collectionId,
    description: `Assigned collection center ${centerName} to pickup ${col.collectionId}`
  });

  res.json({ message: 'Collection center assigned', collection: col });
}));

// ==========================================
// 4. FINANCIAL MANAGEMENT & SETTLEMENTS
// ==========================================

router.get('/financials/summary', asyncHandler(async (_req, res) => {
  const [collections, lots, orders] = await Promise.all([
    CollectionRequest.find().populate('farmer', 'name email phone').sort('-updatedAt'),
    AggregationLot.find().sort('-updatedAt'),
    Order.find().sort('-createdAt')
  ]);

  let totalPaidFarmerInr = 0;
  let totalPendingFarmerInr = 0;
  const recentSettlements = [];

  for (const c of collections) {
    if (c.paymentStatus === 'paid') {
      totalPaidFarmerInr += c.totalFinalPayoutInr || 0;
      recentSettlements.push({
        id: c.collectionId,
        type: 'Collection Pickup Payout',
        farmerName: c.farmer?.name || 'Farmer',
        cropName: c.cropName,
        quantityKg: c.acceptedQuantityKg || c.estimatedQuantityKg,
        amountInr: c.totalFinalPayoutInr || 0,
        status: 'paid',
        reference: c.paymentReference || 'Direct DBT',
        settledAt: c.paidAt || c.updatedAt
      });
    } else if (c.status === 'accepted' || c.status === 'scheduled') {
      totalPendingFarmerInr += (c.totalFinalPayoutInr ?? c.totalEstimatedPayoutInr) || 0;
    }
  }

  let totalExportValueInr = 0;
  let totalCommissionsInr = 0;

  for (const l of lots) {
    const val = l.totalExportValueInr || ((l.totalQuantityKg || 0) * (l.weightedAvgPricePerKg || 0));
    if (['allocated_for_export', 'in_transit', 'exported'].includes(l.status)) {
      totalExportValueInr += val;
      totalCommissionsInr += l.platformCommissionInr || Math.round(val * 0.05);
    }
  }

  let marketplaceRevenueInr = 0;
  for (const o of orders) {
    marketplaceRevenueInr += o.totalInr || 0;
  }

  res.json({
    metrics: {
      totalPaidFarmerInr,
      totalPendingFarmerInr,
      totalExportValueInr,
      totalCommissionsInr,
      marketplaceRevenueInr,
      netDisbursedPercentage: totalPaidFarmerInr + totalPendingFarmerInr > 0
        ? Math.round((totalPaidFarmerInr / (totalPaidFarmerInr + totalPendingFarmerInr)) * 100)
        : 100
    },
    recentSettlements: recentSettlements.slice(0, 50)
  });
}));

router.post('/financials/settle-farmer/:id', asyncHandler(async (req, res) => {
  const { paymentReference, amountInr, notes } = req.body || {};
  const query = req.params.id.startsWith('COL-') ? { collectionId: req.params.id } : { _id: req.params.id };

  const col = await CollectionRequest.findOne(query);
  if (!col) throw new ApiError(404, 'Collection request not found');

  col.paymentStatus = 'paid';
  col.paidAt = new Date();
  col.paymentReference = paymentReference || `UPI-AGRI-${Math.floor(100000 + Math.random() * 900000)}`;
  if (amountInr) col.totalFinalPayoutInr = Number(amountInr);

  col.timeline.push({
    status: 'paid',
    timestamp: new Date(),
    note: notes || `Farmer payment of ₹${col.totalFinalPayoutInr} settled successfully via ${col.paymentReference}`,
    actor: req.user.name || 'Finance Officer'
  });

  await col.save();

  await logAdminAction({
    action: 'PAYMENT_SETTLED',
    req,
    targetModel: 'CollectionRequest',
    targetId: col.collectionId,
    description: `Settled payment of ₹${col.totalFinalPayoutInr} for collection ${col.collectionId} (Ref: ${col.paymentReference})`,
    metadata: { amountInr: col.totalFinalPayoutInr, reference: col.paymentReference }
  });

  res.json({ message: 'Farmer payment settled', collection: col });
}));

// ==========================================
// 5. EXPORT MANAGEMENT
// ==========================================

router.get('/exports', asyncHandler(async (_req, res) => {
  const exportLots = await AggregationLot.find({
    status: { $in: ['ready_for_inspection', 'inspected', 'allocated_for_export', 'in_transit', 'exported'] }
  })
    .populate('exportBuyer', 'name country city buyerType contactPage website email phone')
    .sort('-updatedAt');

  // Calculate container stats
  let totalExportContainers = 0;
  let totalShippedWeightKg = 0;
  let totalCapacityKg = 0;

  for (const l of exportLots) {
    if (l.containerId) totalExportContainers++;
    totalShippedWeightKg += l.totalQuantityKg || 0;
    totalCapacityKg += l.containerCapacityKg || 24000;
  }

  const containerUtilizationRate = totalCapacityKg > 0
    ? Math.round((totalShippedWeightKg / totalCapacityKg) * 100)
    : 0;

  res.json({
    metrics: {
      totalExportLots: exportLots.length,
      totalExportContainers,
      totalShippedWeightKg,
      totalCapacityKg,
      containerUtilizationRate
    },
    exportLots
  });
}));

router.patch('/exports/:id/shipment-status', asyncHandler(async (req, res) => {
  const { shipmentStatus, notes } = req.body || {};
  if (!shipmentStatus) throw new ApiError(400, 'shipmentStatus is required');

  const query = req.params.id.startsWith('LOT-')
    ? { lotId: req.params.id.toUpperCase() }
    : { _id: req.params.id };

  const lot = await AggregationLot.findOne(query);
  if (!lot) throw new ApiError(404, 'Aggregation lot not found');

  lot.shipmentStatus = shipmentStatus;
  if (['in_transit_sea', 'loaded_at_port'].includes(shipmentStatus)) {
    lot.status = 'in_transit';
  } else if (['customs_cleared', 'delivered_to_importer'].includes(shipmentStatus)) {
    lot.status = 'exported';
  }

  if (notes) lot.notes = notes;
  await lot.save();

  await logAdminAction({
    action: 'SHIPMENT_STATUS_UPDATED',
    req,
    targetModel: 'AggregationLot',
    targetId: lot.lotId,
    description: `Updated export lot ${lot.lotId} shipment status to ${shipmentStatus}`,
    metadata: { shipmentStatus, lotStatus: lot.status, notes }
  });

  res.json({ message: `Shipment status updated to ${shipmentStatus}`, lot });
}));

// ==========================================
// 6. USER MANAGEMENT
// ==========================================

router.get('/users', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.country) filter.country = req.query.country;
  if (req.query.active !== undefined) filter.active = req.query.active === 'true';
  if (req.query.q) {
    const rx = new RegExp(req.query.q, 'i');
    filter.$or = [{ name: rx }, { email: rx }, { city: rx }, { state: rx }];
  }

  const users = await User.find(filter).sort('-createdAt').limit(500);
  res.json({ items: users });
}));

router.patch('/users/:id', asyncHandler(async (req, res) => {
  if (typeof req.body.active !== 'boolean') throw new ApiError(400, 'active (boolean) required');
  const u = objectId.safeParse(req.params.id).success && await User.findById(req.params.id);
  if (!u) throw new ApiError(404, 'User not found');
  if (u.role === 'admin' && String(u._id) === String(req.user._id)) {
    throw new ApiError(403, 'You cannot deactivate your own admin account');
  }

  u.active = req.body.active;
  await u.save();

  await logAdminAction({
    action: 'USER_STATUS_UPDATED',
    req,
    targetModel: 'User',
    targetId: String(u._id),
    description: `${req.body.active ? 'Activated' : 'Deactivated'} account for ${u.name} (${u.email})`,
    metadata: { active: u.active, role: u.role }
  });

  res.json({ user: u.toSafe() });
}));

// ==========================================
// 7. AUDIT LOGS
// ==========================================

router.get('/audit-logs', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.action) filter.action = req.query.action;
  if (req.query.targetModel) filter.targetModel = req.query.targetModel;

  const logs = await AuditLog.find(filter)
    .sort('-createdAt')
    .limit(Number(req.query.limit) || 100);

  res.json({ count: logs.length, logs });
}));

// Backward-compatible routes
router.get('/crops', asyncHandler(async (_req, res) => {
  res.json({ items: await Crop.find().populate('farmer', 'name state city').sort('-createdAt').limit(500) });
}));

router.get('/orders', asyncHandler(async (_req, res) => {
  res.json({ items: await Order.find().populate('farmer', 'name').populate('buyer', 'name').sort('-createdAt').limit(500) });
}));

export default router;
