import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true },
  message: { type: String, required: true },
  link: String,
  read: { type: Boolean, default: false },
  channels: {
    type: [String],
    enum: ['in_app', 'email', 'sms'],
    default: ['in_app']
  },
  emailStatus: {
    type: String,
    enum: ['none', 'simulated', 'sent', 'failed'],
    default: 'none'
  },
  smsStatus: {
    type: String,
    enum: ['none', 'simulated', 'sent', 'failed'],
    default: 'none'
  },
  recipientEmail: { type: String, default: '' },
  recipientPhone: { type: String, default: '' },
  emailSubject: { type: String, default: '' },
  severity: {
    type: String,
    enum: ['info', 'success', 'warning', 'critical'],
    default: 'info'
  },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

schema.index({ user: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.models.Notification || mongoose.model('Notification', schema);
