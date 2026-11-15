import mongoose from 'mongoose';
import crypto from 'node:crypto';

export const DEMAND_STATUSES = [
  'open',                 // Open for farmer contributions
  'partially_committed',  // Some contributions received, target not yet met
  'fully_committed',      // Target quantity 100% committed by farmers
  'in_aggregation',       // Aggregated into lot, undergoing collection/QC
  'fulfilled',            // Quality accepted, order placed/shipped
  'cancelled',            // Cancelled by buyer or admin
  'closed'                // Closed/expired
];

const contributionSchema = new mongoose.Schema({
  contributionId: { type: String, required: true }, // e.g. CONTR-2611-8492
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  farmerName: { type: String, required: true },
  farmerPhone: { type: String, default: '' },
  farmerLocation: { type: String, default: '' },
  farmerState: { type: String, default: '' },

  crop: { type: mongoose.Schema.Types.ObjectId, ref: 'Crop', required: true, index: true },
  cropName: { type: String, required: true },
  variety: { type: String, default: '' },
  grade: { type: String, enum: ['A', 'B', 'C', 'Ungraded'], default: 'A' },

  quantityKg: { type: Number, required: true, min: 0.1 },
  offeredPriceInr: { type: Number, required: true, min: 0 },
  grossValueInr: { type: Number, required: true, min: 0 },

  status: {
    type: String,
    enum: ['committed', 'collected', 'inspected', 'accepted', 'rejected', 'allocated_to_order', 'cancelled'],
    default: 'committed',
    index: true
  },

  committedAt: { type: Date, default: Date.now },
  inspectedAt: Date,
  inspectionNotes: { type: String, default: '' },
  acceptedQuantityKg: { type: Number, default: 0 },
  rejectedQuantityKg: { type: Number, default: 0 },

  aggregationLot: { type: mongoose.Schema.Types.ObjectId, ref: 'AggregationLot' },
  lotId: { type: String, default: '' },
  collectionRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectionRequest' }
}, { _id: true });

const demandSchema = new mongoose.Schema({
  demandId: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  buyerName: { type: String, required: true },
  buyerEmail: { type: String, required: true },
  buyerCountry: { type: String, required: true },
  buyerCompany: { type: String, default: '' },
  companyVerificationStatus: { type: String, enum: ['verified', 'unverified'], default: 'verified' },

  cropName: { type: String, required: true, trim: true, index: true },
  category: { type: String, default: 'Fruits' },
  variety: { type: String, trim: true, default: '' },
  
  requiredQuantity: { type: Number, required: true, min: 1 },
  unit: { type: String, enum: ['kg', 'quintal', 'tonne'], default: 'kg' },
  requiredQuantityKg: { type: Number, required: true, min: 1 },

  targetGrade: { type: String, enum: ['A', 'B', 'C', 'Ungraded', 'Any'], default: 'A' },
  targetPricePerKg: { type: Number, required: true, min: 0 },
  targetPriceUsd: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },

  destinationCountry: { type: String, required: true, trim: true },
  destinationPort: { type: String, required: true, trim: true },
  incoterms: { type: String, enum: ['CIF', 'FOB', 'CFR', 'EXW'], default: 'CIF' },
  packaging: { type: String, default: 'Standard export packaging / Reefer crates' },
  deliveryDeadline: { type: Date, required: true },
  certifications: [{ type: String }], // e.g. ['APEDA', 'Phytosanitary', 'GlobalGAP']

  // Live Aggregation & Contribution Tracking
  committedQuantityKg: { type: Number, default: 0, min: 0 },
  collectedQuantityKg: { type: Number, default: 0, min: 0 },
  acceptedQuantityKg: { type: Number, default: 0, min: 0 },
  remainingQuantityKg: { type: Number, required: true, min: 0 },
  fulfillmentPercentage: { type: Number, default: 0, min: 0, max: 100 },

  status: {
    type: String,
    enum: DEMAND_STATUSES,
    default: 'open',
    index: true
  },

  contributions: [contributionSchema],
  participatingFarmersCount: { type: Number, default: 0 },

  // Linkage with RFQ, AggregationLot and Purchase Order
  rfq: { type: mongoose.Schema.Types.ObjectId, ref: 'Rfq' },
  rfqNumber: { type: String, default: '' },
  aggregationLot: { type: mongoose.Schema.Types.ObjectId, ref: 'AggregationLot' },
  lotId: { type: String, default: '' },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },

  notes: { type: String, default: '' }
}, { timestamps: true });

demandSchema.index({ cropName: 1, status: 1 });
demandSchema.index({ buyer: 1, status: 1 });
demandSchema.index({ destinationCountry: 1, status: 1 });
demandSchema.index({ createdAt: -1 });

export function generateDemandId() {
  const d = new Date().toISOString().slice(2, 7).replace('-', '');
  const r = crypto.randomInt(1000, 9999);
  return `DEM-${d}-${r}`;
}

export function generateContributionId() {
  const d = new Date().toISOString().slice(2, 7).replace('-', '');
  const r = crypto.randomInt(1000, 9999);
  return `CONTR-${d}-${r}`;
}

export const BuyerDemand = mongoose.models.BuyerDemand || mongoose.model('BuyerDemand', demandSchema);
