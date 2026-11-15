import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { env } from './config/env.js';
import { sanitize, notFound, errorHandler } from './middleware/http.js';
import { UPLOAD_DIR, useGridFs } from './middleware/upload.js';
import { openImage } from './services/filestore.js';
import auth from './routes/auth.js';
import crops from './routes/crops.js';
import { orders, cart } from './routes/orders.js';
import { companies, enquiries } from './routes/companies.js';
import { notifications, currency, ai, admin } from './routes/misc.js';
import { centers, guides } from './routes/reference.js';
import { globalBuyers, buyingRequests } from './routes/globalBuyers.js';
import aggregation from './routes/aggregation.js';
import collections from './routes/collections.js';
import rfqs from './routes/rfq.js';
import buyer from './routes/buyer.js';
import logistics from './routes/logistics.js';
import payments from './routes/payments.js';
import analytics from './routes/analytics.js';
import demands from './routes/demands.js';
import requirements from './routes/requirements.js';
import farmerPortal from './routes/farmerPortal.js';
import buyerPortal from './routes/buyerPortal.js';
import adminPortal from './routes/adminPortal.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  const origins = env.clientOrigin.split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors({ origin: origins.length ? origins : true, credentials: false }));
  app.use(express.json({ limit: '100kb' }));
  app.use(sanitize);
  if (process.env.NODE_ENV !== 'test') {
    // Rate limits stay on, but the defaults are high enough that normal local use
    // (registering, logging in, demoing) never locks the app out. Override with
    // RATE_LIMIT_MAX / AUTH_RATE_LIMIT_MAX if you need stricter values.
    const windowMs = 15 * 60 * 1000;
    app.use(rateLimit({ windowMs, limit: Number(process.env.RATE_LIMIT_MAX || 3000), standardHeaders: true, legacyHeaders: false }));
    app.use('/api/auth', rateLimit({
      windowMs, limit: Number(process.env.AUTH_RATE_LIMIT_MAX || 300), standardHeaders: true, legacyHeaders: false,
      message: { message: 'Too many authentication attempts. Please wait a few minutes and try again.' },
    }));
    app.use('/api/payments', rateLimit({
      windowMs, limit: Number(process.env.PAYMENT_RATE_LIMIT_MAX || 600), standardHeaders: true, legacyHeaders: false,
      message: { message: 'Too many payment requests. Please try again shortly.' },
    }));
  }
  app.use('/uploads', express.static(UPLOAD_DIR, { setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff') }));
  if (useGridFs) {
    // Static missed (ephemeral disk), so read the image back from MongoDB GridFS.
    app.get('/uploads/:name', (req, res) => {
      let stream;
      try { stream = openImage(path.basename(req.params.name)); }
      catch { res.status(404).json({ message: 'Image not found' }); return; }
      res.setHeader('X-Content-Type-Options', 'nosniff');
      stream.on('file', (f) => { if (f?.contentType && !res.headersSent) res.setHeader('Content-Type', f.contentType); });
      stream.on('error', () => { if (!res.headersSent) res.status(404).json({ message: 'Image not found' }); else res.end(); });
      stream.pipe(res);
    });
  }
  app.get('/api/health', (_req, res) => res.json({
    status: 'ok',
    service: 'agri-global-marketplace-api',
    version: '2.9.0',
    database: mongoose.connection?.readyState === 1 ? 'connected' : 'disconnected',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  }));
  app.use('/api/auth', auth);
  app.use('/api/crops', crops);
  app.use('/api/orders', orders);
  app.use('/api/cart', cart);
  app.use('/api/companies', companies);
  app.use('/api/enquiries', enquiries);
  app.use('/api/notifications', notifications);
  app.use('/api/currency', currency);
  app.use('/api/ai', ai);
  app.use('/api/admin', adminPortal);
  app.use('/api/admin-portal', adminPortal);
  app.use('/api/global-buyers', globalBuyers);
  app.use('/api/buying-requests', buyingRequests);
  app.use('/api/collection-centers', centers);
  app.use('/api/export-guides', guides);
  app.use('/api/aggregation', aggregation);
  app.use('/api/collections', collections);
  app.use('/api/rfqs', rfqs);
  app.use('/api/buyer', buyerPortal);
  app.use('/api/logistics', logistics);
  app.use('/api/payments', payments);
  app.use('/api/analytics', analytics);
  app.use('/api/demands', demands);
  app.use('/api/requirements', requirements);
  app.use('/api/farmer', farmerPortal);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
