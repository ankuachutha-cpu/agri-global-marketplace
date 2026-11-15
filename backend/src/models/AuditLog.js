import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true, trim: true, index: true },
  actor: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, default: 'Admin' },
    email: { type: String, default: '' },
    role: { type: String, default: 'admin' }
  },
  targetModel: {
    type: String,
    enum: ['AggregationLot', 'CollectionRequest', 'User', 'Order', 'Company', 'Crop', 'System', 'Shipment', 'Payment', 'Settlement', 'Rfq', 'BuyerDemand'],
    required: true,
    index: true
  },
  targetId: { type: String, default: '', index: true },
  description: { type: String, required: true, trim: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, default: '' }
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

export async function logAdminAction({ action, req, targetModel, targetId, description, metadata = {} }) {
  try {
    const actor = req?.user ? {
      id: req.user._id,
      name: req.user.name || 'Admin',
      email: req.user.email || '',
      role: req.user.role || 'admin'
    } : { name: 'System Admin', role: 'admin' };

    const ip = req?.ip || req?.headers?.['x-forwarded-for'] || '';

    return await AuditLog.create({
      action,
      actor,
      targetModel,
      targetId: String(targetId || ''),
      description,
      metadata,
      ip
    });
  } catch (err) {
    console.error('Failed to create audit log entry:', err);
    return null;
  }
}
