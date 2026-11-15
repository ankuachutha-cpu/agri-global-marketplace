import mongoose from 'mongoose';
import crypto from 'node:crypto';

export const PAYMENT_METHODS = ['razorpay', 'upi', 'neft_rtgs', 'card', 'bank_transfer', 'wire'];
export const PAYMENT_STATUSES = ['created', 'processing', 'completed', 'failed', 'refunded', 'cancelled'];
export const PAYMENT_PURPOSES = ['order_purchase', 'milestone_deposit', 'milestone_release', 'farmer_payout', 'export_lot_allocation'];

const paymentSchema = new mongoose.Schema({
  paymentId: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  gatewayOrderId: { type: String, index: true, sparse: true },
  gatewayPaymentId: { type: String, index: true, sparse: true },
  gatewaySignature: { type: String },

  payer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  payerName: { type: String, default: '' },
  payerEmail: { type: String, default: '' },
  payerCountry: { type: String, default: '' },

  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  recipientName: { type: String, default: 'AgriGlobal Marketplace' },

  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
  invoiceNumber: { type: String, index: true },
  aggregationLot: { type: mongoose.Schema.Types.ObjectId, ref: 'AggregationLot', index: true },
  lotId: { type: String, index: true },

  purpose: { type: String, enum: PAYMENT_PURPOSES, default: 'order_purchase' },
  
  // Amounts and currency
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, default: 'INR' },
  amountInr: { type: Number, required: true, min: 0.01 },
  exchangeRate: { type: Number, default: 1.0 },

  // 5% Platform Commission
  platformCommissionPercent: { type: Number, default: 5 },
  platformCommissionInr: { type: Number, default: 0 },
  netDisbursalInr: { type: Number, default: 0 },

  paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'razorpay' },
  status: { type: String, enum: PAYMENT_STATUSES, default: 'created', index: true },

  receiptNumber: { type: String, unique: true, sparse: true, index: true },
  idempotencyKey: { type: String, unique: true, sparse: true, index: true },

  // Milestone Escrow Tracking
  milestoneStage: {
    type: String,
    enum: ['none', 'initial_deposit', 'in_transit_funded', 'customs_cleared', 'delivery_completed'],
    default: 'none'
  },
  milestoneReleased: { type: Boolean, default: false },
  milestoneReleasedAt: Date,

  // Refund Tracking
  refund: {
    refundId: { type: String, sparse: true },
    amountInr: { type: Number, default: 0 },
    reason: { type: String, default: '' },
    status: { type: String, enum: ['none', 'requested', 'processed', 'failed'], default: 'none' },
    processedAt: Date,
    gatewayRefundId: String
  },

  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  notes: { type: String, default: '' },
  paidAt: Date
}, { timestamps: true });

paymentSchema.index({ payer: 1, status: 1 });
paymentSchema.index({ createdAt: -1 });

export function generatePaymentId() {
  const d = new Date().toISOString().slice(2, 7).replace('-', '');
  const r = crypto.randomInt(1000, 9999);
  return `PAY-${d}-${r}`;
}

export function generateReceiptNumber() {
  const d = new Date().toISOString().slice(2, 7).replace('-', '');
  const r = crypto.randomInt(1000, 9999);
  return `REC-${d}-${r}`;
}

export function generateRefundNumber() {
  const d = new Date().toISOString().slice(2, 7).replace('-', '');
  const r = crypto.randomInt(1000, 9999);
  return `REF-${d}-${r}`;
}

export const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
