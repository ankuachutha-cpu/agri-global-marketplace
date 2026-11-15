import mongoose from 'mongoose';
import crypto from 'node:crypto';

export const STATUSES = ['Pending', 'Accepted', 'Rejected', 'Confirmed', 'Ready for Collection', 'In Transit', 'Completed', 'Cancelled'];

const orderSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  crop: { type: mongoose.Schema.Types.ObjectId, ref: 'Crop', required: true },
  cropName: String,
  quantity: { type: Number, required: true, min: 0.001 },
  unit: String,
  unitPriceInr: { type: Number, required: true },
  totalInr: { type: Number, required: true },
  buyerCountry: String,
  buyerCurrency: String,
  note: { type: String, maxlength: 1000 },
  status: { type: String, enum: STATUSES, default: 'Pending' },
  stockRestored: { type: Boolean, default: false },
  idempotencyKey: { type: String, required: true },

  // Commercial Export & RFQ Linkage
  invoiceNumber: { type: String, unique: true, sparse: true },
  rfq: { type: mongoose.Schema.Types.ObjectId, ref: 'Rfq' },
  rfqNumber: String,
  aggregationLot: { type: mongoose.Schema.Types.ObjectId, ref: 'AggregationLot' },
  lotId: String,

  // Shipping & Logistics Tracking
  containerId: String,
  sealNumber: String,
  destinationPort: String,
  deliveryTerms: { type: String, default: 'CIF' },
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'failed', 'refunded', 'milestone_escrow'],
    default: 'pending'
  },
  paymentReference: String,
  paidAt: Date,
  receiptNumber: String,
  platformCommissionPercent: { type: Number, default: 5 },
  platformCommissionInr: { type: Number, default: 0 },
  netFarmerDisbursalInr: { type: Number, default: 0 },

  milestones: [{
    stage: { type: String, enum: ['initial_deposit', 'in_transit_funded', 'customs_cleared', 'delivery_completed'] },
    percentage: Number,
    amountInr: Number,
    status: { type: String, enum: ['pending', 'funded', 'released'], default: 'pending' },
    releasedAt: Date,
    releaseReference: String
  }],

  refund: {
    refundId: String,
    amountInr: Number,
    reason: String,
    status: { type: String, enum: ['none', 'requested', 'processed', 'failed'], default: 'none' },
    refundedAt: Date
  },

  shipmentTracking: {
    status: { type: String, default: 'pending' },
    carrier: { type: String, default: '' },
    vesselName: { type: String, default: '' },
    trackingNumber: { type: String, default: '' },
    eta: Date
  }
}, { timestamps: true });

orderSchema.index({ buyer: 1, idempotencyKey: 1 }, { unique: true });
orderSchema.index({ buyer: 1, status: 1 });
orderSchema.index({ rfq: 1 });

export function generateInvoiceNumber() {
  const d = new Date().toISOString().slice(2, 7).replace('-', '');
  const r = crypto.randomInt(1000, 9999);
  return `INV-${d}-${r}`;
}

export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
