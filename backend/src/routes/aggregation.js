import { Router } from 'express';
import { AggregationLot } from '../models/AggregationLot.js';
import { Crop } from '../models/Crop.js';
import { asyncHandler, ApiError } from '../middleware/http.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  getCompatibleCropsGrouped,
  autoAggregateCrops,
  createCustomLot,
  updateLotStatus,
  getAggregationStats
} from '../services/aggregation.js';

const r = Router();

// GET /api/aggregation/stats
r.get('/stats', asyncHandler(async (_req, res) => {
  const stats = await getAggregationStats();
  res.json({ stats });
}));

// GET /api/aggregation/compatible-crops
r.get('/compatible-crops', asyncHandler(async (req, res) => {
  const { state } = req.query;
  const groups = await getCompatibleCropsGrouped(state);
  res.json({ groups });
}));

// GET /api/aggregation/lots
r.get('/lots', asyncHandler(async (req, res) => {
  const { q, cropName, grade, state, status, exportReady, page = 1, limit = 20 } = req.query;
  const f = {};

  if (q) {
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    f.$or = [
      { lotId: new RegExp(esc, 'i') },
      { cropName: new RegExp(esc, 'i') },
      { state: new RegExp(esc, 'i') },
      { destinationCountry: new RegExp(esc, 'i') }
    ];
  }
  if (cropName) f.cropName = new RegExp(`^${cropName.trim()}$`, 'i');
  if (grade) f.grade = grade;
  if (state) f.state = new RegExp(`^${state.trim()}$`, 'i');
  if (status) f.status = status;
  if (exportReady === 'true') {
    f.status = { $in: ['ready_for_inspection', 'inspected', 'collected', 'allocated_for_export'] };
  }

  const p = Math.max(1, Number(page));
  const l = Math.min(100, Math.max(1, Number(limit)));

  const [items, total] = await Promise.all([
    AggregationLot.find(f).sort('-createdAt').skip((p - 1) * l).limit(l),
    AggregationLot.countDocuments(f)
  ]);

  res.json({ items, total, page: p, pages: Math.ceil(total / l) });
}));

// GET /api/aggregation/farmer/contributions
r.get('/farmer/contributions', authenticate, requireRole('farmer'), asyncHandler(async (req, res) => {
  const lots = await AggregationLot.find({
    'contributions.farmer': req.user._id
  }).sort('-updatedAt');

  // Filter contributions to only show this farmer's share
  const myLots = lots.map((lot) => {
    const myContributions = lot.contributions.filter(
      (c) => String(c.farmer) === String(req.user._id)
    );
    const myTotalKg = myContributions.reduce((sum, c) => sum + c.quantityInKg, 0);
    return {
      _id: lot._id,
      lotId: lot.lotId,
      cropName: lot.cropName,
      grade: lot.grade,
      state: lot.state,
      lotTotalQuantityKg: lot.totalQuantityKg,
      targetQuantityKg: lot.targetQuantityKg,
      lotStatus: lot.status,
      weightedAvgPricePerKg: lot.weightedAvgPricePerKg,
      destinationCountry: lot.destinationCountry,
      myContributions,
      myTotalKg,
      createdAt: lot.createdAt
    };
  });

  res.json({ lots: myLots });
}));

// GET /api/aggregation/lots/:id
r.get('/lots/:id', asyncHandler(async (req, res) => {
  const lot = await AggregationLot.findOne({
    $or: [
      { lotId: String(req.params.id).toUpperCase() },
      { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }
    ]
  }).populate('assignedCollectionCenter', 'name address state district phone contactPerson');

  if (!lot) throw new ApiError(404, 'Aggregation lot not found');
  res.json({ lot });
}));

// POST /api/aggregation/auto-aggregate
r.post('/auto-aggregate', authenticate, asyncHandler(async (req, res) => {
  const { targetLotSize = 1000, state = null } = req.body;
  const createdLots = await autoAggregateCrops({ targetLotSize, state });
  res.status(201).json({
    message: `Auto-aggregation complete. ${createdLots.length} lot(s) formed or updated.`,
    lots: createdLots
  });
}));

// POST /api/aggregation/create-lot
r.post('/create-lot', authenticate, asyncHandler(async (req, res) => {
  const {
    cropName,
    category,
    grade,
    state,
    region,
    targetQuantityKg,
    cropAllocations,
    notes
  } = req.body;

  if (!cropName || !state) {
    throw new ApiError(400, 'cropName and state are required');
  }

  const lot = await createCustomLot({
    cropName,
    category,
    grade,
    state,
    region,
    targetQuantityKg,
    cropAllocations,
    notes
  });

  res.status(201).json({ message: 'Aggregation lot created successfully', lot });
}));

// PATCH /api/aggregation/lots/:id/status
r.patch('/lots/:id/status', authenticate, asyncHandler(async (req, res) => {
  const { status, notes, destinationCountry, buyerName, centerName, assignedCollectionCenter, inspection } = req.body;

  if (!status) throw new ApiError(400, 'status is required');

  const updatedLot = await updateLotStatus(req.params.id, status, {
    notes,
    destinationCountry,
    buyerName,
    centerName,
    assignedCollectionCenter,
    inspection
  });

  res.json({ message: `Lot status updated to ${status}`, lot: updatedLot });
}));

// DELETE /api/aggregation/lots/:id
r.delete('/lots/:id', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const updatedLot = await updateLotStatus(req.params.id, 'cancelled', {
    notes: 'Cancelled by admin'
  });
  res.json({ message: 'Lot cancelled and allocated stock released back to farmers', lot: updatedLot });
}));

export default r;
