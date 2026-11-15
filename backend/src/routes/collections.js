import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/http.js';
import { CollectionRequest } from '../models/CollectionRequest.js';
import {
  scheduleCollection,
  updateCollectionStatus,
  getFarmerCollectionSummary
} from '../services/collection.js';

const router = express.Router();

/**
 * GET /api/collections/farmer
 * Returns collection history, pickup statuses, and payout summary for the authenticated farmer.
 */
router.get('/farmer', authenticate, asyncHandler(async (req, res) => {
  const summary = await getFarmerCollectionSummary(req.user._id);
  res.json(summary);
}));

/**
 * POST /api/collections/schedule
 * Schedules a collection pickup for a farmer's crop listing.
 */
router.post('/schedule', authenticate, asyncHandler(async (req, res) => {
  const {
    cropId,
    scheduledDate,
    pickupAddress,
    coordinates,
    pickupContactPhone,
    notes
  } = req.body || {};

  if (!cropId) {
    throw new ApiError(400, 'cropId is required to schedule collection');
  }

  try {
    const collection = await scheduleCollection({
      farmerId: req.user._id,
      cropId,
      scheduledDate,
      pickupAddress,
      coordinates,
      pickupContactPhone,
      notes
    });

    res.status(201).json({
      message: 'Collection pickup scheduled successfully',
      collection
    });
  } catch (err) {
    if (err.message && err.message.includes('already active')) {
      return res.status(409).json({ message: err.message });
    }
    throw err;
  }
}));

/**
 * GET /api/collections
 * Admin & Logistics overview of all collection requests across farmers.
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) {
    filter.status = req.query.status;
  }
  if (req.query.cropName) {
    filter.cropName = new RegExp(req.query.cropName, 'i');
  }
  if (req.query.paymentStatus) {
    filter.paymentStatus = req.query.paymentStatus;
  }

  // Non-admin farmers can only see their own collections
  if (req.user.role === 'farmer') {
    filter.farmer = req.user._id;
  }

  const collections = await CollectionRequest.find(filter)
    .populate('farmer', 'name email phone state district')
    .populate('crop', 'name quantity unit priceInr images coordinates farmAddress')
    .sort('-createdAt')
    .limit(Number(req.query.limit) || 100);

  res.json({
    count: collections.length,
    collections
  });
}));

/**
 * GET /api/collections/:id
 * Retrieve details of a specific collection request by collectionId or _id.
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const id = req.params.id;
  const query = id.startsWith('COL-') ? { collectionId: id } : { _id: id };
  const collection = await CollectionRequest.findOne(query)
    .populate('farmer', 'name email phone state district farmLocation')
    .populate('crop')
    .populate('aggregationLot');

  if (!collection) {
    throw new ApiError(404, 'Collection request not found');
  }

  // Ensure farmer can only view their own request
  if (req.user.role === 'farmer' && String(collection.farmer._id) !== String(req.user._id)) {
    throw new ApiError(403, 'Access denied to this collection record');
  }

  res.json(collection);
}));

/**
 * PATCH /api/collections/:id/status
 * Updates status, QC inspection outcome, accepted quantity, or payment status.
 */
router.patch('/:id/status', authenticate, asyncHandler(async (req, res) => {
  const {
    status,
    notes,
    centerName,
    collectionCenter,
    inspection,
    acceptedQuantityKg,
    rejectionReason,
    paymentStatus,
    paymentReference,
    actor
  } = req.body || {};

  if (!status) {
    throw new ApiError(400, 'Target status is required');
  }

  const updated = await updateCollectionStatus(req.params.id, status, {
    notes,
    centerName,
    collectionCenter,
    inspection,
    acceptedQuantityKg,
    rejectionReason,
    paymentStatus,
    paymentReference,
    actor: actor || (req.user.role === 'admin' ? 'Admin / QC Inspector' : req.user.name || 'Logistics Partner')
  });

  res.json({
    message: `Collection updated to ${status}`,
    collection: updated
  });
}));

export default router;
