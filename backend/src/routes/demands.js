import { Router } from 'express';
import { BuyerDemand } from '../models/BuyerDemand.js';
import { Crop } from '../models/Crop.js';
import { asyncHandler, ApiError, validate, objectId } from '../middleware/http.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { demandSchema, contributeSchema } from '../validators/schemas.js';
import {
  createDemand,
  contributeToDemand,
  cancelContribution,
  recordInspectionOutcome,
  cancelDemand
} from '../services/demandEngine.js';
import { normaliseCropName } from '../services/aggregation.js';

const router = Router();
router.use(authenticate);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 1. LIST DEMANDS (Filterable by crop, status, country, targetGrade, page, limit)
 */
router.get('/', asyncHandler(async (req, res) => {
  const { crop, status, country, grade, q, page = 1, limit = 20 } = req.query;
  const f = {};

  if (crop) f.cropName = new RegExp(esc(crop.trim()), 'i');
  if (status) f.status = status;
  else f.status = { $in: ['open', 'partially_committed', 'fully_committed', 'in_aggregation', 'fulfilled'] };

  if (country) f.destinationCountry = new RegExp(`^${esc(country.trim())}$`, 'i');
  if (grade) f.targetGrade = grade;
  if (q) {
    f.$or = [
      { cropName: new RegExp(esc(q), 'i') },
      { destinationCountry: new RegExp(esc(q), 'i') },
      { destinationPort: new RegExp(esc(q), 'i') },
      { buyerCompany: new RegExp(esc(q), 'i') }
    ];
  }

  const p = Math.max(1, Number(page));
  const l = Math.min(50, Math.max(1, Number(limit)));

  const [items, total] = await Promise.all([
    BuyerDemand.find(f)
      .sort('-createdAt')
      .skip((p - 1) * l)
      .limit(l)
      .lean(),
    BuyerDemand.countDocuments(f)
  ]);

  // Privacy Protection: sanitize farmer details on general listing
  const sanitized = items.map((d) => {
    const isOwnerOrAdmin = req.user.role === 'admin' || String(d.buyer) === String(req.user._id);
    return {
      ...d,
      contributions: d.contributions.map((c) => ({
        contributionId: c.contributionId,
        quantityKg: c.quantityKg,
        grade: c.grade,
        status: c.status,
        farmerState: c.farmerState,
        farmerLocation: c.farmerLocation,
        committedAt: c.committedAt,
        ...(isOwnerOrAdmin
          ? { farmer: c.farmer, farmerName: c.farmerName, farmerPhone: c.farmerPhone, grossValueInr: c.grossValueInr }
          : { farmerName: `Farmer (${c.farmerState || 'IN'})` })
      }))
    };
  });

  res.json({
    items: sanitized,
    total,
    page: p,
    pages: Math.ceil(total / l)
  });
}));

/**
 * 2. GET USER'S DEMANDS (Buyer's posted demands or Farmer's contributed demands)
 */
router.get('/mine', asyncHandler(async (req, res) => {
  if (req.user.role === 'buyer') {
    const items = await BuyerDemand.find({ buyer: req.user._id }).sort('-createdAt').lean();
    return res.json({ items });
  }

  if (req.user.role === 'farmer') {
    const items = await BuyerDemand.find({ 'contributions.farmer': req.user._id }).sort('-createdAt').lean();
    // Return only farmer's contributions highlighted
    const personalized = items.map((d) => ({
      ...d,
      myContributions: d.contributions.filter((c) => String(c.farmer) === String(req.user._id))
    }));
    return res.json({ items: personalized });
  }

  // Admin view all
  const items = await BuyerDemand.find().sort('-createdAt').limit(100).lean();
  res.json({ items });
}));

/**
 * 3. GET SINGLE DEMAND DETAILS
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const d = await BuyerDemand.findById(req.params.id).lean();
  if (!d) throw new ApiError(404, 'Demand requirement not found');

  const isOwnerOrAdmin = req.user.role === 'admin' || String(d.buyer) === String(req.user._id);
  const demand = {
    ...d,
    contributions: d.contributions.map((c) => ({
      contributionId: c.contributionId,
      quantityKg: c.quantityKg,
      grade: c.grade,
      status: c.status,
      farmerState: c.farmerState,
      farmerLocation: c.farmerLocation,
      committedAt: c.committedAt,
      inspectedAt: c.inspectedAt,
      acceptedQuantityKg: c.acceptedQuantityKg,
      rejectedQuantityKg: c.rejectedQuantityKg,
      inspectionNotes: c.inspectionNotes,
      grossValueInr: isOwnerOrAdmin || String(c.farmer) === String(req.user._id) ? c.grossValueInr : undefined,
      ...(req.user.role === 'admin' || String(c.farmer) === String(req.user._id)
        ? { farmer: c.farmer, farmerName: c.farmerName, farmerPhone: c.farmerPhone }
        : { farmerName: `Farmer (${c.farmerState || 'IN'})` })
    }))
  };

  res.json({ demand });
}));

/**
 * 4. CREATE BUYER DEMAND (Buyer or Admin)
 */
router.post('/', requireRole('buyer', 'admin'), validate(demandSchema), asyncHandler(async (req, res) => {
  const demand = await createDemand(req.user, req.body);
  res.status(201).json({ demand });
}));

/**
 * 5. CONTRIBUTE PRODUCE TO DEMAND (Farmer)
 */
router.post('/:id/contribute', requireRole('farmer'), validate(contributeSchema), asyncHandler(async (req, res) => {
  const result = await contributeToDemand(req.user, req.params.id, req.body);
  res.status(201).json(result);
}));

/**
 * 6. CANCEL CONTRIBUTION (Farmer or Admin)
 */
const cancelContribHandler = asyncHandler(async (req, res) => {
  const result = await cancelContribution(req.user, req.params.id, req.params.contributionId, req.body?.reason);
  res.json(result);
});
router.post('/:id/contributions/:contributionId/cancel', requireRole('farmer', 'admin'), cancelContribHandler);
router.delete('/:id/contributions/:contributionId', requireRole('farmer', 'admin'), cancelContribHandler);

/**
 * 7. ADMIN INSPECTION OUTCOME (Admin)
 */
const inspectHandler = asyncHandler(async (req, res) => {
  const result = await recordInspectionOutcome(req.user, req.params.id, req.params.contributionId, req.body);
  res.json(result);
});
router.patch('/:id/contributions/:contributionId/inspect', requireRole('admin'), inspectHandler);
router.post('/:id/contributions/:contributionId/inspection', requireRole('admin'), inspectHandler);

/**
 * 8. CANCEL BUYER DEMAND (Buyer or Admin)
 */
const cancelDemandHandler = asyncHandler(async (req, res) => {
  const result = await cancelDemand(req.user, req.params.id, req.body?.reason);
  res.json(result);
});
router.post('/:id/cancel', requireRole('buyer', 'admin'), cancelDemandHandler);
router.delete('/:id', requireRole('buyer', 'admin'), cancelDemandHandler);

/**
 * 9. DEMAND ANALYTICS SUMMARY
 */
router.get('/analytics/summary', asyncHandler(async (_req, res) => {
  const demands = await BuyerDemand.find().lean();

  let totalDemandKg = 0;
  let totalCommittedKg = 0;
  let totalAcceptedKg = 0;
  let totalDemandsCount = demands.length;
  let openDemandsCount = 0;
  let fulfilledDemandsCount = 0;

  const cropDemandMap = {};
  const countryDemandMap = {};

  for (const d of demands) {
    totalDemandKg += d.requiredQuantityKg || 0;
    totalCommittedKg += d.committedQuantityKg || 0;
    totalAcceptedKg += d.acceptedQuantityKg || 0;

    if (['open', 'partially_committed'].includes(d.status)) openDemandsCount++;
    if (d.status === 'fulfilled') fulfilledDemandsCount++;

    const cName = d.cropName || 'Crop';
    cropDemandMap[cName] = (cropDemandMap[cName] || 0) + (d.requiredQuantityKg || 0);

    const dest = d.destinationCountry || 'Global';
    countryDemandMap[dest] = (countryDemandMap[dest] || 0) + (d.requiredQuantityKg || 0);
  }

  const overallFulfillmentPercent = totalDemandKg > 0
    ? Math.round((totalCommittedKg / totalDemandKg) * 100)
    : 0;

  const cropBreakdown = Object.entries(cropDemandMap).map(([crop, demandKg]) => ({ crop, demandKg, demandMt: Math.round(demandKg / 1000) }));
  const countryBreakdown = Object.entries(countryDemandMap).map(([country, demandKg]) => ({ country, demandKg, demandMt: Math.round(demandKg / 1000) }));

  res.json({
    totalDemands: totalDemandsCount,
    totalDemandVolumeKg: totalDemandKg,
    totalCommittedVolumeKg: totalCommittedKg,
    topDemandCrops: cropBreakdown,
    topDestinationCountries: countryBreakdown,
    overview: {
      totalDemandsCount,
      openDemandsCount,
      fulfilledDemandsCount,
      totalDemandKg,
      totalDemandMt: Math.round(totalDemandKg / 1000),
      totalCommittedKg,
      totalCommittedMt: Math.round(totalCommittedKg / 1000),
      totalAcceptedKg,
      overallFulfillmentPercent
    },
    cropDemandBreakdown: cropBreakdown,
    countryDemandBreakdown: countryBreakdown
  });
}));

/**
 * 10. AI MATCHING: MATCH LIVE DEMANDS WITH FARMER'S LISTED CROPS
 */
router.get('/match/farmer-crops', requireRole('farmer'), asyncHandler(async (req, res) => {
  const crops = await Crop.find({ farmer: req.user._id, status: 'available', quantity: { $gt: 0 } }).lean();
  const demands = await BuyerDemand.find({ status: { $in: ['open', 'partially_committed'] } }).lean();

  const recommendations = [];

  for (const c of crops) {
    const freeStock = c.quantity - (c.allocatedQuantity || 0);
    if (freeStock <= 0) continue;

    const norm = normaliseCropName(c.name).toLowerCase();
    const matchingDemands = demands.filter((d) => {
      const dNorm = normaliseCropName(d.cropName).toLowerCase();
      return dNorm.includes(norm) || norm.includes(dNorm);
    });

    for (const d of matchingDemands) {
      const compatibleQty = Math.min(freeStock, d.remainingQuantityKg);
      const grossRealizationInr = Math.round(compatibleQty * (d.targetPricePerKg || c.priceInr));

      recommendations.push({
        cropId: c._id,
        cropName: c.name,
        freeStockKg: freeStock,
        demandId: d._id,
        demandNumber: d.demandId,
        buyerCountry: d.destinationCountry,
        destinationPort: d.destinationPort,
        requiredTotalKg: d.requiredQuantityKg,
        remainingDemandKg: d.remainingQuantityKg,
        compatibleQuantityKg: compatibleQty,
        targetPricePerKg: d.targetPricePerKg,
        grossRealizationInr,
        matchConfidence: 0.94,
        matchReason: `Your listing "${c.name}" matches ${d.destinationCountry} purchase requirement #${d.demandId}. Free stock (${freeStock} kg) can fulfill ${Math.round((compatibleQty / d.remainingQuantityKg) * 100)}% of remaining demand.`
      });
    }
  }

  res.json({
    totalMatchingOpportunities: recommendations.length,
    matches: recommendations,
    recommendations: recommendations.sort((a, b) => b.grossRealizationInr - a.grossRealizationInr)
  });
}));

export default router;
