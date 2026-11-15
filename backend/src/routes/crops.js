import { Router } from 'express';
import { Crop } from '../models/Crop.js';
import { Order } from '../models/Order.js';
import { asyncHandler, ApiError, validate, objectId } from '../middleware/http.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { uploadImages, removeFiles } from '../middleware/upload.js';
import { cropSchema, cropUpdateSchema, cropQuerySchema, sellOfferSchema } from '../validators/schemas.js';
import { notify } from '../services/notify.js';
import { normaliseCropName, toKg } from '../services/aggregation.js';
const r = Router();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const urls = (files = []) => files.map((f) => `/uploads/${f.filename}`);

/**
 * MODULE 1: DYNAMIC GLOBAL CROP SELL MARKETPLACE
 * Automatically aggregates and discovers EVERY distinct crop available in MongoDB.
 * Never hardcodes crops. Dynamically updates when new crops are added.
 */
r.get('/marketplace/dynamic-crops', asyncHandler(async (req, res) => {
  const { q, category } = req.query;
  const match = { status: 'available', quantity: { $gt: 0 } };
  if (category) match.category = category;
  if (q) match.$or = [{ name: new RegExp(esc(q), 'i') }, { description: new RegExp(esc(q), 'i') }];

  const crops = await Crop.find(match).populate('farmer', 'name state country').lean();

  // Dynamically group by normalised crop name
  const cropMap = {};
  for (const c of crops) {
    const norm = normaliseCropName(c.name);
    if (!cropMap[norm]) {
      cropMap[norm] = {
        cropName: norm,
        category: c.category,
        totalQuantityKg: 0,
        allocatedQuantityKg: 0,
        freeStockKg: 0,
        listingsCount: 0,
        prices: [],
        grades: new Set(),
        varieties: new Set(),
        states: new Set(),
        images: [],
        farmers: new Set(),
        organicCertifiedCount: 0
      };
    }

    const group = cropMap[norm];
    const qtyKg = toKg(c.quantity, c.unit || 'kg');
    const allocKg = toKg(c.allocatedQuantity || 0, c.unit || 'kg');
    const freeKg = Math.max(0, qtyKg - allocKg);

    group.totalQuantityKg += qtyKg;
    group.allocatedQuantityKg += allocKg;
    group.freeStockKg += freeKg;
    group.listingsCount++;
    group.prices.push(c.priceInr);
    if (c.grade) group.grades.add(c.grade);
    if (c.variety) group.varieties.add(c.variety);
    if (c.state) group.states.add(c.state);
    if (c.images?.length) group.images.push(...c.images);
    if (c.farmer) group.farmers.add(String(c.farmer._id || c.farmer));
    if (c.organicCertified) group.organicCertifiedCount++;
  }

  const dynamicCrops = Object.values(cropMap).map((item) => {
    const minPrice = item.prices.length ? Math.min(...item.prices) : 0;
    const maxPrice = item.prices.length ? Math.max(...item.prices) : 0;
    const avgPrice = item.prices.length ? Math.round(item.prices.reduce((a, b) => a + b, 0) / item.prices.length) : 0;
    const hasGradeA = item.grades.has('A');

    return {
      cropName: item.cropName,
      category: item.category,
      totalQuantityKg: item.totalQuantityKg,
      totalQuantityMt: Math.round(item.totalQuantityKg / 1000),
      allocatedQuantityKg: item.allocatedQuantityKg,
      freeStockKg: item.freeStockKg,
      freeStockMt: Math.round(item.freeStockKg / 1000),
      listingsCount: item.listingsCount,
      minPriceInr: minPrice,
      maxPriceInr: maxPrice,
      avgPriceInr: avgPrice,
      gradesAvailable: Array.from(item.grades),
      varietiesAvailable: Array.from(item.varieties),
      exportSuitability: hasGradeA ? 'High Export Grade (Grade A Certified)' : 'Standard Commercial Export',
      organicCertified: item.organicCertifiedCount > 0,
      uniqueFarmersCount: item.farmers.size,
      originStates: Array.from(item.states),
      images: Array.from(new Set(item.images)).slice(0, 3)
    };
  }).sort((a, b) => b.totalQuantityKg - a.totalQuantityKg);

  res.json({
    totalDistinctCrops: dynamicCrops.length,
    crops: dynamicCrops
  });
}));

/**
 * MODULE 1: DETAILED FARMER LISTINGS FILTERABLE BY GRADE, VARIETY, LOCATION, PRICE
 */
r.get('/marketplace/listings', asyncHandler(async (req, res) => {
  const { crop, variety, grade, state, minPrice, maxPrice, page = 1, limit = 20 } = req.query;
  const f = { status: 'available', quantity: { $gt: 0 } };

  if (crop) f.name = new RegExp(esc(crop.trim()), 'i');
  if (variety) f.variety = new RegExp(esc(variety.trim()), 'i');
  if (grade) f.grade = grade;
  if (state) f.state = new RegExp(`^${esc(state.trim())}$`, 'i');
  if (minPrice !== undefined || maxPrice !== undefined) {
    f.priceInr = {
      ...(minPrice !== undefined && { $gte: Number(minPrice) }),
      ...(maxPrice !== undefined && { $lte: Number(maxPrice) })
    };
  }

  const p = Math.max(1, Number(page));
  const l = Math.min(50, Math.max(1, Number(limit)));

  const [items, total] = await Promise.all([
    Crop.find(f).populate('farmer', 'name city state country').sort('-createdAt').skip((p - 1) * l).limit(l).lean(),
    Crop.countDocuments(f)
  ]);

  const mapped = items.map((c) => ({
    ...c,
    freeStockKg: Math.max(0, c.quantity - (c.allocatedQuantity || 0)),
    reservedStockKg: c.allocatedQuantity || 0,
    exportSuitability: c.grade === 'A' ? 'Premium Export Suitable' : 'Standard Commercial'
  }));

  res.json({ items: mapped, total, page: p, pages: Math.ceil(total / l) });
}));

/**
 * MODULE 2: FARMER SELL OFFERS
 */
r.post('/:id/sell-offer', authenticate, requireRole('farmer'), validate(sellOfferSchema), asyncHandler(async (req, res) => {
  const crop = await Crop.findOne({ _id: req.params.id, farmer: req.user._id });
  if (!crop) throw new ApiError(404, 'Crop listing not found');

  crop.offerPriceInr = req.body.offerPriceInr;
  if (req.body.minOrderQuantityKg) crop.minOrderQuantityKg = req.body.minOrderQuantityKg;
  if (req.body.packagingType) crop.packagingType = req.body.packagingType;
  if (req.body.grade) crop.grade = req.body.grade;
  crop.offerStatus = req.body.offerStatus || 'active';

  await crop.save();
  res.json({ message: 'Sell offer updated successfully', crop });
}));

r.patch('/:id/withdraw-offer', authenticate, requireRole('farmer'), asyncHandler(async (req, res) => {
  const crop = await Crop.findOne({ _id: req.params.id, farmer: req.user._id });
  if (!crop) throw new ApiError(404, 'Crop listing not found');

  crop.offerStatus = 'withdrawn';
  await crop.save();
  res.json({ message: 'Sell offer withdrawn', crop });
}));

r.get('/', validate(cropQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const { q, category, state, minPrice, maxPrice, page, limit } = req.query;
  const f = { status: 'available', quantity: { $gt: 0 } };
  if (q) f.$or = [{ name: new RegExp(esc(q), 'i') }, { description: new RegExp(esc(q), 'i') }];
  if (category) f.category = category;
  if (state) f.state = new RegExp(`^${esc(state)}$`, 'i');
  if (minPrice !== undefined || maxPrice !== undefined) f.priceInr = { ...(minPrice !== undefined && { $gte: minPrice }), ...(maxPrice !== undefined && { $lte: maxPrice }) };
  const [items, total] = await Promise.all([
    Crop.find(f).populate('farmer', 'name city state').sort('-createdAt').skip((page - 1) * limit).limit(limit), Crop.countDocuments(f)]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}));
r.get('/mine', authenticate, requireRole('farmer'), asyncHandler(async (req, res) => res.json({ items: await Crop.find({ farmer: req.user._id }).sort('-createdAt') })));
r.get('/:id', asyncHandler(async (req, res) => {
  if (!objectId.safeParse(req.params.id).success) throw new ApiError(404, 'Crop not found');
  const crop = await Crop.findById(req.params.id).populate('farmer', 'name city state country');
  if (!crop) throw new ApiError(404, 'Crop not found');
  res.json({ crop });
}));
r.post('/', authenticate, requireRole('farmer'), (req, res, next) => uploadImages(req, res, next), (req, res, next) => {
  if (!req.body.category) req.body.category = 'Grains';
  if (!req.body.location && req.body.farmAddress) req.body.location = req.body.farmAddress;
  next();
}, validate(cropSchema), asyncHandler(async (req, res) => {
  const { latitude, longitude, ...fields } = req.body;
  const coordinates = (latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null)
    ? { latitude: Number(latitude), longitude: Number(longitude) }
    : undefined;
  const crop = await Crop.create({
    ...fields,
    ...(coordinates && { coordinates }),
    images: urls(req.files),
    farmer: req.user._id
  });
  res.status(201).json({ crop });
}));
async function ownCrop(req) {
  if (!objectId.safeParse(req.params.id).success) throw new ApiError(404, 'Crop not found');
  const crop = await Crop.findById(req.params.id);
  if (!crop) throw new ApiError(404, 'Crop not found');
  if (req.user.role !== 'admin' && String(crop.farmer) !== String(req.user._id)) throw new ApiError(403, 'You can only modify your own crops');
  return crop;
}
r.put('/:id', authenticate, requireRole('farmer'), (req, res, next) => uploadImages(req, res, next), validate(cropUpdateSchema), asyncHandler(async (req, res) => {
  const crop = await ownCrop(req);
  const { keepImages, latitude, longitude, ...fields } = req.body;
  const keep = keepImages === undefined ? crop.images : crop.images.filter((i) => keepImages.split(',').includes(i));
  const dropped = crop.images.filter((i) => !keep.includes(i));
  const coordinates = (latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null)
    ? { latitude: Number(latitude), longitude: Number(longitude) }
    : crop.coordinates;
  Object.assign(crop, fields, {
    ...(coordinates && { coordinates }),
    images: [...keep, ...urls(req.files)].slice(0, 5)
  });
  await crop.save(); removeFiles(dropped);
  await notify(crop.farmer, 'crop_updated', `Your listing "${crop.name}" was updated`, `/crops/${crop._id}`);
  res.json({ crop });
}));
r.delete('/:id', authenticate, requireRole('farmer', 'admin'), asyncHandler(async (req, res) => {
  const crop = await ownCrop(req);
  if (await Order.exists({ crop: crop._id, status: { $in: ['Pending', 'Accepted', 'Confirmed', 'Ready for Collection'] } }))
    throw new ApiError(409, 'Crop has active orders; resolve them before deleting');
  await crop.deleteOne(); removeFiles(crop.images);
  res.json({ message: 'Crop deleted' });
}));
export default r;
