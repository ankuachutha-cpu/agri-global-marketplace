import mongoose from 'mongoose';

export const COLLECTION_STATUSES = [
  'scheduled',         // Pickup scheduled
  'in_transit',        // Vehicle dispatched
  'inspected_at_farm', // Weighed & QC tested at farm
  'delivered_to_hub',  // Reached aggregation collection center
  'accepted',          // Approved & merged into container lot
  'rejected',          // Rejected during QC inspection
  'cancelled'          // Cancelled
];

export const PAYMENT_STATUSES = [
  'pending',     // Awaiting pickup & QC
  'processing',  // Approved, payment queued
  'paid',        // Paid to farmer
  'failed'       // Transfer failed
];

const timelineItemSchema = new mongoose.Schema({
  status: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  note: { type: String, default: '' },
  actor: { type: String, default: 'System' }
}, { _id: false });

const collectionRequestSchema = new mongoose.Schema({
  collectionId: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  crop: { type: mongoose.Schema.Types.ObjectId, ref: 'Crop', required: true, index: true },
  cropName: { type: String, required: true, trim: true },
  grade: { type: String, enum: ['A', 'B', 'C', 'Ungraded'], default: 'A' },
  
  // Link to bulk aggregation lot if aggregated
  aggregationLot: { type: mongoose.Schema.Types.ObjectId, ref: 'AggregationLot' },
  lotId: { type: String, trim: true, default: '' },
  
  // Regional collection center
  collectionCenter: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectionCenter' },
  centerName: { type: String, trim: true, default: '' },
  
  // Scheduling & Location
  scheduledDate: { type: Date, required: true, default: () => new Date(Date.now() + 48 * 3600 * 1000) },
  pickupAddress: { type: String, required: true, trim: true },
  coordinates: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null }
  },
  pickupContactPhone: { type: String, trim: true, default: '' },
  
  // Quantities in KG
  estimatedQuantityKg: { type: Number, required: true, min: 0.1 },
  acceptedQuantityKg: { type: Number, default: null },
  rejectedQuantityKg: { type: Number, default: 0 },
  
  // Pricing & Payouts in INR
  unitPriceInr: { type: Number, required: true, min: 0 },
  totalEstimatedPayoutInr: { type: Number, required: true, min: 0 },
  totalFinalPayoutInr: { type: Number, default: null },
  
  status: { type: String, enum: COLLECTION_STATUSES, default: 'scheduled', index: true },
  
  // On-site / Hub QC Inspection
  qualityInspection: {
    inspectorName: { type: String, default: '' },
    inspectedAt: Date,
    moisturePercent: Number,
    gradeAssigned: String,
    passed: { type: Boolean, default: null },
    notes: { type: String, default: '' }
  },
  
  // Farmer Payment Details
  paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'pending', index: true },
  paymentReference: { type: String, trim: true, default: '' },
  paidAt: Date,
  
  notes: { type: String, trim: true, default: '' },
  timeline: [timelineItemSchema]
}, { timestamps: true });

collectionRequestSchema.index({ farmer: 1, status: 1 });
collectionRequestSchema.index({ aggregationLot: 1 });

export const CollectionRequest = mongoose.models.CollectionRequest || mongoose.model('CollectionRequest', collectionRequestSchema);
