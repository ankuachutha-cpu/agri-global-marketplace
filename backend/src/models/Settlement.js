import mongoose from 'mongoose';
import crypto from 'node:crypto';

const settlementSchema = new mongoose.Schema({
  settlementId: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  farmerName: { type: String, required: true },
  
  collectionRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectionRequest', index: true },
  collectionId: { type: String, index: true },
  aggregationLot: { type: mongoose.Schema.Types.ObjectId, ref: 'AggregationLot', index: true },
  lotId: { type: String, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },

  cropName: { type: String, default: 'Produce' },
  acceptedQuantityKg: { type: Number, required: true, min: 0.1 },
  ratePerKg: { type: Number, required: true, min: 0 },

  grossPayableInr: { type: Number, required: true },
  platformCommissionPercent: { type: Number, default: 5 },
  platformCommissionInr: { type: Number, default: 0 },
  netPayoutInr: { type: Number, required: true },

  paymentMethod: { type: String, enum: ['UPI', 'NEFT', 'RTGS', 'IMPS'], default: 'UPI' },
  
  beneficiaryDetails: {
    accountHolderName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
    bankName: { type: String, default: '' },
    upiId: { type: String, default: '' }
  },

  transactionReference: { type: String, required: true, trim: true, index: true },
  idempotencyKey: { type: String, required: true, unique: true, index: true },
  
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'completed', index: true },
  settledAt: { type: Date, default: Date.now },
  notes: { type: String, default: '' },
  disbursedBy: { type: String, default: 'AgriGlobal Treasury' }
}, { timestamps: true });

settlementSchema.index({ farmer: 1, status: 1 });
settlementSchema.index({ settledAt: -1 });

export function generateSettlementId() {
  const d = new Date().toISOString().slice(2, 7).replace('-', '');
  const r = crypto.randomInt(1000, 9999);
  return `SET-${d}-${r}`;
}

export function generateUtr() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const r = crypto.randomInt(100000, 999999);
  return `UTR-${d}-${r}`;
}

export const Settlement = mongoose.models.Settlement || mongoose.model('Settlement', settlementSchema);
