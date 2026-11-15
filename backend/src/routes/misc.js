import { Router } from 'express';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { Crop } from '../models/Crop.js';
import { Order } from '../models/Order.js';
import { Company } from '../models/Company.js';
import { asyncHandler, ApiError, validate, objectId } from '../middleware/http.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getRates, convertFromInr, SUPPORTED } from '../services/currency.js';
import { aiPriceSchema, aiCropSchema, aiDemandSchema, aiDestinationSchema, aiMatchSchema, aiQualitySchema } from '../validators/schemas.js';
import { env } from '../config/env.js';
import {
  predictInternationalDemand,
  recommendExportDestinations,
  smartMatchFarmerBuyer,
  analyzeCropQuality,
  COMMODITY_PROFILES
} from '../services/aiIntelligence.js';
export const notifications = Router();
notifications.use(authenticate);
notifications.get('/', asyncHandler(async (req, res) => {
  const [items, unread] = await Promise.all([Notification.find({ user: req.user._id }).sort('-createdAt').limit(100), Notification.countDocuments({ user: req.user._id, read: false })]);
  res.json({ items, unread });
}));
notifications.post('/read-all', asyncHandler(async (req, res) => { await Notification.updateMany({ user: req.user._id, read: false }, { read: true }); res.json({ message: 'ok' }); }));
notifications.patch('/:id/read', asyncHandler(async (req, res) => {
  if (!objectId.safeParse(req.params.id).success) throw new ApiError(404, 'Not found');
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { read: true }, { new: true });
  if (!n) throw new ApiError(404, 'Not found'); res.json({ notification: n });
}));

export const currency = Router();
currency.get('/rates', asyncHandler(async (_req, res) => {
  const r = await getRates();
  if (!r) return res.json({ available: false, base: 'INR', message: 'Exchange rates unavailable; showing INR prices.' });
  res.json({ available: true, ...r });
}));
currency.get('/convert', asyncHandler(async (req, res) => {
  const amount = Number(req.query.amount), to = String(req.query.to || '');
  if (!(amount >= 0) || !SUPPORTED.includes(to)) throw new ApiError(400, 'Invalid amount or currency');
  const r = await getRates(); const value = r ? convertFromInr(amount, to, r.rates) : null;
  res.json(value === null ? { available: false, amountInr: amount } : { available: true, amountInr: amount, currency: to, value, fetchedAt: r.fetchedAt, source: r.source });
}));

export const ai = Router();
let aiFetch = (...a) => fetch(...a);
export const setAiFetch = (fn) => { aiFetch = fn; };
async function forward(path, body, res) {
  try {
    const r = await aiFetch(`${env.aiUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    const data = await r.json().catch(() => ({}));
    if (r.ok) return res.json(data);
    const detail = typeof data.detail === 'string' ? data.detail : null;
    if (r.status === 503) return res.status(503).json({ message: detail || 'AI model is not trained yet', code: 'MODEL_NOT_TRAINED' });
    if (r.status === 422) return res.status(422).json({ message: detail || 'The AI service rejected this input', code: 'BAD_INPUT' });
    return res.status(502).json({ message: 'AI service returned an unexpected error', code: 'AI_ERROR' });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') console.error(`AI service unreachable at ${env.aiUrl}: ${err.cause?.code || err.message}`);
    return res.status(503).json({ message: 'AI service is currently unavailable (cannot be reached by the backend). Make sure it is running on the configured AI_SERVICE_URL.', code: 'AI_UNREACHABLE' });
  }
}
ai.use(authenticate);
ai.get('/status', asyncHandler(async (_req, res) => {
  try { const r = await aiFetch(`${env.aiUrl}/health`, { signal: AbortSignal.timeout(5000) }); res.json({ reachable: true, ...(await r.json()) }); }
  catch { res.json({ reachable: false, models: {} }); }
}));

// Phase 8 AI Intelligence Endpoints (Available to Farmer, Buyer, Admin)
ai.post('/demand-forecast', validate(aiDemandSchema), asyncHandler(async (req, res) => {
  const result = await predictInternationalDemand(req.body);
  res.json(result);
}));

ai.post('/destination-recommendations', validate(aiDestinationSchema), asyncHandler(async (req, res) => {
  const result = await recommendExportDestinations(req.body);
  res.json(result);
}));

ai.post('/smart-matching', validate(aiMatchSchema), asyncHandler(async (req, res) => {
  const result = await smartMatchFarmerBuyer({ ...req.body, userRole: req.user.role });
  res.json(result);
}));

ai.post('/quality-analysis', validate(aiQualitySchema), asyncHandler(async (req, res) => {
  const result = await analyzeCropQuality(req.body);
  res.json(result);
}));

ai.get('/market-intelligence', asyncHandler(async (_req, res) => {
  res.json({
    commodities: Object.keys(COMMODITY_PROFILES).map((key) => ({
      name: key,
      ...COMMODITY_PROFILES[key]
    }))
  });
}));

ai.use(requireRole('farmer'));
ai.post('/price-prediction', validate(aiPriceSchema), (req, res) => forward('/predict/price', req.body, res));
ai.post('/crop-recommendation', validate(aiCropSchema), (req, res) => forward('/recommend/crop', req.body, res));

export { default as admin } from './admin.js';
