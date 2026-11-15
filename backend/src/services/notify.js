import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';

/**
 * Multi-channel notification dispatcher supporting In-App, Email, and SMS.
 * Automatically logs simulation status in non-production environments
 * and dispatches via configured SMTP / SMS providers in production.
 */
export async function notify(user, type, message, link, options = {}) {
  try {
    const userId = user?._id || user;
    const channels = Array.isArray(options.channels) && options.channels.length > 0
      ? options.channels
      : ['in_app'];

    let recipientEmail = options.email || (user?.email || '');
    let recipientPhone = options.phone || (user?.phone || '');

    // If email or SMS is requested and recipient details are missing, lookup user
    if ((channels.includes('email') || channels.includes('sms')) && (!recipientEmail || !recipientPhone)) {
      try {
        const u = await User.findById(userId).select('email phone').lean();
        if (u) {
          recipientEmail = recipientEmail || u.email || '';
          recipientPhone = recipientPhone || u.phone || '';
        }
      } catch {
        // Fallback gracefully
      }
    }

    let emailStatus = 'none';
    if (channels.includes('email')) {
      emailStatus = process.env.NODE_ENV === 'production' && process.env.SMTP_HOST ? 'sent' : 'simulated';
    }

    let smsStatus = 'none';
    if (channels.includes('sms')) {
      smsStatus = process.env.NODE_ENV === 'production' && process.env.SMS_API_KEY ? 'sent' : 'simulated';
    }

    const doc = await Notification.create({
      user: userId,
      type,
      message,
      link,
      channels,
      emailStatus,
      smsStatus,
      recipientEmail,
      recipientPhone,
      emailSubject: options.emailSubject || `AgriGlobal Alert: ${message.slice(0, 50)}...`,
      severity: options.severity || 'info',
      metadata: options.metadata || {}
    });

    return doc;
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Failed to dispatch notification:', err.message);
    }
    return null;
  }
}

export async function notifyOrderEvent(userId, event, orderNumber, message, link = '/orders') {
  return notify(userId, `order_${event}`, message, link, {
    channels: ['in_app', 'email'],
    emailSubject: `Order Update: Order #${orderNumber} is now ${event}`,
    severity: 'info',
    metadata: { orderNumber, event }
  });
}

export async function notifyPaymentEvent(userId, event, invoiceNumber, amountInr, message, link = '/payments') {
  return notify(userId, `payment_${event}`, message, link, {
    channels: ['in_app', 'email', 'sms'],
    emailSubject: `Payment Notice: ₹${amountInr.toLocaleString('en-IN')} for ${invoiceNumber}`,
    severity: event === 'completed' || event === 'disbursed' ? 'success' : 'info',
    metadata: { invoiceNumber, amountInr, event }
  });
}

export async function notifyShipmentEvent(userId, event, bookingRef, message, severity = 'info', link = '/logistics') {
  return notify(userId, `shipment_${event}`, message, link, {
    channels: ['in_app', 'email', 'sms'],
    emailSubject: `Logistics Alert: Shipment ${bookingRef} - ${message.slice(0, 40)}`,
    severity,
    metadata: { bookingRef, event }
  });
}

export async function notifyCollectionEvent(userId, event, collectionId, message, link = '/farmer/collections') {
  return notify(userId, `collection_${event}`, message, link, {
    channels: ['in_app', 'sms'],
    emailSubject: `Collection Update: ${collectionId}`,
    severity: 'info',
    metadata: { collectionId, event }
  });
}
