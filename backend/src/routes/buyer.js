import express from 'express';
import { User } from '../models/User.js';
import { Rfq } from '../models/Rfq.js';
import { Order } from '../models/Order.js';
import { Crop } from '../models/Crop.js';
import { AggregationLot } from '../models/AggregationLot.js';
import { asyncHandler, ApiError } from '../middleware/http.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/buyer/dashboard
 * Aggregates B2B buyer dashboard summary metrics:
 * active RFQs, received quotations, confirmed purchase orders, commercial invoices, watchlist items.
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  const buyerId = req.user._id;

  const [rfqs, orders, user] = await Promise.all([
    Rfq.find({ buyer: buyerId }).sort('-createdAt'),
    Order.find({ buyer: buyerId }).sort('-createdAt'),
    User.findById(buyerId).populate('watchlist.crop').populate('watchlist.lot')
  ]);

  let totalQuotesReceived = 0;
  let activeRfqCount = 0;
  for (const r of rfqs) {
    totalQuotesReceived += r.quotes?.length || 0;
    if (['open', 'quoted', 'negotiating'].includes(r.status)) {
      activeRfqCount++;
    }
  }

  let totalPurchaseOrdersValueInr = 0;
  let activeShipmentsCount = 0;
  const invoices = [];

  for (const o of orders) {
    totalPurchaseOrdersValueInr += o.totalInr || 0;
    if (o.invoiceNumber) {
      invoices.push({
        _id: o._id,
        invoiceNumber: o.invoiceNumber,
        rfqNumber: o.rfqNumber,
        orderId: o._id,
        cropName: o.cropName,
        quantity: o.quantity,
        unit: o.unit,
        totalInr: o.totalInr,
        destinationPort: o.destinationPort || o.buyerCountry,
        deliveryTerms: o.deliveryTerms || 'CIF',
        paymentStatus: o.paymentStatus || 'pending',
        shipmentTracking: o.shipmentTracking || { status: 'booked' },
        createdAt: o.createdAt
      });
    }
    if (['Confirmed', 'Ready for Collection', 'In Transit'].includes(o.status)) {
      activeShipmentsCount++;
    }
  }

  res.json({
    companyProfile: {
      name: user.companyName || user.organization || user.name,
      country: user.country,
      currency: user.currency,
      verificationStatus: user.verificationStatus || 'unverified',
      buyerType: user.buyerType || 'importer',
      businessRegistrationNumber: user.businessRegistrationNumber || '',
      importLicenseNumber: user.importLicenseNumber || ''
    },
    metrics: {
      totalRfqs: rfqs.length,
      activeRfqs: activeRfqCount,
      totalQuotesReceived,
      totalOrders: orders.length,
      activeShipments: activeShipmentsCount,
      totalPurchaseOrdersValueInr,
      watchlistCount: user.watchlist?.length || 0,
      invoicesCount: invoices.length
    },
    recentRfqs: rfqs.slice(0, 5),
    recentOrders: orders.slice(0, 5),
    invoices: invoices.slice(0, 10),
    watchlist: user.watchlist || []
  });
}));

/**
 * GET /api/buyer/watchlist
 * Retrieve items in the buyer's saved watchlist.
 */
router.get('/watchlist', asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate({
      path: 'watchlist.crop',
      populate: { path: 'farmer', select: 'name city state' }
    })
    .populate('watchlist.lot');

  res.json({
    count: user.watchlist?.length || 0,
    items: user.watchlist || []
  });
}));

/**
 * POST /api/buyer/watchlist
 * Add an export-ready crop or bulk aggregation lot to the buyer's watchlist.
 */
router.post('/watchlist', asyncHandler(async (req, res) => {
  const { cropId, lotId } = req.body || {};

  if (!cropId && !lotId) {
    throw new ApiError(400, 'Either cropId or lotId must be provided');
  }

  const user = await User.findById(req.user._id);

  // Check for duplicates
  const exists = user.watchlist?.some((w) =>
    (cropId && String(w.crop) === String(cropId)) ||
    (lotId && String(w.lot) === String(lotId))
  );

  if (exists) {
    return res.json({ message: 'Item is already in your watchlist', watchlist: user.watchlist });
  }

  const item = {
    crop: cropId || undefined,
    lot: lotId || undefined,
    itemType: lotId ? 'lot' : 'crop',
    addedAt: new Date()
  };

  user.watchlist.push(item);
  await user.save();

  res.status(201).json({
    message: 'Added to watchlist',
    watchlist: user.watchlist
  });
}));

/**
 * DELETE /api/buyer/watchlist/:id
 * Remove an item from the buyer's watchlist.
 */
router.delete('/watchlist/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const targetId = req.params.id;

  user.watchlist = (user.watchlist || []).filter(
    (w) => String(w._id) !== targetId && String(w.crop) !== targetId && String(w.lot) !== targetId
  );

  await user.save();
  res.json({ message: 'Removed from watchlist', watchlist: user.watchlist });
}));

/**
 * GET /api/buyer/invoices
 * Returns all formal commercial invoices for the buyer.
 */
router.get('/invoices', asyncHandler(async (req, res) => {
  const orders = await Order.find({
    buyer: req.user._id,
    invoiceNumber: { $exists: true, $ne: null }
  }).sort('-createdAt');

  res.json({
    count: orders.length,
    invoices: orders
  });
}));

/**
 * POST /api/buyer/verify-company
 * Buyer submits business credentials for verification.
 */
router.post('/verify-company', asyncHandler(async (req, res) => {
  const {
    companyName,
    buyerType,
    businessRegistrationNumber,
    importLicenseNumber,
    targetCrops,
    verificationEvidence
  } = req.body || {};

  const user = await User.findById(req.user._id);

  if (companyName) user.companyName = companyName;
  if (buyerType) user.buyerType = buyerType;
  if (businessRegistrationNumber) user.businessRegistrationNumber = businessRegistrationNumber;
  if (importLicenseNumber) user.importLicenseNumber = importLicenseNumber;
  if (Array.isArray(targetCrops)) user.targetCrops = targetCrops;
  if (verificationEvidence) user.verificationEvidence = verificationEvidence;

  user.verificationStatus = 'verified'; // Auto-verify for active demo B2B environment
  user.verifiedAt = new Date();

  await user.save();

  res.json({
    message: 'Company verification submitted and approved',
    user: user.toSafe()
  });
}));

export default router;
