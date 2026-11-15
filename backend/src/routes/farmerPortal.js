import express from 'express';
import { Crop, ALLOWED_CROPS } from '../models/Crop.js';
import { BuyerRequirement } from '../models/BuyerRequirement.js';
import { FarmerPayment } from '../models/FarmerPayment.js';
import { User } from '../models/User.js';
import { asyncHandler, ApiError } from '../middleware/http.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate, requireRole('farmer'));

/**
 * GET /api/farmer/dashboard
 * Live overview of farmer's uploaded produce, allocations, scheduled collections, and earnings.
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  const farmerId = req.user._id;

  const [crops, payments, requirements, user] = await Promise.all([
    Crop.find({ farmer: farmerId }).sort('-createdAt').lean(),
    FarmerPayment.find({ farmer: farmerId }).sort('-createdAt').lean(),
    BuyerRequirement.find({ 'allocations.farmer': farmerId }).sort('-createdAt').lean(),
    User.findById(farmerId).lean()
  ]);

  let totalUploadedKg = 0;
  let availableKg = 0;
  let allocatedKg = 0;
  let collectedKg = 0;

  const cropBreakdown = {
    Ragi: { totalKg: 0, availableKg: 0, allocatedKg: 0, collectedKg: 0 },
    Rice: { totalKg: 0, availableKg: 0, allocatedKg: 0, collectedKg: 0 },
    Jowar: { totalKg: 0, availableKg: 0, allocatedKg: 0, collectedKg: 0 }
  };

  for (const crop of crops) {
    const total = crop.totalQuantityKg || crop.quantity || 0;
    const avail = typeof crop.availableQuantityKg === 'number' ? crop.availableQuantityKg : total;
    const alloc = crop.allocatedQuantityKg || 0;
    const coll = crop.collectedQuantityKg || 0;

    totalUploadedKg += total;
    availableKg += avail;
    allocatedKg += alloc;
    collectedKg += coll;

    if (cropBreakdown[crop.name]) {
      cropBreakdown[crop.name].totalKg += total;
      cropBreakdown[crop.name].availableKg += avail;
      cropBreakdown[crop.name].allocatedKg += alloc;
      cropBreakdown[crop.name].collectedKg += coll;
    }
  }

  let totalEarningsInr = 0;
  let pendingPaymentsInr = 0;
  let completedPaymentsCount = 0;

  for (const payment of payments) {
    if (payment.status === 'completed') {
      totalEarningsInr += payment.finalPayableAmountInr || 0;
      completedPaymentsCount++;
    } else {
      pendingPaymentsInr += payment.finalPayableAmountInr || 0;
    }
  }

  // Active collections where vehicle is assigned / in transit
  const activeCollections = [];
  for (const reqItem of requirements) {
    const myAlloc = (reqItem.allocations || []).find((a) => a.farmer.toString() === farmerId.toString());
    if (myAlloc && reqItem.vehicle && reqItem.vehicle.currentStatus !== 'none' && myAlloc.collectionStatus !== 'collected') {
      activeCollections.push({
        requirementId: reqItem.requirementId,
        cropName: reqItem.cropName,
        allocatedQuantityKg: myAlloc.allocatedQuantityKg,
        vehicleType: reqItem.vehicle.vehicleType,
        registrationNumber: reqItem.vehicle.registrationNumber,
        driverName: reqItem.vehicle.driverName,
        driverPhone: reqItem.vehicle.driverPhone,
        scheduledPickupDate: reqItem.vehicle.scheduledPickupDate,
        vehicleStatus: reqItem.vehicle.currentStatus,
        routeNotes: reqItem.vehicle.trackingNotes
      });
    }
  }

  res.json({
    farmerName: user.name,
    farmLocation: user.farmLocation || {},
    metrics: {
      totalUploadedKg,
      availableKg,
      allocatedKg,
      collectedKg,
      totalEarningsInr,
      pendingPaymentsInr,
      completedPaymentsCount,
      activeCollectionsCount: activeCollections.length
    },
    cropBreakdown,
    activeCollections,
    recentPayments: payments.slice(0, 5)
  });
}));

/**
 * POST /api/farmer/crops
 * Upload new produce (Ragi, Rice, Jowar only).
 * Automatically calculates standard kg and initial available quantity.
 */
router.post('/crops', asyncHandler(async (req, res) => {
  const {
    name,
    quantity,
    unit = 'kg',
    expectedPricePerQuintal,
    priceInr,
    harvestDate,
    grade = 'Grade A',
    qualityDescription,
    farmAddress,
    village,
    hobli,
    taluk,
    district,
    state = 'Karnataka',
    pincode,
    coordinates
  } = req.body;

  if (!ALLOWED_CROPS.includes(name)) {
    throw new ApiError(400, `Invalid crop name "${name}". Allowed crops are strictly: ${ALLOWED_CROPS.join(', ')}`);
  }

  const numericQuantity = Number(quantity);
  if (!numericQuantity || numericQuantity <= 0) {
    throw new ApiError(400, 'Quantity must be a positive number');
  }

  // Convert quantity to normalized standard kilograms
  let totalQuantityKg = numericQuantity;
  if (unit === 'quintal') totalQuantityKg = numericQuantity * 100;
  if (unit === 'tonne') totalQuantityKg = numericQuantity * 1000;

  // Expected price handling: price per kg vs per quintal
  let resolvedPricePerKg = Number(priceInr);
  let resolvedPricePerQuintal = Number(expectedPricePerQuintal);

  if (!resolvedPricePerKg && resolvedPricePerQuintal) {
    resolvedPricePerKg = Math.round(resolvedPricePerQuintal / 100);
  } else if (!resolvedPricePerQuintal && resolvedPricePerKg) {
    resolvedPricePerQuintal = resolvedPricePerKg * 100;
  } else if (!resolvedPricePerKg && !resolvedPricePerQuintal) {
    resolvedPricePerKg = name === 'Ragi' ? 38 : name === 'Rice' ? 48 : 40;
    resolvedPricePerQuintal = resolvedPricePerKg * 100;
  }

  // Farm address and coordinates fallback to User profile if not passed
  const user = await User.findById(req.user._id);
  const defaultLoc = user?.farmLocation || {};

  const fullAddress = farmAddress || [village, hobli, taluk, district, state].filter(Boolean).join(', ') || defaultLoc.address || 'Karnataka, India';
  const resolvedCoords = {
    latitude: coordinates?.latitude || defaultLoc.latitude || 12.9716,
    longitude: coordinates?.longitude || defaultLoc.longitude || 77.5946
  };

  const newCrop = await Crop.create({
    farmer: req.user._id,
    name,
    category: 'Grains',
    quantity: numericQuantity,
    unit,
    totalQuantityKg,
    availableQuantityKg: totalQuantityKg,
    allocatedQuantityKg: 0,
    collectedQuantityKg: 0,
    expectedPricePerQuintal: resolvedPricePerQuintal,
    priceInr: resolvedPricePerKg,
    harvestDate: harvestDate ? new Date(harvestDate) : new Date(),
    grade,
    qualityDescription: qualityDescription || `${grade} standard farm produce with certified moisture level.`,
    farmAddress: fullAddress,
    village: village || defaultLoc.village || '',
    hobli: hobli || defaultLoc.hobli || '',
    taluk: taluk || defaultLoc.taluk || '',
    district: district || defaultLoc.district || 'Mandya',
    state: state || defaultLoc.state || 'Karnataka',
    pincode: pincode || defaultLoc.pincode || '',
    location: fullAddress,
    coordinates: resolvedCoords,
    latitude: resolvedCoords.latitude,
    longitude: resolvedCoords.longitude,
    status: 'available',
    cropStatus: 'available'
  });

  // Also update user profile with latest farm location if missing
  if (!user.farmLocation || !user.farmLocation.village) {
    user.farmLocation = {
      address: fullAddress,
      village: village || defaultLoc.village || '',
      hobli: hobli || defaultLoc.hobli || '',
      taluk: taluk || defaultLoc.taluk || '',
      district: district || defaultLoc.district || '',
      state: state || defaultLoc.state || 'Karnataka',
      pincode: pincode || defaultLoc.pincode || '',
      latitude: resolvedCoords.latitude,
      longitude: resolvedCoords.longitude
    };
    await user.save();
  }

  res.status(201).json({
    message: 'Produce listed successfully. It is now eligible for automatic procurement allocation.',
    crop: newCrop
  });
}));

/**
 * GET /api/farmer/inventory
 * Return all produce listed by the farmer with quantity distribution (total, available, allocated, collected).
 * NOTE: Zero accept/reject buttons or actions are present.
 */
router.get('/inventory', asyncHandler(async (req, res) => {
  const crops = await Crop.find({ farmer: req.user._id }).sort('-createdAt').lean();

  const formatted = crops.map((c) => ({
    _id: c._id,
    cropId: c.cropId || c._id,
    name: c.name,
    grade: c.grade || 'Grade A',
    totalQuantityKg: c.totalQuantityKg || (c.quantity * (c.unit === 'tonne' ? 1000 : c.unit === 'quintal' ? 100 : 1)),
    availableQuantityKg: typeof c.availableQuantityKg === 'number' ? c.availableQuantityKg : c.quantity,
    allocatedQuantityKg: c.allocatedQuantityKg || 0,
    collectedQuantityKg: c.collectedQuantityKg || 0,
    unit: c.unit || 'kg',
    pricePerKg: c.priceInr || Math.round((c.expectedPricePerQuintal || 3800) / 100),
    expectedPricePerQuintal: c.expectedPricePerQuintal || (c.priceInr ? c.priceInr * 100 : 3800),
    harvestDate: c.harvestDate,
    farmAddress: c.farmAddress || c.location,
    status: c.status || 'available',
    createdAt: c.createdAt
  }));

  res.json({ inventory: formatted });
}));

/**
 * GET /api/farmer/collections
 * Scheduled vehicle collections, assigned drivers, and live progress.
 */
router.get('/collections', asyncHandler(async (req, res) => {
  const farmerId = req.user._id;

  const requirements = await BuyerRequirement.find({
    'allocations.farmer': farmerId
  }).sort('-createdAt').lean();

  const collections = [];

  for (const r of requirements) {
    const alloc = (r.allocations || []).find((a) => a.farmer.toString() === farmerId.toString());
    if (!alloc) continue;

    collections.push({
      requirementId: r.requirementId,
      allocationId: alloc.allocationId,
      cropName: r.cropName,
      grade: alloc.grade || 'Grade A',
      allocatedQuantityKg: alloc.allocatedQuantityKg,
      procurementPricePerKg: alloc.procurementPricePerKg,
      farmerGrossPayable: alloc.farmerGrossPayable,
      collectionStatus: alloc.collectionStatus,
      actualWeighedKg: alloc.actualWeighedKg,
      acceptedQuantityKg: alloc.acceptedQuantityKg,
      rejectedQuantityKg: alloc.rejectedQuantityKg,
      qcGrade: alloc.qcGrade,
      collectionNotes: alloc.collectionNotes,
      collectedAt: alloc.collectedAt,
      vehicle: r.vehicle ? {
        vehicleType: r.vehicle.vehicleType,
        registrationNumber: r.vehicle.registrationNumber,
        capacityKg: r.vehicle.capacityKg,
        driverName: r.vehicle.driverName,
        driverPhone: r.vehicle.driverPhone,
        scheduledPickupDate: r.vehicle.scheduledPickupDate,
        currentStatus: r.vehicle.currentStatus,
        route: r.vehicle.route,
        trackingNotes: r.vehicle.trackingNotes
      } : null,
      deliveryDestination: r.deliveryDestination,
      createdAt: alloc.allocatedAt || r.createdAt
    });
  }

  res.json({ collections });
}));

/**
 * GET /api/farmer/payments
 * Transparent payment breakdown (gross, deductions, net payout, transaction reference, status).
 */
router.get('/payments', asyncHandler(async (req, res) => {
  const payments = await FarmerPayment.find({ farmer: req.user._id })
    .sort('-createdAt')
    .lean();

  res.json({ payments });
}));

/**
 * GET /api/farmer/profile
 * Get farm location, bank account details, contact info.
 */
router.get('/profile', asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-passwordHash').lean();
  res.json({ user });
}));

/**
 * PUT /api/farmer/profile
 * Update farm location, GPS coordinates, bank account, phone.
 */
router.put('/profile', asyncHandler(async (req, res) => {
  const { farmLocation, bankAccount, phone, name } = req.body;
  const user = await User.findById(req.user._id);

  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (farmLocation) {
    user.farmLocation = {
      ...(user.farmLocation?.toObject?.() || user.farmLocation || {}),
      ...farmLocation
    };
  }
  if (bankAccount) {
    user.bankAccount = {
      ...(user.bankAccount?.toObject?.() || user.bankAccount || {}),
      ...bankAccount
    };
  }

  await user.save();
  res.json({ message: 'Profile updated successfully', user });
}));

export default router;
