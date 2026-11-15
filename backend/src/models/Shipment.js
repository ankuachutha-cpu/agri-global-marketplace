import mongoose from 'mongoose';
import crypto from 'node:crypto';

export const CONTAINER_SPECS = {
  '20ft Reefer': { maxCapacityKg: 22000, volumeCbm: 28, teu: 1.0, defaultTemp: 4.0 },
  '40ft Reefer': { maxCapacityKg: 26000, volumeCbm: 58, teu: 2.0, defaultTemp: 4.0 },
  '40ft High Cube Reefer': { maxCapacityKg: 29000, volumeCbm: 67, teu: 2.0, defaultTemp: 4.0 }
};

export const SHIPMENT_MILESTONES = [
  'booked',
  'container_allocated',
  'loaded_at_port',
  'in_transit',
  'customs_clearance',
  'arrived_at_destination',
  'delivered',
  'cancelled'
];

export const EXPORT_DOCUMENT_TYPES = [
  'phytosanitary_certificate',
  'certificate_of_origin',
  'commercial_invoice',
  'packing_list',
  'bill_of_lading',
  'quality_lab_certificate'
];

const timelineEventSchema = new mongoose.Schema({
  status: { type: String, enum: SHIPMENT_MILESTONES, required: true },
  location: { type: String, default: '' },
  description: { type: String, default: '' },
  recordedAt: { type: Date, default: Date.now },
  recordedBy: { type: String, default: 'Logistics System' }
}, { _id: true });

const telemetryLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now, index: true },
  temperature: { type: Number, required: true }, // in °C
  humidity: { type: Number, required: true },    // in %
  powerStatus: { type: String, enum: ['connected', 'genset', 'battery', 'interrupted'], default: 'connected' },
  batteryPercent: { type: Number, default: 100 },
  ambientTemperature: { type: Number, default: 28 },
  sensorId: { type: String, default: 'REEFER-IOT-01' },
  location: { type: String, default: 'In Transit' },
  recordedBy: { type: String, default: 'ColdChain-Logger' }
}, { _id: true });

const coldChainAlertSchema = new mongoose.Schema({
  alertId: { type: String, required: true },
  severity: { type: String, enum: ['warning', 'critical'], default: 'warning' },
  type: { type: String, enum: ['temperature_high', 'temperature_low', 'power_failure', 'humidity_exceeded'], required: true },
  message: { type: String, required: true },
  reading: { type: Number },
  threshold: { type: Number },
  timestamp: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false },
  resolvedAt: Date,
  resolutionNotes: { type: String, default: '' }
}, { _id: true });

const exportDocumentSchema = new mongoose.Schema({
  docType: { type: String, enum: EXPORT_DOCUMENT_TYPES, required: true },
  title: { type: String, required: true },
  docNumber: { type: String, default: '' },
  issuingAuthority: { type: String, default: '' },
  issueDate: { type: Date, default: Date.now },
  validUntil: Date,
  status: { type: String, enum: ['pending', 'drafted', 'issued', 'verified', 'rejected'], default: 'pending' },
  fileUrl: { type: String, default: '' },
  verificationNotes: { type: String, default: '' },
  verifiedAt: Date,
  verifiedBy: { type: String, default: '' }
}, { _id: true });

const shipmentSchema = new mongoose.Schema({
  shipmentNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  bookingReference: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  
  // Linkages to existing entities
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
  invoiceNumber: { type: String, index: true },
  aggregationLot: { type: mongoose.Schema.Types.ObjectId, ref: 'AggregationLot', index: true },
  lotId: { type: String, index: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  buyerName: { type: String, default: '' },
  buyerCountry: { type: String, default: '' },
  exporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  exporterName: { type: String, default: 'AgriGlobal Hub' },

  // Cargo Specifications
  cropName: { type: String, required: true },
  category: { type: String, default: 'Vegetables' },
  grade: { type: String, default: 'A' },
  totalWeightKg: { type: Number, required: true, min: 1 },
  packageCount: { type: Number, default: 0 },
  packageType: { type: String, default: 'Export Ventilated Cartons' },

  // Container Management
  containerType: {
    type: String,
    enum: ['20ft Reefer', '40ft Reefer', '40ft High Cube Reefer'],
    default: '40ft High Cube Reefer'
  },
  containerCapacityKg: { type: Number, default: 29000 },
  containerId: { type: String, trim: true, uppercase: true, default: '' },
  sealNumber: { type: String, trim: true, uppercase: true, default: '' },
  allocatedWeightKg: { type: Number, required: true, min: 0 },
  tareWeightKg: { type: Number, default: 4500 },
  grossWeightKg: { type: Number, default: 0 },
  temperatureSetpoint: { type: Number, default: 4.0 }, // °C
  temperatureMinAllowed: { type: Number, default: 2.0 },
  temperatureMaxAllowed: { type: Number, default: 6.0 },
  humiditySetpoint: { type: Number, default: 85 },     // %
  ventilationCmh: { type: Number, default: 15 },        // m3/hour fresh air exchange
  containerStatus: {
    type: String,
    enum: ['unallocated', 'allocated', 'stuffed', 'sealed', 'gated_in', 'on_board', 'cleared', 'delivered'],
    default: 'unallocated'
  },

  // Carrier & Route Details
  shippingLine: { type: String, default: 'Maersk Line' },
  vesselName: { type: String, default: 'Maersk Mc-Kinney' },
  voyageNumber: { type: String, default: '2611W' },
  billOfLadingNumber: { type: String, default: '' },
  originPort: { type: String, default: 'JNPT Mumbai (Nhava Sheva)' },
  destinationPort: { type: String, required: true },
  destinationCountry: { type: String, default: '' },
  departureDate: { type: Date, default: () => new Date(Date.now() + 3 * 86400000) }, // ETD
  actualDepartureDate: Date, // ATD
  estimatedArrivalDate: { type: Date, default: () => new Date(Date.now() + 18 * 86400000) }, // ETA
  actualArrivalDate: Date, // ATA

  // Status & Milestones
  status: {
    type: String,
    enum: SHIPMENT_MILESTONES,
    default: 'booked',
    index: true
  },
  timeline: [timelineEventSchema],

  // Cold Chain Telemetry & Alerts
  telemetryLogs: [telemetryLogSchema],
  coldChainAlerts: [coldChainAlertSchema],
  hasActiveAlerts: { type: Boolean, default: false },

  // Export Documents
  documents: [exportDocumentSchema],

  // Customs Clearances
  originCustoms: {
    shippingBillNumber: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'inspected', 'cleared', 'held'], default: 'pending' },
    clearedAt: Date,
    inspectionRemarks: { type: String, default: '' }
  },
  destinationCustoms: {
    billOfEntryNumber: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'duty_assessed', 'cleared', 'held'], default: 'pending' },
    dutyAmountPaid: { type: Number, default: 0 },
    clearedAt: Date,
    remarks: { type: String, default: '' }
  },

  // Proof of Delivery (POD)
  proofOfDelivery: {
    recipientName: { type: String, default: '' },
    receivedQuantityKg: { type: Number, default: 0 },
    conditionOnArrival: {
      type: String,
      enum: ['Pending', 'Excellent - Cold Chain Maintained', 'Good', 'Minor Temperature Deviation', 'Damaged', 'Rejected'],
      default: 'Pending'
    },
    acknowledgmentRef: { type: String, default: '' },
    deliveredAt: Date,
    remarks: { type: String, default: '' }
  },

  notes: { type: String, default: '' }
}, { timestamps: true });

shipmentSchema.index({ buyer: 1, status: 1 });
shipmentSchema.index({ containerId: 1 });

export function generateShipmentNumber() {
  const d = new Date().toISOString().slice(2, 7).replace('-', '');
  const r = crypto.randomInt(1000, 9999);
  return `SHP-${d}-${r}`;
}

export function generateBookingReference() {
  const d = new Date().toISOString().slice(2, 7).replace('-', '');
  const r = crypto.randomInt(1000, 9999);
  return `BK-${d}-${r}`;
}

export const Shipment = mongoose.models.Shipment || mongoose.model('Shipment', shipmentSchema);
