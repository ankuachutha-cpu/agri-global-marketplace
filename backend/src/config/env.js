import 'dotenv/config';
export const env = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agri_marketplace',
  jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-only-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  aiUrl: process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000',
  exchangeUrl: process.env.EXCHANGE_RATE_URL || 'https://open.er-api.com/v6/latest/INR',
  uploadStorage: process.env.UPLOAD_STORAGE || '',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_agriglobal_demo',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || 'secret_agriglobal_demo_key',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'webhook_secret_agriglobal_demo',
  platformCommissionPercent: Number(process.env.PLATFORM_COMMISSION_PERCENT || 5),
};
if (!env.jwtSecret) throw new Error('JWT_SECRET must be set in production');
