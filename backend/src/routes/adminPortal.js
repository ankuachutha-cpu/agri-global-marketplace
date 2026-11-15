import express from 'express';
import { User } from '../models/User.js';
import { Crop, ALLOWED_CROPS } from '../models/Crop.js';
import { BuyerRequirement, VEHICLE_TYPES } from '../models/BuyerRequirement.js';
import { FarmerPayment } from '../models/FarmerPayment.js';
import { PriceConfiguration } from '../models/PriceConfiguration.js';
import { AggregationLot } from '../models/AggregationLot.js';
import {
  matchAndAllocateRequirement,
  assignVehicleToRequirement,
  updateCollectionWorkflowStatus,
  recordFarmProduceWeighingAndQC
} from '../services/automatedProcurementEngine.js';
import { asyncHandler, ApiError } from '../middleware/http.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import crypto from 'node:crypto';

const router = express.Router();
router.use(authenticate, requireRole('admin'));

/**
 * GET /api/admin-portal/dashboard
 * Live admin KPIs and MongoDB summary for Ragi, Rice, and Jowar.
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  const [
    totalFarmers,
    totalBuyers,
    crops,
    requirements,
    payments,
    lotsCount
  ] = await Promise.all([
    User.countDocuments({ role: 'farmer' }),
    User.countDocuments({ role: 'buyer' }),
    Crop.find({ name: { $in: ALLOWED_CROPS } }).lean(),
    BuyerRequirement.find({}).sort('-createdAt').lean(),
    FarmerPayment.find({}).lean(),
    AggregationLot.countDocuments({})
  ]);

  let totalInventoryKg = 0;
  let totalAvailableKg = 0;
  let totalAllocatedKg = 0;
  let totalCollectedKg = 0;

  const cropBreakdown = {
    Ragi: { totalKg: 0, availableKg: 0, allocatedKg: 0, collectedKg: 0 },
    Rice: { totalKg: 0, availableKg: 0, allocatedKg: 0, collectedKg: 0 },
    Jowar: { totalKg: 0, availableKg: 0, allocatedKg: 0, collectedKg: 0 }
  };

  for (const crop of crops) {
    const total = crop.totalQuantityKg || (crop.quantity * (crop.unit === 'tonne' ? 1000 : crop.unit === 'quintal' ? 100 : 1)) || 0;
    const avail = typeof crop.availableQuantityKg === 'number' ? crop.availableQuantityKg : total;
    const alloc = crop.allocatedQuantityKg || 0;
    const coll = crop.collectedQuantityKg || 0;

    totalInventoryKg += total;
    totalAvailableKg += avail;
    totalAllocatedKg += alloc;
    totalCollectedKg += coll;

    if (cropBreakdown[crop.name]) {
      cropBreakdown[crop.name].totalKg += total;
      cropBreakdown[crop.name].availableKg += avail;
      cropBreakdown[crop.name].allocatedKg += alloc;
      cropBreakdown[crop.name].collectedKg += coll;
    }
  }

  let activeRequirementsCount = 0;
  let completedRequirementsCount = 0;
  let vehiclesDeployedCount = 0;

  for (const r of requirements) {
    if (r.status === 'completed' || r.delivery?.confirmedByBuyer) {
      completedRequirementsCount++;
    } else {
      activeRequirementsCount++;
    }
    if (r.vehicle && r.vehicle.currentStatus && r.vehicle.currentStatus !== 'none') {
      vehiclesDeployedCount++;
    }
  }

  let totalPaymentVolumeInr = 0;
  let pendingPaymentsInr = 0;
  let completedPaymentsInr = 0;

  for (const p of payments) {
    const amt = p.finalPayableAmountInr || 0;
    totalPaymentVolumeInr += amt;
    if (p.status === 'completed') {
      completedPaymentsInr += amt;
    } else {
      pendingPaymentsInr += amt;
    }
  }

  res.json({
    metrics: {
      totalFarmers,
      totalBuyers,
      totalInventoryKg,
      totalAvailableKg,
      totalAllocatedKg,
      totalCollectedKg,
      activeRequirementsCount,
      completedRequirementsCount,
      vehiclesDeployedCount,
      lotsCount,
      totalPaymentVolumeInr,
      pendingPaymentsInr,
      completedPaymentsInr
    },
    cropBreakdown,
    recentRequirements: requirements.slice(0, 5),
    recentPayments: payments.slice(-5).reverse()
  });
}));

/**
 * GET /api/admin-portal/farmers
 * Farmer directory with farm locations and listed stock counts.
 */
router.get('/farmers', asyncHandler(async (req, res) => {
  const farmers = await User.find({ role: 'farmer' }).select('-passwordHash').sort('-createdAt').lean();
  const farmerIds = farmers.map((f) => f._id);

  const crops = await Crop.find({ farmer: { $in: farmerIds } }).lean();

  const formatted = farmers.map((f) => {
    const myCrops = crops.filter((c) => c.farmer.toString() === f._id.toString());
    const totalListedKg = myCrops.reduce(
      (sum, c) => sum + (c.totalQuantityKg || (c.quantity * (c.unit === 'tonne' ? 1000 : c.unit === 'quintal' ? 100 : 1))),
      0
    );
    const availableStockKg = myCrops.reduce(
      (sum, c) => sum + (typeof c.availableQuantityKg === 'number' ? c.availableQuantityKg : c.quantity),
      0
    );

    return {
      _id: f._id,
      name: f.name,
      email: f.email,
      phone: f.phone,
      farmLocation: f.farmLocation || {},
      active: f.active !== false,
      verificationStatus: f.verificationStatus || 'verified',
      cropsCount: myCrops.length,
      totalListedKg,
      availableStockKg,
      bankAccountConfigured: !!(f.bankAccount?.accountNumber || f.bankAccount?.upiId),
      createdAt: f.createdAt
    };
  });

  res.json({ farmers: formatted });
}));

/**
 * PATCH /api/admin-portal/farmers/:id/status
 * Toggle farmer active or verification status.
 */
router.patch('/farmers/:id/status', asyncHandler(async (req, res) => {
  const { active, verificationStatus } = req.body;
  const user = await User.findById(req.params.id);
  if (!user || user.role !== 'farmer') {
    throw new ApiError(404, 'Farmer not found');
  }

  if (typeof active === 'boolean') user.active = active;
  if (verificationStatus) user.verificationStatus = verificationStatus;

  await user.save();
  res.json({ message: 'Farmer status updated', user });
}));

/**
 * GET /api/admin-portal/buyers
 * Buyer directory with active demands and procurement metrics.
 */
router.get('/buyers', asyncHandler(async (req, res) => {
  const buyers = await User.find({ role: 'buyer' }).select('-passwordHash').sort('-createdAt').lean();
  const buyerIds = buyers.map((b) => b._id);

  const requirements = await BuyerRequirement.find({ buyer: { $in: buyerIds } }).lean();

  const formatted = buyers.map((b) => {
    const myReqs = requirements.filter((r) => r.buyer.toString() === b._id.toString());
    const totalDemandedKg = myReqs.reduce((sum, r) => sum + (r.requiredQuantityKg || 0), 0);
    const totalProcuredKg = myReqs.reduce((sum, r) => sum + (r.allocatedQuantityKg || 0), 0);

    return {
      _id: b._id,
      name: b.name,
      email: b.email,
      companyName: b.companyName || b.organization || b.name,
      gstin: b.gstin || '',
      country: b.country || 'India',
      phone: b.phone || '',
      requirementsCount: myReqs.length,
      totalDemandedKg,
      totalProcuredKg,
      createdAt: b.createdAt
    };
  });

  res.json({ buyers: formatted });
}));

/**
 * GET /api/admin-portal/inventory
 * Centralized crop inventory for Ragi, Rice, and Jowar with filters.
 */
router.get('/inventory', asyncHandler(async (req, res) => {
  const { cropName, grade, status, district } = req.query;

  const query = { name: { $in: ALLOWED_CROPS } };
  if (cropName && ALLOWED_CROPS.includes(cropName)) query.name = cropName;
  if (grade) query.grade = grade;
  if (status) query.status = status;
  if (district) query.district = new RegExp(district, 'i');

  const crops = await Crop.find(query)
    .populate('farmer', 'name phone email farmLocation')
    .sort('-createdAt')
    .lean();

  const formatted = crops.map((c) => ({
    _id: c._id,
    name: c.name,
    farmerName: c.farmer?.name || 'Registered Farmer',
    farmerPhone: c.farmer?.phone || '',
    farmerEmail: c.farmer?.email || '',
    totalQuantityKg: c.totalQuantityKg || (c.quantity * (c.unit === 'tonne' ? 1000 : c.unit === 'quintal' ? 100 : 1)),
    availableQuantityKg: typeof c.availableQuantityKg === 'number' ? c.availableQuantityKg : c.quantity,
    allocatedQuantityKg: c.allocatedQuantityKg || 0,
    collectedQuantityKg: c.collectedQuantityKg || 0,
    grade: c.grade || 'Grade A',
    pricePerKg: c.priceInr || Math.round((c.expectedPricePerQuintal || 3800) / 100),
    expectedPricePerQuintal: c.expectedPricePerQuintal || (c.priceInr ? c.priceInr * 100 : 3800),
    farmAddress: c.farmAddress || c.location,
    village: c.village || '',
    taluk: c.taluk || '',
    district: c.district || 'Mandya',
    status: c.status || 'available',
    createdAt: c.createdAt
  }));

  res.json({ inventory: formatted });
}));

/**
 * GET /api/admin-portal/procurement
 * All buyer requirements, automated allocations, aggregation lots, vehicle details.
 */
router.get('/procurement', asyncHandler(async (req, res) => {
  const requirements = await BuyerRequirement.find({})
    .populate('buyer', 'name email companyName phone')
    .populate('aggregationLot')
    .sort('-createdAt')
    .lean();

  res.json({ requirements });
}));

/**
 * POST /api/admin-portal/procurement/:id/reallocate
 * Re-trigger automated matching or allocate remaining needed quantity.
 */
router.post('/procurement/:id/reallocate', asyncHandler(async (req, res) => {
  const requirement = await BuyerRequirement.findById(req.params.id);
  if (!requirement) {
    throw new ApiError(404, 'Requirement not found');
  }

  await matchAndAllocateRequirement(requirement);
  res.json({ message: 'Requirement re-allocated successfully', requirement });
}));

/**
 * GET /api/admin-portal/vehicles
 * Vehicle fleet and active assignment status.
 */
router.get('/vehicles', asyncHandler(async (req, res) => {
  const activeAssignments = await BuyerRequirement.find({
    'vehicle.currentStatus': { $ne: 'none' }
  })
    .select('requirementId cropName requiredQuantityKg allocatedQuantityKg collectedQuantityKg vehicle deliveryDestination status')
    .sort('-vehicle.assignedAt')
    .lean();

  res.json({
    vehicleTypes: VEHICLE_TYPES,
    activeAssignments
  });
}));

/**
 * POST /api/admin-portal/requirements/:id/assign-vehicle
 * Assign vehicle with capacity check (weight <= vehicle capacity).
 */
router.post('/requirements/:id/assign-vehicle', asyncHandler(async (req, res) => {
  const { vehicleType, registrationNumber, capacityKg, driverName, driverPhone, scheduledPickupDate } = req.body;

  const requirement = await assignVehicleToRequirement({
    requirementId: req.params.id,
    vehicleData: {
      vehicleType,
      registrationNumber,
      capacityKg,
      driverName,
      driverPhone,
      scheduledPickupDate
    }
  });

  res.json({
    message: 'Vehicle assigned successfully to multi-farm pickup route.',
    requirement
  });
}));

/**
 * PATCH /api/admin-portal/requirements/:id/vehicle-status
 * Progress vehicle workflow status.
 */
router.patch('/requirements/:id/vehicle-status', asyncHandler(async (req, res) => {
  const { status, trackingNotes } = req.body;

  const requirement = await updateCollectionWorkflowStatus({
    requirementId: req.params.id,
    newStatus: status,
    trackingNotes
  });

  res.json({
    message: `Vehicle status transitioned to ${status}.`,
    requirement
  });
}));

/**
 * POST /api/admin-portal/requirements/:id/collect
 * Record farm produce weighing and QC inspection.
 * Automatically deducts from farmer inventory, returns rejected to available, and generates FarmerPayment.
 */
router.post('/requirements/:id/collect', asyncHandler(async (req, res) => {
  const { allocationId, actualWeighedKg, acceptedQuantityKg, rejectedQuantityKg, qcGrade, collectionNotes, weightSlipImage } = req.body;

  if (!allocationId) {
    throw new ApiError(400, 'allocationId is required');
  }

  const result = await recordFarmProduceWeighingAndQC({
    requirementId: req.params.id,
    allocationId,
    qcData: {
      actualWeighedKg,
      acceptedQuantityKg,
      rejectedQuantityKg,
      qcGrade,
      collectionNotes,
      weightSlipImage
    }
  });

  res.json({
    message: 'Produce weighing and QC recorded. Farmer payment generated and inventory updated.',
    ...result
  });
}));

/**
 * GET /api/admin-portal/quality-control
 * Centralized QC inspection records.
 */
router.get('/quality-control', asyncHandler(async (req, res) => {
  const requirements = await BuyerRequirement.find({
    'allocations.collectionStatus': 'collected'
  }).sort('-updatedAt').lean();

  const qcRecords = [];
  for (const r of requirements) {
    for (const a of r.allocations || []) {
      if (a.collectionStatus === 'collected') {
        qcRecords.push({
          requirementId: r.requirementId,
          allocationId: a.allocationId,
          cropName: r.cropName,
          farmerName: a.farmerName,
          allocatedQuantityKg: a.allocatedQuantityKg,
          actualWeighedKg: a.actualWeighedKg,
          acceptedQuantityKg: a.acceptedQuantityKg,
          rejectedQuantityKg: a.rejectedQuantityKg,
          qcGrade: a.qcGrade || a.grade,
          collectionNotes: a.collectionNotes,
          weightSlipImage: a.weightSlipImage,
          collectedAt: a.collectedAt,
          driverName: r.vehicle?.driverName,
          vehicleNumber: r.vehicle?.registrationNumber
        });
      }
    }
  }

  res.json({ qcRecords });
}));

/**
 * GET /api/admin-portal/payments
 * All farmer payments and ledger.
 */
router.get('/payments', asyncHandler(async (req, res) => {
  const payments = await FarmerPayment.find({})
    .populate('farmer', 'name phone email farmLocation bankAccount')
    .sort('-createdAt')
    .lean();

  res.json({ payments });
}));

/**
 * POST /api/admin-portal/payments/:id/release
 * Release payment to farmer.
 */
router.post('/payments/:id/release', asyncHandler(async (req, res) => {
  const payment = await FarmerPayment.findById(req.params.id);
  if (!payment) {
    throw new ApiError(404, 'Payment record not found');
  }

  payment.status = 'completed';
  payment.paymentDate = new Date();
  if (!payment.transactionRef) {
    payment.transactionRef = `TXN-REL-${crypto.randomInt(100000, 999999)}`;
  }
  payment.notes = (payment.notes ? payment.notes + ' | ' : '') + 'Payment released by Admin via UPI/NEFT.';

  await payment.save();
  res.json({ message: 'Payment released successfully', payment });
}));

/**
 * GET /api/admin-portal/reports
 * Operational and financial reports.
 */
router.get('/reports', asyncHandler(async (req, res) => {
  const [crops, requirements, payments] = await Promise.all([
    Crop.find({ name: { $in: ALLOWED_CROPS } }).lean(),
    BuyerRequirement.find({}).lean(),
    FarmerPayment.find({}).lean()
  ]);

  const volumeByCrop = {
    Ragi: { totalUploadedKg: 0, allocatedKg: 0, collectedKg: 0, deliveredKg: 0 },
    Rice: { totalUploadedKg: 0, allocatedKg: 0, collectedKg: 0, deliveredKg: 0 },
    Jowar: { totalUploadedKg: 0, allocatedKg: 0, collectedKg: 0, deliveredKg: 0 }
  };

  for (const c of crops) {
    if (volumeByCrop[c.name]) {
      volumeByCrop[c.name].totalUploadedKg += c.totalQuantityKg || (c.quantity * (c.unit === 'tonne' ? 1000 : c.unit === 'quintal' ? 100 : 1)) || 0;
      volumeByCrop[c.name].allocatedKg += c.allocatedQuantityKg || 0;
      volumeByCrop[c.name].collectedKg += c.collectedQuantityKg || 0;
    }
  }

  for (const r of requirements) {
    if (volumeByCrop[r.cropName] && (r.status === 'completed' || r.delivery?.confirmedByBuyer)) {
      volumeByCrop[r.cropName].deliveredKg += r.delivery?.receivedQuantityKg || r.qcAcceptedQuantityKg || r.allocatedQuantityKg || 0;
    }
  }

  const financialSummary = {
    totalGrossFarmerPayoutInr: payments.reduce((sum, p) => sum + (p.grossAmountInr || 0), 0),
    totalCompletedPayoutInr: payments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + (p.finalPayableAmountInr || 0), 0),
    totalPendingPayoutInr: payments.filter((p) => p.status !== 'completed').reduce((sum, p) => sum + (p.finalPayableAmountInr || 0), 0),
    estimatedPlatformFeeInr: Math.round(payments.reduce((sum, p) => sum + (p.grossAmountInr || 0), 0) * 0.05)
  };

  res.json({
    volumeByCrop,
    financialSummary,
    totalRequirementsCount: requirements.length,
    completedRequirementsCount: requirements.filter((r) => r.status === 'completed').length,
    paymentsCount: payments.length
  });
}));

/**
 * GET /api/admin-portal/settings
 * Configurable reference prices and parameters.
 */
router.get('/settings', asyncHandler(async (req, res) => {
  let configs = await PriceConfiguration.find({}).lean();

  if (!configs || configs.length === 0) {
    // Seed initial price configs for Ragi, Rice, Jowar
    const defaults = [
      {
        cropName: 'Ragi',
        mandiReferencePricePerKg: 35,
        defaultFarmerProcurementPricePerKg: 37,
        buyerProcurementRatePerKg: 42,
        platformMarginPercent: 5,
        logisticsCostPerKg: 2
      },
      {
        cropName: 'Rice',
        mandiReferencePricePerKg: 44,
        defaultFarmerProcurementPricePerKg: 46,
        buyerProcurementRatePerKg: 52,
        platformMarginPercent: 5,
        logisticsCostPerKg: 2.5
      },
      {
        cropName: 'Jowar',
        mandiReferencePricePerKg: 38,
        defaultFarmerProcurementPricePerKg: 40,
        buyerProcurementRatePerKg: 45,
        platformMarginPercent: 5,
        logisticsCostPerKg: 2
      }
    ];
    configs = await PriceConfiguration.insertMany(defaults);
  }

  res.json({ configurations: configs });
}));

/**
 * PUT /api/admin-portal/settings
 * Update price configurations and parameters.
 */
router.put('/settings', asyncHandler(async (req, res) => {
  const { configurations } = req.body;
  if (!Array.isArray(configurations)) {
    throw new ApiError(400, 'configurations array is required');
  }

  const updated = [];
  for (const item of configurations) {
    if (ALLOWED_CROPS.includes(item.cropName)) {
      const doc = await PriceConfiguration.findOneAndUpdate(
        { cropName: item.cropName },
        {
          mandiReferencePricePerKg: Number(item.mandiReferencePricePerKg) || 35,
          defaultFarmerProcurementPricePerKg: Number(item.defaultFarmerProcurementPricePerKg) || 37,
          buyerProcurementRatePerKg: Number(item.buyerProcurementRatePerKg) || 42,
          platformMarginPercent: Number(item.platformMarginPercent) || 5,
          logisticsCostPerKg: Number(item.logisticsCostPerKg) || 2,
          qualityAdjustments: item.qualityAdjustments || { gradeA: 0, gradeB: -2, gradeC: -4 },
          updatedBy: req.user._id
        },
        { upsert: true, new: true }
      );
      updated.push(doc);
    }
  }

  res.json({ message: 'Pricing configurations updated successfully', configurations: updated });
}));

export default router;
