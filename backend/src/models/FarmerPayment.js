import mongoose from 'mongoose';
import crypto from 'node:crypto';

const farmerPaymentSchema = new mongoose.Schema({
  paymentId: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  farmerName: { type: String, required: true },
  cropName: { type: String, required: true, enum: ['Ragi', 'Rice', 'Jowar'] },
  buyerRequirement: { type: mongoose.Schema.Types.ObjectId, ref: 'BuyerRequirement', index: true },
  requirementId: { type: String, default: '' },
  allocationId: { type: String, default: '' },

  // Financial figures
  collectedQuantityKg: { type: Number, required: true, min: 0 },
  agreedPricePerKg: { type: Number, required: true, min: 0 },
  grossAmountInr: { type: Number, required: true, min: 0 },
  deductionsInr: { type: Number, default: 0, min: 0 },
  finalPayableAmountInr: { type: Number, required: true, min: 0 },

  status: {
    type: String,
    enum: ['pending', 'processing', 'completed'],
    default: 'pending',
    index: true
  },
  paymentMethod: { type: String, enum: ['UPI', 'NEFT'], default: 'UPI' },
  transactionRef: { type: String, default: '' },
  paymentDate: { type: Date },
  bankDetailsSnapshot: {
    accountHolderName: String,
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    upiId: String
  },
  notes: { type: String, default: '' }
}, { timestamps: true });

export function generatePaymentId() {
  const d = new Date().toISOString().slice(2, 7).replace('-', '');
  const r = crypto.randomInt(1000, 9999);
  return `PAY-${d}-${r}`;
}

export const FarmerPayment = mongoose.models.FarmerPayment || mongoose.model('FarmerPayment', farmerPaymentSchema);
