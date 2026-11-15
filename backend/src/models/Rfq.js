import mongoose from 'mongoose';
import crypto from 'node:crypto';

export const RFQ_STATUSES = ['open', 'quoted', 'negotiating', 'accepted', 'fulfilled', 'cancelled'];

const quoteSchema = new mongoose.Schema({
  quoteId: { type: String, required: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  supplierName: { type: String, required: true },
  supplierRole: { type: String, default: 'exporter' },
  offeredQuantityKg: { type: Number, required: true, min: 1 },
  unitPriceInr: { type: Number, required: true, min: 0 },
  freightAndInsuranceInr: { type: Number, default: 0 },
  totalPriceInr: { type: Number, required: true },
  leadTimeDays: { type: Number, default: 14 },
  validUntil: { type: Date, default: () => new Date(Date.now() + 14 * 86400000) },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'countered'], default: 'pending' },
  counterPriceInr: { type: Number, default: null },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const rfqSchema = new mongoose.Schema({
  rfqNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  buyerName: { type: String, required: true },
  buyerEmail: { type: String, required: true },
  buyerCountry: { type: String, required: true },
  buyerCompany: { type: String, default: '' },
  
  cropName: { type: String, required: true, trim: true, index: true },
  category: { type: String, default: 'Vegetables' },
  quantity: { type: Number, required: true, min: 1 },
  unit: { type: String, enum: ['kg', 'quintal', 'tonne'], default: 'kg' },
  quantityInKg: { type: Number, required: true, min: 1 },
  grade: { type: String, enum: ['A', 'B', 'C', 'Ungraded', 'Any'], default: 'A' },
  
  targetPriceInr: { type: Number, default: null },
  currency: { type: String, default: 'USD' },
  deliveryDestination: { type: String, required: true },
  deliveryTerms: { type: String, enum: ['FOB', 'CIF', 'CFR', 'EXW'], default: 'CIF' },
  portOfDischarge: { type: String, default: '' },
  requiredByDate: { type: Date, required: true },
  
  packagingRequirements: { type: String, default: 'Standard export packaging / Reefer crates' },
  qualitySpecifications: { type: String, default: '' },
  
  status: { type: String, enum: RFQ_STATUSES, default: 'open', index: true },
  
  // Link to matching AggregationLot if auto-matched or assigned
  matchingLot: { type: mongoose.Schema.Types.ObjectId, ref: 'AggregationLot' },
  matchingLotId: { type: String, default: '' },
  
  quotes: [quoteSchema],
  acceptedQuoteId: { type: String, default: '' },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  
  notes: { type: String, default: '' }
}, { timestamps: true });

rfqSchema.index({ buyer: 1, status: 1 });
rfqSchema.index({ cropName: 1, status: 1 });

export function generateRfqNumber() {
  const d = new Date().toISOString().slice(2, 7).replace('-', '');
  const r = crypto.randomInt(1000, 9999);
  return `RFQ-${d}-${r}`;
}

export const Rfq = mongoose.models.Rfq || mongoose.model('Rfq', rfqSchema);
