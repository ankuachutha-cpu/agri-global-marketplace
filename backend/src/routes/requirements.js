import { Router } from 'express';
import { BuyerRequirement, ALLOWED_REQUIREMENT_CROPS, VEHICLE_TYPES, generateRequirementId } from '../models/BuyerRequirement.js';
import { Crop, ALLOWED_CROPS } from '../models/Crop.js';
import { User } from '../models/User.js';
import { asyncHandler, ApiError } from '../middleware/http.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  findCompatibleFarmersAndPropose,
  farmerRespondToOrder,
  assignVehicleToRequirement,
  updateVehicleWorkflowStatus,
  recordFarmerProduceCollection,
  confirmBuyerDelivery
} from '../services/simplifiedAggregationService.js';

const r = Router();

/**
 * Reference: Vehicle types and capacities
 */
r.get('/vehicle-types', (req, res) => {
  res.json({ vehicleTypes: VEHICLE_TYPES, allowedCrops: ALLOWED_REQUIREMENT_CROPS });
});

/**
 * Admin Live Metrics from MongoDB
 */
r.get('/admin/metrics', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const [totalFarmers, totalBuyers, activeRequirementsCount, activeLotsCount] = await Promise.all([
    User.countDocuments({ role: 'farmer' }),
    User.countDocuments({ role: 'buyer' }),
    BuyerRequirement.countDocuments({ status: { $nin: ['completed', 'cancelled'] } }),
    BuyerRequirement.countDocuments({ status: { $in: ['fully_allocated', 'confirmed', 'vehicle_assigned', 'in_transit'] } })
  ]);

  // Aggregate crops for Ragi, Rice, Jowar
  const crops = await Crop.find({
    name: { $in: ALLOWED_CROPS },
    status: 'available'
  }).lean();

  const stockSummary = {
    Ragi: { totalKg: 0, availableKg: 0, reservedKg: 0, collectedKg: 0 },
    Rice: { totalKg: 0, availableKg: 0, reservedKg: 0, collectedKg: 0 },
    Jowar: { totalKg: 0, availableKg: 0, reservedKg: 0, collectedKg: 0 }
  };

  for (const crop of crops) {
    const factor = crop.unit === 'tonne' ? 1000 : crop.unit === 'quintal' ? 100 : 1;
    const totalPhysicalKg = (crop.quantity || 0) * factor;
    const propKg = crop.proposedQuantity || 0;
    const resKg = crop.reservedQuantity || 0;
    const collKg = crop.collectedQuantity || 0;
    const freeKg = Math.max(0, totalPhysicalKg - propKg - resKg - collKg);

    const key = ALLOWED_CROPS.find((c) => c.toLowerCase() === (crop.name || '').toLowerCase());
    if (key && stockSummary[key]) {
      stockSummary[key].totalKg += totalPhysicalKg;
      stockSummary[key].availableKg += freeKg;
      stockSummary[key].reservedKg += resKg;
      stockSummary[key].collectedKg += collKg;
    }
  }

  // Count pending confirmations, vehicles assigned, completed collections/deliveries
  const allReqs = await BuyerRequirement.find({}).lean();
  let pendingFarmerConfirmations = 0;
  let vehiclesAssigned = 0;
  let completedCollections = 0;
  let completedDeliveries = 0;

  for (const reqItem of allReqs) {
    for (const c of reqItem.contributions || []) {
      if (c.status === 'proposed') pendingFarmerConfirmations++;
      if (c.status === 'collected') completedCollections++;
    }
    if (reqItem.vehicle && reqItem.vehicle.currentStatus && reqItem.vehicle.currentStatus !== 'none') {
      vehiclesAssigned++;
    }
    if (reqItem.status === 'completed' || reqItem.deliveryConfirmation?.confirmedByBuyer) {
      completedDeliveries++;
    }
  }

  res.json({
    totalFarmers,
    totalBuyers,
    activeRequirementsCount,
    activeLotsCount,
    pendingFarmerConfirmations,
    vehiclesAssigned,
    completedCollections,
    completedDeliveries,
    stockSummary
  });
}));

/**
 * 1. Create Buyer Requirement & Automatically Match Compatible Farmers
 */
r.post('/', authenticate, requireRole('buyer', 'admin'), asyncHandler(async (req, res) => {
  const {
    cropName,
    requiredQuantityKg,
    requiredGrade = 'Grade A',
    qualityRequirements = '',
    deliveryDestination,
    requiredDeliveryDate
  } = req.body;

  if (!cropName || !ALLOWED_REQUIREMENT_CROPS.includes(cropName)) {
    throw new ApiError(400, `Crop must be one of: ${ALLOWED_REQUIREMENT_CROPS.join(', ')}`);
  }

  const qty = Number(requiredQuantityKg);
  if (!qty || qty <= 0) {
    throw new ApiError(400, 'Required quantity must be greater than 0 kg');
  }

  if (!deliveryDestination || !deliveryDestination.trim()) {
    throw new ApiError(400, 'Delivery destination (Warehouse, Port, or Factory) is required');
  }

  if (!requiredDeliveryDate) {
    throw new ApiError(400, 'Required delivery date is required');
  }

  const buyer = await User.findById(req.user._id);
  const requirement = new BuyerRequirement({
    requirementId: generateRequirementId(),
    buyer: req.user._id,
    buyerName: buyer?.name || 'Buyer',
    buyerEmail: buyer?.email || '',
    buyerCompany: buyer?.companyName || 'Global Buyer Inc.',
    cropName,
    requiredQuantityKg: qty,
    requiredGrade,
    qualityRequirements,
    deliveryDestination: deliveryDestination.trim(),
    requiredDeliveryDate: new Date(requiredDeliveryDate),
    allocatedQuantityKg: 0,
    remainingQuantityKg: qty,
    status: 'pending_matching'
  });

  await requirement.save();

  // Run automatic matching algorithm to propose to 2-3 compatible farmers
  const matchedRequirement = await findCompatibleFarmersAndPropose(requirement);

  res.status(201).json({
    success: true,
    message: 'Requirement created successfully and compatible farmers notified with proposed contributions',
    requirement: matchedRequirement
  });
}));

/**
 * 2. Get Buyer Requirements / All Requirements (Admin)
 */
r.get('/', authenticate, asyncHandler(async (req, res) => {
  const query = {};
  if (req.user.role === 'buyer') {
    query.buyer = req.user._id;
  }
  if (req.query.cropName) {
    query.cropName = req.query.cropName;
  }
  if (req.query.status) {
    query.status = req.query.status;
  }

  const requirements = await BuyerRequirement.find(query)
    .populate('buyer', 'name email companyName phone')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ requirements });
}));

/**
 * 3. Farmer: Get My Proposed & Active Orders
 */
r.get('/farmer/orders', authenticate, requireRole('farmer'), asyncHandler(async (req, res) => {
  const requirements = await BuyerRequirement.find({
    'contributions.farmer': req.user._id
  })
    .sort({ createdAt: -1 })
    .lean();

  // Extract orders relevant to this farmer
  const orders = [];
  for (const reqItem of requirements) {
    const farmerContribs = (reqItem.contributions || []).filter(
      (c) => c.farmer.toString() === req.user._id.toString()
    );

    for (const contrib of farmerContribs) {
      // Find current crop free stock
      const cropDoc = await Crop.findById(contrib.crop).lean();
      let freeStockKg = 0;
      if (cropDoc) {
        const factor = cropDoc.unit === 'tonne' ? 1000 : cropDoc.unit === 'quintal' ? 100 : 1;
        const total = (cropDoc.quantity || 0) * factor;
        freeStockKg = Math.max(
          0,
          total - (cropDoc.proposedQuantity || 0) - (cropDoc.reservedQuantity || 0) - (cropDoc.collectedQuantity || 0)
        );
      }

      orders.push({
        requirementId: reqItem.requirementId,
        requirementMongoId: reqItem._id,
        contributionId: contrib.contributionId,
        buyerName: reqItem.buyerName,
        buyerCompany: reqItem.buyerCompany,
        cropName: reqItem.cropName,
        totalLotSizeKg: reqItem.requiredQuantityKg,
        requiredGrade: reqItem.requiredGrade,
        qualityRequirements: reqItem.qualityRequirements,
        deliveryDestination: reqItem.deliveryDestination,
        proposedQuantityKg: contrib.proposedQuantityKg,
        status: contrib.status,
        collectionStatus: contrib.collectionStatus,
        proposedAt: contrib.proposedAt,
        respondedAt: contrib.respondedAt,
        collectedAt: contrib.collectedAt,
        actualWeighedKg: contrib.actualWeighedKg,
        acceptedQuantityKg: contrib.acceptedQuantityKg,
        rejectedQuantityKg: contrib.rejectedQuantityKg,
        vehicle: reqItem.vehicle || {},
        farmerStock: {
          cropId: contrib.crop,
          availableStockKg: freeStockKg,
          reservedStockKg: cropDoc?.reservedQuantity || 0
        }
      });
    }
  }

  res.json({ orders });
}));

/**
 * 4. Farmer: Respond to Proposed Order (Accept / Reject)
 */
r.post('/farmer/orders/:requirementId/:contributionId/respond', authenticate, requireRole('farmer'), asyncHandler(async (req, res) => {
  const { action } = req.body;
  if (!['accept', 'reject'].includes(action)) {
    throw new ApiError(400, 'Action must be "accept" or "reject"');
  }

  const result = await farmerRespondToOrder({
    farmerId: req.user._id,
    requirementId: req.params.requirementId,
    contributionId: req.params.contributionId,
    action
  });

  res.json(result);
}));

/**
 * 5. Admin: Assign Vehicle with Capacity Check
 */
r.post('/:id/assign-vehicle', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const requirement = await assignVehicleToRequirement({
    requirementId: req.params.id,
    vehicleData: req.body
  });

  res.json({
    success: true,
    message: 'Vehicle successfully assigned and route created for farmer pickups',
    requirement
  });
}));

/**
 * 6. Admin: Update Vehicle Workflow Status
 */
r.patch('/:id/vehicle-status', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const { newStatus, trackingNotes } = req.body;
  const requirement = await updateVehicleWorkflowStatus({
    requirementId: req.params.id,
    newStatus,
    trackingNotes
  });

  res.json({
    success: true,
    message: `Vehicle status transitioned to "${newStatus}"`,
    requirement
  });
}));

/**
 * 7. Admin / Field Agent: Record Farmer Produce Collection & QC
 */
r.post('/:id/collect', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  const { contributionId } = req.body;
  if (!contributionId) {
    throw new ApiError(400, 'contributionId is required');
  }

  const result = await recordFarmerProduceCollection({
    requirementId: req.params.id,
    contributionId,
    collectionData: req.body
  });

  res.json({
    success: true,
    message: 'Farmer collection and quality inspection recorded successfully',
    ...result
  });
}));

/**
 * 8. Buyer: Confirm Delivery
 */
r.post('/:id/confirm-delivery', authenticate, requireRole('buyer'), asyncHandler(async (req, res) => {
  const requirement = await confirmBuyerDelivery({
    requirementId: req.params.id,
    buyerId: req.user._id,
    deliveryData: req.body
  });

  res.json({
    success: true,
    message: 'Delivery confirmed successfully by buyer. Process complete!',
    requirement
  });
}));

/**
 * 9. Single Requirement Details
 */
r.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const requirement = await BuyerRequirement.findOne({
    $or: [{ _id: req.params.id }, { requirementId: req.params.id }]
  })
    .populate('buyer', 'name email companyName phone')
    .lean();

  if (!requirement) {
    throw new ApiError(404, 'Requirement not found');
  }

  res.json({ requirement });
}));

export default r;
