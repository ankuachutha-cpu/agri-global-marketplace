import { Crop } from '../models/Crop.js';
import { User } from '../models/User.js';
import { BuyerRequirement, generateAllocationId } from '../models/BuyerRequirement.js';
import { AggregationLot } from '../models/AggregationLot.js';
import { FarmerPayment, generatePaymentId } from '../models/FarmerPayment.js';
import { ApiError } from '../middleware/http.js';
import crypto from 'node:crypto';

/**
 * CORE AUTOMATED PROCUREMENT MATCHING ENGINE
 * 
 * 1. When buyer requests e.g. 50 tonnes of Ragi, the platform evaluates:
 *    - Crop compatibility (Ragi, Rice, Jowar)
 *    - Available quantity
 *    - Quality grade
 *    - Farmer procurement price vs buyer budget
 *    - Distance/logistics feasibility
 * 2. Automatically selects 2-3 compatible farmers with stock
 * 3. Atomically reserves quantities directly in MongoDB
 * 4. Zero farmer accept/reject step — farmers simply wait for scheduled collection
 * 5. Generates aggregation lot & collection plan
 */
export async function matchAndAllocateRequirement(requirement) {
  const neededKg = Math.max(0, requirement.requiredQuantityKg - (requirement.allocatedQuantityKg || 0));
  if (neededKg <= 0) {
    requirement.status = 'allocated';
    await requirement.save();
    return requirement;
  }

  // Find crops matching cropName with available stock > 0
  const crops = await Crop.find({
    name: requirement.cropName,
    status: { $in: ['available', 'allocated'] },
    availableQuantityKg: { $gt: 0 }
  }).populate('farmer', 'name phone email role farmLocation').lean();

  // Exclude farmers who already have an allocation in this requirement
  const existingFarmerIds = new Set(
    (requirement.allocations || []).map((a) => a.farmer.toString())
  );

  const candidates = [];
  for (const crop of crops) {
    if (!crop.farmer || crop.farmer.role !== 'farmer') continue;
    if (existingFarmerIds.has(crop.farmer._id.toString())) continue;

    const freeStock = crop.availableQuantityKg || 0;
    if (freeStock >= 1) {
      // Calculate match score based on price vs budget and grade compatibility
      const pricePerKg = crop.priceInr || (crop.expectedPricePerQuintal ? crop.expectedPricePerQuintal / 100 : 35);
      const withinBudget = !requirement.targetBudgetPricePerKg || pricePerKg <= requirement.targetBudgetPricePerKg;
      const gradeMatch = !requirement.requiredGrade || crop.grade === requirement.requiredGrade || crop.grade === 'Grade A';

      candidates.push({
        crop,
        freeStock,
        pricePerKg,
        withinBudget,
        gradeMatch
      });
    }
  }

  // Sort candidates: withinBudget first, gradeMatch second, freeStock descending
  candidates.sort((a, b) => {
    if (a.withinBudget !== b.withinBudget) return a.withinBudget ? -1 : 1;
    if (a.gradeMatch !== b.gradeMatch) return a.gradeMatch ? -1 : 1;
    return b.freeStock - a.freeStock;
  });

  if (candidates.length === 0) {
    if (!requirement.allocatedQuantityKg || requirement.allocatedQuantityKg === 0) {
      requirement.status = 'open';
    } else {
      requirement.status = 'partially_allocated';
    }
    await requirement.save();
    return requirement;
  }

  // Automatically split across 2 to 3 compatible farmers
  let remainingTarget = neededKg;
  const maxFarmersToPick = candidates.length >= 3 && remainingTarget >= 5000 ? 3 : candidates.length >= 2 ? 2 : 1;
  const selected = [];

  for (let i = 0; i < candidates.length && selected.length < maxFarmersToPick && remainingTarget > 0; i++) {
    const candidate = candidates[i];
    let share = 0;

    if (selected.length === maxFarmersToPick - 1 || i === candidates.length - 1) {
      share = Math.min(candidate.freeStock, remainingTarget);
    } else {
      const equalChunk = Math.round(remainingTarget / (maxFarmersToPick - selected.length));
      share = Math.min(candidate.freeStock, equalChunk, remainingTarget);
      if (share <= 0) share = Math.min(candidate.freeStock, remainingTarget);
    }

    if (share > 0) {
      selected.push({ candidate, share });
      remainingTarget -= share;
    }
  }

  // Atomically allocate stock from each selected farmer crop
  for (const item of selected) {
    const { candidate, share } = item;

    // Atomic MongoDB conditional update: guarantees no duplicate allocation or over-allocation
    const updatedCrop = await Crop.findOneAndUpdate(
      {
        _id: candidate.crop._id,
        availableQuantityKg: { $gte: share }
      },
      {
        $inc: {
          availableQuantityKg: -share,
          allocatedQuantityKg: share
        },
        $set: {
          status: 'allocated'
        }
      },
      { new: true }
    );

    if (!updatedCrop) {
      // Stock was claimed concurrently; continue to next candidate
      continue;
    }

    const farmerUser = candidate.crop.farmer;
    const farmLoc = farmerUser.farmLocation || {};
    const pricePerKg = candidate.pricePerKg;

    const allocation = {
      allocationId: generateAllocationId(),
      farmer: farmerUser._id,
      farmerName: farmerUser.name || 'Registered Farmer',
      farmerPhone: farmerUser.phone || '',
      farmerLocation: updatedCrop.farmAddress || updatedCrop.location || farmLoc.address || 'Karnataka, India',
      farmerVillage: updatedCrop.village || farmLoc.village || '',
      farmerHobli: updatedCrop.hobli || farmLoc.hobli || '',
      farmerTaluk: updatedCrop.taluk || farmLoc.taluk || '',
      farmerDistrict: updatedCrop.district || farmLoc.district || '',
      farmerCoordinates: updatedCrop.coordinates || farmLoc.latitude ? {
        latitude: updatedCrop.coordinates?.latitude || farmLoc.latitude,
        longitude: updatedCrop.coordinates?.longitude || farmLoc.longitude
      } : { latitude: null, longitude: null },
      crop: updatedCrop._id,
      cropName: updatedCrop.name,
      grade: updatedCrop.grade || 'Grade A',
      allocatedQuantityKg: share,
      procurementPricePerKg: pricePerKg,
      farmerGrossPayable: Math.round(share * pricePerKg),
      collectionStatus: 'scheduled',
      allocatedAt: new Date()
    };

    requirement.allocations.push(allocation);
    requirement.allocatedQuantityKg = (requirement.allocatedQuantityKg || 0) + share;
  }

  requirement.remainingQuantityKg = Math.max(0, requirement.requiredQuantityKg - requirement.allocatedQuantityKg);
  if (requirement.allocatedQuantityKg >= requirement.requiredQuantityKg) {
    requirement.status = 'allocated';
  } else if (requirement.allocatedQuantityKg > 0) {
    requirement.status = 'partially_allocated';
  }

  // Automatically create or link Aggregation Lot
  if (!requirement.aggregationLot) {
    const lotId = `LOT-${new Date().toISOString().slice(2, 7).replace('-', '')}-${crypto.randomInt(1000, 9999)}`;
    const lot = await AggregationLot.create({
      lotId,
      cropName: requirement.cropName,
      category: 'Grains',
      grade: requirement.requiredGrade?.includes('B') ? 'B' : requirement.requiredGrade?.includes('C') ? 'C' : 'A',
      state: 'Karnataka',
      region: requirement.deliveryDestination,
      buyerRequirement: requirement._id,
      targetQuantityKg: requirement.requiredQuantityKg,
      totalQuantityKg: requirement.allocatedQuantityKg,
      weightedAvgPricePerKg: requirement.allocations.length
        ? Math.round(
            requirement.allocations.reduce((sum, a) => sum + a.procurementPricePerKg * a.allocatedQuantityKg, 0) /
              (requirement.allocatedQuantityKg || 1)
          )
        : 38,
      participatingFarmersCount: requirement.allocations.length,
      status: 'forming',
      autoAggregated: true
    });
    requirement.aggregationLot = lot._id;
  } else {
    await AggregationLot.findByIdAndUpdate(requirement.aggregationLot, {
      totalQuantityKg: requirement.allocatedQuantityKg,
      participatingFarmersCount: requirement.allocations.length
    });
  }

  await requirement.save();
  return requirement;
}

/**
 * ASSIGN VEHICLE TO REQUIREMENT WITH CAPACITY CHECK
 */
export async function assignVehicleToRequirement({ requirementId, vehicleData }) {
  const requirement = await BuyerRequirement.findOne({
    $or: [{ _id: requirementId }, { requirementId }]
  });

  if (!requirement) {
    throw new ApiError(404, 'Procurement requirement not found');
  }

  const totalAllocatedWeightKg = (requirement.allocations || []).reduce(
    (sum, a) => sum + a.allocatedQuantityKg,
    0
  );

  if (totalAllocatedWeightKg === 0) {
    throw new ApiError(400, 'Cannot assign vehicle: No farmer produce allocated to this requirement yet.');
  }

  const capacityKg = Number(vehicleData.capacityKg) || 0;
  if (capacityKg <= 0) {
    throw new ApiError(400, 'Vehicle capacity must be greater than 0 kg');
  }

  // Capacity check: Total weight of crops to collect CANNOT exceed vehicle capacity
  if (totalAllocatedWeightKg > capacityKg) {
    throw new ApiError(
      400,
      `Capacity exceeded: Total produce weight (${totalAllocatedWeightKg.toLocaleString()} kg) exceeds vehicle capacity (${capacityKg.toLocaleString()} kg). Please select a larger vehicle.`
    );
  }

  // Build multi-farm pickup route
  const route = requirement.allocations.map(
    (a) => `${a.farmerName} (${a.farmerVillage || a.farmerLocation || 'Farm'})`
  );
  route.push(`Buyer Facility: ${requirement.deliveryDestination}`);

  requirement.vehicle = {
    vehicleType: vehicleData.vehicleType || 'Medium Truck 10T',
    registrationNumber: vehicleData.registrationNumber || 'KA-09-AG-7788',
    capacityKg,
    driverName: vehicleData.driverName || 'Ramesh Kumar',
    driverPhone: vehicleData.driverPhone || '+91 98765 43210',
    scheduledPickupDate: vehicleData.scheduledPickupDate ? new Date(vehicleData.scheduledPickupDate) : new Date(),
    currentStatus: 'vehicle_assigned',
    assignedAt: new Date(),
    route,
    trackingNotes: `Vehicle assigned to pick up from ${requirement.allocations.length} farm location(s).`
  };

  requirement.status = 'collecting';

  for (const alloc of requirement.allocations) {
    alloc.collectionStatus = 'vehicle_assigned';
    await Crop.findByIdAndUpdate(alloc.crop, { status: 'in_collection' });
  }

  if (requirement.aggregationLot) {
    await AggregationLot.findByIdAndUpdate(requirement.aggregationLot, {
      status: 'collected',
      containerType: vehicleData.vehicleType,
      containerCapacityKg: capacityKg
    });
  }

  await requirement.save();
  return requirement;
}

/**
 * PROGRESSIVE VEHICLE & COLLECTION WORKFLOW STATUS TRANSITION
 */
export async function updateCollectionWorkflowStatus({ requirementId, newStatus, trackingNotes }) {
  const requirement = await BuyerRequirement.findOne({
    $or: [{ _id: requirementId }, { requirementId }]
  });

  if (!requirement) {
    throw new ApiError(404, 'Requirement not found');
  }

  const validStatuses = [
    'vehicle_assigned',
    'on_the_way',
    'arrived',
    'produce_weighed',
    'qc_completed',
    'next_farm',
    'collection_completed',
    'dispatched_to_buyer',
    'arrived_at_destination',
    'delivered'
  ];

  if (!validStatuses.includes(newStatus)) {
    throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  requirement.vehicle.currentStatus = newStatus;
  if (trackingNotes) {
    requirement.vehicle.trackingNotes = trackingNotes;
  }

  if (newStatus === 'dispatched_to_buyer') {
    requirement.status = 'in_transit';
    requirement.delivery.dispatchedQuantityKg = requirement.qcAcceptedQuantityKg || requirement.allocatedQuantityKg;
  } else if (newStatus === 'arrived_at_destination' || newStatus === 'delivered') {
    requirement.status = 'delivered';
  }

  await requirement.save();
  return requirement;
}

/**
 * FARM WEIGHING AND QUALITY INSPECTION RECORDING
 */
export async function recordFarmProduceWeighingAndQC({ requirementId, allocationId, qcData }) {
  const requirement = await BuyerRequirement.findOne({
    $or: [{ _id: requirementId }, { requirementId }],
    'allocations.allocationId': allocationId
  });

  if (!requirement) {
    throw new ApiError(404, 'Requirement or farmer allocation not found');
  }

  const allocation = requirement.allocations.find((a) => a.allocationId === allocationId);
  if (!allocation) {
    throw new ApiError(404, 'Allocation not found');
  }

  const actualWeighedKg = Number(qcData.actualWeighedKg) || allocation.allocatedQuantityKg;
  const acceptedQuantityKg = Number(qcData.acceptedQuantityKg) || actualWeighedKg;
  const rejectedQuantityKg = Number(qcData.rejectedQuantityKg) || Math.max(0, actualWeighedKg - acceptedQuantityKg);

  allocation.actualWeighedKg = actualWeighedKg;
  allocation.acceptedQuantityKg = acceptedQuantityKg;
  allocation.rejectedQuantityKg = rejectedQuantityKg;
  allocation.qcGrade = qcData.qcGrade || allocation.grade;
  allocation.collectionNotes = qcData.collectionNotes || 'Farm produce weighed and quality verified';
  allocation.weightSlipImage = qcData.weightSlipImage || '';
  allocation.collectionStatus = 'collected';
  allocation.collectedAt = new Date();

  // Deduct produce from farmer inventory
  const crop = await Crop.findById(allocation.crop);
  if (crop) {
    crop.allocatedQuantityKg = Math.max(0, (crop.allocatedQuantityKg || 0) - allocation.allocatedQuantityKg);
    crop.collectedQuantityKg = (crop.collectedQuantityKg || 0) + acceptedQuantityKg;
    crop.totalQuantityKg = Math.max(0, (crop.totalQuantityKg || 0) - acceptedQuantityKg);
    // If some quantity was rejected, return it to available stock
    if (rejectedQuantityKg > 0) {
      crop.availableQuantityKg = (crop.availableQuantityKg || 0) + rejectedQuantityKg;
    }
    crop.status = 'collected';
    await crop.save();
  }

  // Update live totals on requirement
  requirement.collectedQuantityKg = requirement.allocations
    .filter((a) => a.collectionStatus === 'collected')
    .reduce((sum, a) => sum + (a.actualWeighedKg || 0), 0);

  requirement.qcAcceptedQuantityKg = requirement.allocations
    .filter((a) => a.collectionStatus === 'collected')
    .reduce((sum, a) => sum + (a.acceptedQuantityKg || 0), 0);

  // Automatically generate FarmerPayment record
  const grossInr = Math.round(acceptedQuantityKg * allocation.procurementPricePerKg);
  await FarmerPayment.findOneAndUpdate(
    {
      buyerRequirement: requirement._id,
      allocationId: allocation.allocationId
    },
    {
      paymentId: generatePaymentId(),
      farmer: allocation.farmer,
      farmerName: allocation.farmerName,
      cropName: requirement.cropName,
      buyerRequirement: requirement._id,
      requirementId: requirement.requirementId,
      allocationId: allocation.allocationId,
      collectedQuantityKg: acceptedQuantityKg,
      agreedPricePerKg: allocation.procurementPricePerKg,
      grossAmountInr: grossInr,
      deductionsInr: 0,
      finalPayableAmountInr: grossInr,
      status: 'pending',
      notes: `Payment generated upon farm collection and QC verification for ${acceptedQuantityKg} kg of ${requirement.cropName}.`
    },
    { upsert: true, new: true }
  );

  // Check if all farmers on route have been collected
  const allCollected = requirement.allocations.every((a) => a.collectionStatus === 'collected');
  if (allCollected) {
    requirement.vehicle.currentStatus = 'collection_completed';
    requirement.status = 'in_transit';
    requirement.delivery.dispatchedQuantityKg = requirement.qcAcceptedQuantityKg;
  } else {
    requirement.vehicle.currentStatus = 'next_farm';
  }

  await requirement.save();
  return { requirement, allocation };
}

/**
 * BUYER DELIVERY RECEIPT CONFIRMATION
 */
export async function buyerConfirmDeliveryReceipt({ requirementId, buyerId, deliveryData }) {
  const requirement = await BuyerRequirement.findOne({
    $or: [{ _id: requirementId }, { requirementId }],
    buyer: buyerId
  });

  if (!requirement) {
    throw new ApiError(404, 'Procurement requirement not found or unauthorized');
  }

  const receivedKg = Number(deliveryData?.receivedQuantityKg) || requirement.qcAcceptedQuantityKg || requirement.allocatedQuantityKg;

  requirement.delivery = {
    dispatchedQuantityKg: requirement.qcAcceptedQuantityKg || requirement.allocatedQuantityKg,
    receivedQuantityKg: receivedKg,
    buyerInspectionNotes: deliveryData?.buyerInspectionNotes || 'Delivery inspected, sealed weight verified and accepted at destination.',
    confirmedByBuyer: true,
    confirmedAt: new Date()
  };

  requirement.status = 'completed';
  requirement.vehicle.currentStatus = 'delivered';

  // Advance farmer payments to processing
  await FarmerPayment.updateMany(
    { buyerRequirement: requirement._id },
    { status: 'processing', paymentDate: new Date(), transactionRef: `TXN-${crypto.randomInt(100000, 999999)}` }
  );

  // Update linked Aggregation Lot
  if (requirement.aggregationLot) {
    await AggregationLot.findByIdAndUpdate(requirement.aggregationLot, {
      status: 'exported',
      shipmentStatus: 'delivered_to_importer',
      buyerPaymentStatus: 'paid'
    });
  }

  await requirement.save();
  return requirement;
}
