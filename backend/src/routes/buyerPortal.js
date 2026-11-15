import express from 'express';
import { BuyerRequirement, ALLOWED_REQUIREMENT_CROPS, generateRequirementId } from '../models/BuyerRequirement.js';
import { AggregationLot } from '../models/AggregationLot.js';
import { User } from '../models/User.js';
import { matchAndAllocateRequirement, buyerConfirmDeliveryReceipt } from '../services/automatedProcurementEngine.js';
import { asyncHandler, ApiError } from '../middleware/http.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate, requireRole('buyer'));

/**
 * GET /api/buyer/dashboard
 * Summary of active requirements, aggregated quantities, delivery status, and procurement spend.
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  const buyerId = req.user._id;

  const [requirements, user] = await Promise.all([
    BuyerRequirement.find({ buyer: buyerId }).sort('-createdAt').lean(),
    User.findById(buyerId).lean()
  ]);

  let totalRequestedKg = 0;
  let totalAllocatedKg = 0;
  let totalCollectedKg = 0;
  let totalDeliveredKg = 0;
  let activeRequirementsCount = 0;
  let completedRequirementsCount = 0;
  let totalEstimatedSpendInr = 0;

  for (const r of requirements) {
    totalRequestedKg += r.requiredQuantityKg || 0;
    totalAllocatedKg += r.allocatedQuantityKg || 0;
    totalCollectedKg += r.collectedQuantityKg || 0;

    if (r.status === 'completed' || r.delivery?.confirmedByBuyer) {
      completedRequirementsCount++;
      totalDeliveredKg += r.delivery?.receivedQuantityKg || r.qcAcceptedQuantityKg || r.allocatedQuantityKg || 0;
    } else {
      activeRequirementsCount++;
    }

    const requirementCost = (r.allocations || []).reduce(
      (sum, a) => sum + (a.farmerGrossPayable || a.allocatedQuantityKg * a.procurementPricePerKg),
      0
    );
    totalEstimatedSpendInr += requirementCost;
  }

  res.json({
    companyName: user.companyName || user.organization || user.name,
    gstin: user.gstin || '',
    deliveryAddress: user.deliveryAddress || user.farmLocation?.address || '',
    metrics: {
      totalRequestedKg,
      totalAllocatedKg,
      totalCollectedKg,
      totalDeliveredKg,
      activeRequirementsCount,
      completedRequirementsCount,
      totalEstimatedSpendInr
    },
    recentRequirements: requirements.slice(0, 6)
  });
}));

/**
 * POST /api/buyer/requirements
 * Submit bulk procurement requirement (Ragi, Rice, Jowar only).
 * Triggers immediate automated matching and atomic stock reservation across 2-3 farmers.
 * NOTE: ZERO farmer accept/reject step.
 */
router.post('/requirements', asyncHandler(async (req, res) => {
  const {
    cropName,
    quantity,
    unit = 'kg',
    requiredGrade = 'Grade A',
    qualitySpecifications,
    targetBudgetPricePerKg,
    deliveryDestination,
    requiredByDate
  } = req.body;

  if (!ALLOWED_REQUIREMENT_CROPS.includes(cropName)) {
    throw new ApiError(400, `Invalid crop name "${cropName}". Allowed crops are strictly: ${ALLOWED_REQUIREMENT_CROPS.join(', ')}`);
  }

  const numericQuantity = Number(quantity);
  if (!numericQuantity || numericQuantity <= 0) {
    throw new ApiError(400, 'Required quantity must be a positive number');
  }

  let requiredQuantityKg = numericQuantity;
  if (unit === 'quintal') requiredQuantityKg = numericQuantity * 100;
  if (unit === 'tonne') requiredQuantityKg = numericQuantity * 1000;

  if (!deliveryDestination || !deliveryDestination.trim()) {
    throw new ApiError(400, 'Delivery destination address is required');
  }

  const buyerUser = await User.findById(req.user._id);

  const requirement = new BuyerRequirement({
    requirementId: generateRequirementId(),
    buyer: req.user._id,
    buyerName: buyerUser.name,
    buyerEmail: buyerUser.email,
    buyerCompany: buyerUser.companyName || buyerUser.organization || buyerUser.name,
    cropName,
    requiredQuantityKg,
    remainingQuantityKg: requiredQuantityKg,
    allocatedQuantityKg: 0,
    collectedQuantityKg: 0,
    requiredGrade,
    qualitySpecifications: qualitySpecifications || `Standard bulk export grade ${cropName}`,
    targetBudgetPricePerKg: Number(targetBudgetPricePerKg) || 0,
    deliveryDestination,
    requiredDeliveryDate: requiredByDate || req.body.requiredDeliveryDate ? new Date(requiredByDate || req.body.requiredDeliveryDate) : new Date(Date.now() + 14 * 86400000),
    requiredByDate: requiredByDate ? new Date(requiredByDate) : new Date(Date.now() + 14 * 86400000),
    status: 'open',
    allocations: []
  });

  // Run automated procurement engine: automatically matches & reserves stock across 2-3 farmers
  await matchAndAllocateRequirement(requirement);

  res.status(201).json({
    message: 'Procurement requirement created. Matching farmer produce has been automatically allocated.',
    requirement
  });
}));

/**
 * GET /api/buyer/requirements
 * List all requirements created by the logged-in buyer.
 */
router.get('/requirements', asyncHandler(async (req, res) => {
  const requirements = await BuyerRequirement.find({ buyer: req.user._id })
    .sort('-createdAt')
    .populate('aggregationLot')
    .lean();

  const formatted = requirements.map((r) => {
    const allocPct = r.requiredQuantityKg > 0 ? Math.min(100, Math.round((r.allocatedQuantityKg / r.requiredQuantityKg) * 100)) : 0;
    const collPct = r.allocatedQuantityKg > 0 ? Math.min(100, Math.round((r.collectedQuantityKg / r.allocatedQuantityKg) * 100)) : 0;

    return {
      ...r,
      allocationPercentage: allocPct,
      collectionPercentage: collPct,
      participatingFarmersCount: r.allocations?.length || 0
    };
  });

  res.json({ requirements: formatted });
}));

/**
 * GET /api/buyer/requirements/:id
 * Requirement details, contributing farmers, live vehicle tracking, delivery receipt.
 */
router.get('/requirements/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const requirement = await BuyerRequirement.findOne({
    $or: [{ _id: id }, { requirementId: id }],
    buyer: req.user._id
  }).populate('aggregationLot');

  if (!requirement) {
    throw new ApiError(404, 'Procurement requirement not found');
  }

  res.json({ requirement });
}));

/**
 * GET /api/buyer/aggregation
 * Aggregation tracking for active requirements.
 */
router.get('/aggregation', asyncHandler(async (req, res) => {
  const requirements = await BuyerRequirement.find({
    buyer: req.user._id,
    status: { $nin: ['cancelled'] }
  })
    .sort('-createdAt')
    .populate('aggregationLot')
    .lean();

  const lots = requirements.map((r) => ({
    requirementId: r.requirementId,
    cropName: r.cropName,
    requiredQuantityKg: r.requiredQuantityKg,
    allocatedQuantityKg: r.allocatedQuantityKg,
    collectedQuantityKg: r.collectedQuantityKg,
    status: r.status,
    vehicleStatus: r.vehicle?.currentStatus || 'none',
    vehicleType: r.vehicle?.vehicleType || '',
    driverName: r.vehicle?.driverName || '',
    route: r.vehicle?.route || [],
    allocations: (r.allocations || []).map((a) => ({
      farmerName: a.farmerName,
      location: a.farmerVillage || a.farmerLocation,
      allocatedQuantityKg: a.allocatedQuantityKg,
      actualWeighedKg: a.actualWeighedKg,
      acceptedQuantityKg: a.acceptedQuantityKg,
      collectionStatus: a.collectionStatus
    })),
    deliveryDestination: r.deliveryDestination,
    lotId: r.aggregationLot?.lotId || `LOT-${r.requirementId}`
  }));

  res.json({ aggregationLots: lots });
}));

/**
 * GET /api/buyer/deliveries
 * Dispatched and delivered orders with delivery receipt confirmation status.
 */
router.get('/deliveries', asyncHandler(async (req, res) => {
  const requirements = await BuyerRequirement.find({
    buyer: req.user._id,
    $or: [
      { status: { $in: ['in_transit', 'delivered', 'completed'] } },
      { 'vehicle.currentStatus': { $in: ['dispatched_to_buyer', 'arrived_at_destination', 'delivered'] } },
      { 'delivery.confirmedByBuyer': true }
    ]
  }).sort('-updatedAt').lean();

  res.json({ deliveries: requirements });
}));

/**
 * POST /api/buyer/requirements/:id/confirm-delivery
 * Buyer confirms delivery receipt, records received kg, notes, and finalizes the order.
 * Automatically advances farmer payments to processing.
 */
router.post('/requirements/:id/confirm-delivery', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { receivedQuantityKg, buyerInspectionNotes } = req.body;

  const requirement = await buyerConfirmDeliveryReceipt({
    requirementId: id,
    buyerId: req.user._id,
    deliveryData: {
      receivedQuantityKg,
      buyerInspectionNotes
    }
  });

  res.json({
    message: 'Delivery confirmed successfully. Consignment marked as received and farmer settlement initiated.',
    requirement
  });
}));

/**
 * GET /api/buyer/profile
 * Get buyer company profile.
 */
router.get('/profile', asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-passwordHash').lean();
  res.json({ user });
}));

/**
 * PUT /api/buyer/profile
 * Update company name, GSTIN, delivery address, phone.
 */
router.put('/profile', asyncHandler(async (req, res) => {
  const { companyName, gstin, deliveryAddress, phone, country } = req.body;
  const user = await User.findById(req.user._id);

  if (companyName) user.companyName = companyName;
  if (gstin) user.gstin = gstin;
  if (deliveryAddress) user.deliveryAddress = deliveryAddress;
  if (phone) user.phone = phone;
  if (country) user.country = country;

  await user.save();
  res.json({ message: 'Buyer profile updated successfully', user });
}));

export default router;
