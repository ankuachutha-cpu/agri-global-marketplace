import { Crop } from '../models/Crop.js';
import { User } from '../models/User.js';
import { BuyerRequirement, generateContributionId } from '../models/BuyerRequirement.js';
import { ApiError } from '../middleware/http.js';

export async function findCompatibleFarmersAndPropose(requirement) {
  const neededKg = Math.max(0, requirement.requiredQuantityKg - (requirement.allocatedQuantityKg || 0));
  if (neededKg <= 0) {
    requirement.status = 'fully_allocated';
    await requirement.save();
    return requirement;
  }

  // Find crops matching cropName and status available
  // Only Ragi, Rice, Jowar
  const crops = await Crop.find({
    name: new RegExp(`^${requirement.cropName}$`, 'i'),
    status: 'available'
  }).populate('farmer', 'name phone email role address').lean();

  // Exclude farmers who already have any contribution (proposed, accepted, rejected, collected) in this requirement
  const existingFarmerIds = new Set(
    (requirement.contributions || []).map((c) => c.farmer.toString())
  );

  // Compute available free stock for each crop
  const candidates = [];
  for (const crop of crops) {
    if (!crop.farmer || crop.farmer.role !== 'farmer') continue;
    if (existingFarmerIds.has(crop.farmer._id.toString())) continue;

    const unitFactor = crop.unit === 'tonne' ? 1000 : crop.unit === 'quintal' ? 100 : 1;
    const totalPhysicalKg = (crop.quantity || 0) * unitFactor;
    const propKg = crop.proposedQuantity || 0;
    const resKg = crop.reservedQuantity || 0;
    const collKg = crop.collectedQuantity || 0;
    const freeStockKg = Math.max(0, totalPhysicalKg - propKg - resKg - collKg);

    if (freeStockKg >= 1) {
      candidates.push({
        crop,
        freeStockKg
      });
    }
  }

  // Sort candidates by freeStockKg descending to prioritize reliable suppliers
  candidates.sort((a, b) => b.freeStockKg - a.freeStockKg);

  if (candidates.length === 0) {
    // No compatible farmers available right now
    if (!requirement.allocatedQuantityKg || requirement.allocatedQuantityKg === 0) {
      requirement.status = 'pending_matching';
    }
    await requirement.save();
    return requirement;
  }

  // Pick up to 2-3 compatible farmers to fulfill neededKg
  // If neededKg is large, split across 2 to 3 farmers
  // Even if 1 farmer has enough, if neededKg is high, splitting provides redundancy as per requirement
  let remainingTarget = neededKg;
  const selected = [];

  // Determine how many farmers to allocate (2 to 3 farmers if neededKg > 1000 and multiple candidates exist)
  const maxFarmersToPick = candidates.length >= 3 && remainingTarget >= 5000 ? 3 : candidates.length >= 2 ? 2 : 1;

  for (let i = 0; i < candidates.length && selected.length < maxFarmersToPick && remainingTarget > 0; i++) {
    const candidate = candidates[i];
    // Share allocation across the chosen farmers
    let share = 0;
    if (selected.length === maxFarmersToPick - 1 || i === candidates.length - 1) {
      // Last farmer takes whatever remains up to their free stock
      share = Math.min(candidate.freeStockKg, remainingTarget);
    } else {
      // Give a balanced chunk
      const equalShare = Math.round(remainingTarget / (maxFarmersToPick - selected.length));
      share = Math.min(candidate.freeStockKg, equalShare, remainingTarget);
      if (share <= 0) share = Math.min(candidate.freeStockKg, remainingTarget);
    }

    if (share > 0) {
      selected.push({
        candidate,
        allocatedKg: share
      });
      remainingTarget -= share;
    }
  }

  // Update crops and add contributions
  for (const item of selected) {
    const { candidate, allocatedKg } = item;
    const cropDoc = await Crop.findById(candidate.crop._id);
    if (!cropDoc) continue;

    cropDoc.proposedQuantity = (cropDoc.proposedQuantity || 0) + allocatedKg;
    if (cropDoc.cropStatus === 'available') {
      cropDoc.cropStatus = 'order_requested';
    }
    await cropDoc.save();

    const contribution = {
      contributionId: generateContributionId(),
      farmer: candidate.crop.farmer._id,
      farmerName: candidate.crop.farmer.name || 'Farmer',
      farmerPhone: candidate.crop.farmer.phone || '',
      farmerLocation: cropDoc.farmAddress || cropDoc.location || 'Karnataka, India',
      farmerVillage: cropDoc.village || '',
      farmerHobli: cropDoc.hobli || '',
      farmerTaluk: cropDoc.taluk || '',
      farmerDistrict: cropDoc.district || '',
      farmerCoordinates: cropDoc.coordinates || { latitude: null, longitude: null },
      crop: cropDoc._id,
      cropName: cropDoc.name,
      grade: cropDoc.grade || 'Grade A',
      proposedQuantityKg: allocatedKg,
      status: 'proposed',
      collectionStatus: 'pending',
      proposedAt: new Date()
    };

    requirement.contributions.push(contribution);
    requirement.allocatedQuantityKg = (requirement.allocatedQuantityKg || 0) + allocatedKg;
  }

  requirement.remainingQuantityKg = Math.max(0, requirement.requiredQuantityKg - requirement.allocatedQuantityKg);
  if (requirement.allocatedQuantityKg >= requirement.requiredQuantityKg) {
    requirement.status = 'fully_allocated';
  } else if (requirement.allocatedQuantityKg > 0) {
    requirement.status = 'partially_allocated';
  }

  await requirement.save();
  return requirement;
}

export async function farmerRespondToOrder({ farmerId, requirementId, contributionId, action }) {
  const requirement = await BuyerRequirement.findOne({
    $or: [{ _id: requirementId }, { requirementId }],
    'contributions.contributionId': contributionId,
    'contributions.farmer': farmerId
  });

  if (!requirement) {
    throw new ApiError(404, 'Requirement or contribution not found for this farmer');
  }

  const contribution = requirement.contributions.find(
    (c) => c.contributionId === contributionId && c.farmer.toString() === farmerId.toString()
  );

  if (!contribution) {
    throw new ApiError(404, 'Contribution not found');
  }

  if (contribution.status !== 'proposed') {
    throw new ApiError(400, `Order already responded to (current status: ${contribution.status})`);
  }

  const crop = await Crop.findById(contribution.crop);

  if (action === 'accept') {
    contribution.status = 'accepted';
    contribution.respondedAt = new Date();

    if (crop) {
      crop.proposedQuantity = Math.max(0, (crop.proposedQuantity || 0) - contribution.proposedQuantityKg);
      crop.reservedQuantity = (crop.reservedQuantity || 0) + contribution.proposedQuantityKg;
      crop.cropStatus = 'reserved';
      await crop.save();
    }

    // Recalculate accepted quantity
    const totalAccepted = requirement.contributions
      .filter((c) => c.status === 'accepted')
      .reduce((sum, c) => sum + c.proposedQuantityKg, 0);
    requirement.acceptedQuantityKg = totalAccepted;

    // Check if all active contributions are accepted
    const allAccepted = requirement.contributions
      .filter((c) => ['proposed', 'accepted'].includes(c.status))
      .every((c) => c.status === 'accepted');

    if (allAccepted && totalAccepted >= requirement.requiredQuantityKg) {
      requirement.status = 'confirmed';
    }

    await requirement.save();
    return { success: true, message: 'Order accepted successfully and produce reserved for collection', requirement, contribution };
  } else if (action === 'reject') {
    contribution.status = 'rejected';
    contribution.respondedAt = new Date();

    if (crop) {
      crop.proposedQuantity = Math.max(0, (crop.proposedQuantity || 0) - contribution.proposedQuantityKg);
      if ((crop.reservedQuantity || 0) === 0 && (crop.proposedQuantity || 0) === 0) {
        crop.cropStatus = 'available';
      }
      await crop.save();
    }

    // Deduct the rejected quantity from requirement allocated
    requirement.allocatedQuantityKg = Math.max(0, (requirement.allocatedQuantityKg || 0) - contribution.proposedQuantityKg);
    requirement.remainingQuantityKg = Math.max(0, requirement.requiredQuantityKg - requirement.allocatedQuantityKg);

    // Save before re-matching
    await requirement.save();

    // Automatically search for another compatible farmer with stock and send order to them instead
    await findCompatibleFarmersAndPropose(requirement);

    return {
      success: true,
      message: 'Order rejected. Released proposed stock and automatically re-matched with another compatible farmer.',
      requirement,
      contribution
    };
  } else {
    throw new ApiError(400, 'Invalid action. Must be "accept" or "reject"');
  }
}

export async function assignVehicleToRequirement({ requirementId, vehicleData }) {
  const requirement = await BuyerRequirement.findOne({
    $or: [{ _id: requirementId }, { requirementId }]
  });

  if (!requirement) {
    throw new ApiError(404, 'Requirement not found');
  }

  // Calculate total confirmed weight to collect
  const acceptedContributions = requirement.contributions.filter((c) => c.status === 'accepted');
  const totalAcceptedKg = acceptedContributions.reduce((sum, c) => sum + c.proposedQuantityKg, 0);

  if (acceptedContributions.length === 0) {
    throw new ApiError(400, 'No accepted farmer contributions available to assign vehicle for');
  }

  const capacityKg = Number(vehicleData.capacityKg) || 0;
  if (capacityKg <= 0) {
    throw new ApiError(400, 'Vehicle capacity must be greater than 0');
  }

  // Capacity check: Total weight of crops to collect CANNOT exceed vehicle capacity
  if (totalAcceptedKg > capacityKg) {
    throw new ApiError(
      400,
      `Capacity exceeded: Total produce weight (${totalAcceptedKg.toLocaleString()} kg) exceeds vehicle capacity (${capacityKg.toLocaleString()} kg). Please choose a larger vehicle.`
    );
  }

  // Build route from farmer locations
  const route = acceptedContributions.map(
    (c) => `${c.farmerName} (${c.farmerVillage || c.farmerLocation || 'Location'})`
  );
  route.push(`Delivery Destination: ${requirement.deliveryDestination}`);

  requirement.vehicle = {
    vehicleType: vehicleData.vehicleType || 'Medium Truck 10T',
    registrationNumber: vehicleData.registrationNumber || 'KA-01-AG-5000',
    capacityKg,
    driverName: vehicleData.driverName || 'Ramesh Kumar',
    driverPhone: vehicleData.driverPhone || '+91 98765 43210',
    scheduledPickupDate: vehicleData.scheduledPickupDate ? new Date(vehicleData.scheduledPickupDate) : new Date(),
    currentStatus: 'vehicle_assigned',
    assignedAt: new Date(),
    route,
    trackingNotes: `Vehicle assigned to pick up from ${acceptedContributions.length} farmer(s).`
  };

  requirement.status = 'vehicle_assigned';

  // Update contribution collection status
  for (const contrib of acceptedContributions) {
    contrib.collectionStatus = 'vehicle_assigned';
  }

  // Update crops to in_transit
  for (const contrib of acceptedContributions) {
    await Crop.findByIdAndUpdate(contrib.crop, { cropStatus: 'in_transit' });
  }

  await requirement.save();
  return requirement;
}

export async function updateVehicleWorkflowStatus({ requirementId, newStatus, trackingNotes }) {
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
    'produce_collected',
    'next_farmer',
    'collection_completed',
    'dispatched_to_buyer',
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
  } else if (newStatus === 'delivered') {
    requirement.status = 'delivered';
  }

  await requirement.save();
  return requirement;
}

export async function recordFarmerProduceCollection({ requirementId, contributionId, collectionData }) {
  const requirement = await BuyerRequirement.findOne({
    $or: [{ _id: requirementId }, { requirementId }],
    'contributions.contributionId': contributionId
  });

  if (!requirement) {
    throw new ApiError(404, 'Requirement or contribution not found');
  }

  const contribution = requirement.contributions.find((c) => c.contributionId === contributionId);
  if (!contribution) {
    throw new ApiError(404, 'Contribution not found');
  }

  const actualWeighedKg = Number(collectionData.actualWeighedKg) || contribution.proposedQuantityKg;
  const acceptedQuantityKg = Number(collectionData.acceptedQuantityKg) || actualWeighedKg;
  const rejectedQuantityKg = Number(collectionData.rejectedQuantityKg) || Math.max(0, actualWeighedKg - acceptedQuantityKg);

  contribution.actualWeighedKg = actualWeighedKg;
  contribution.acceptedQuantityKg = acceptedQuantityKg;
  contribution.rejectedQuantityKg = rejectedQuantityKg;
  contribution.qcGrade = collectionData.qcGrade || contribution.grade;
  contribution.collectionNotes = collectionData.collectionNotes || 'Produce inspected and weighed at farm';
  contribution.collectionProof = collectionData.collectionProof || '';
  contribution.status = 'collected';
  contribution.collectionStatus = 'completed';
  contribution.collectedAt = new Date();

  // Deduct actual accepted quantity from farmer's reserved stock and crop
  const crop = await Crop.findById(contribution.crop);
  if (crop) {
    // Reserved quantity reduces by the actual weighed kg that was reserved
    crop.reservedQuantity = Math.max(0, (crop.reservedQuantity || 0) - actualWeighedKg);
    // Collected quantity increases by accepted quantity
    crop.collectedQuantity = (crop.collectedQuantity || 0) + acceptedQuantityKg;
    // Deduct accepted quantity from physical crop quantity
    const unitFactor = crop.unit === 'tonne' ? 1000 : crop.unit === 'quintal' ? 100 : 1;
    const acceptedInCropUnit = acceptedQuantityKg / unitFactor;
    crop.quantity = Math.max(0, (crop.quantity || 0) - acceptedInCropUnit);

    crop.cropStatus = 'in_transit';
    await crop.save();
  }

  // Update requirement live totals
  requirement.physicallyCollectedKg = requirement.contributions
    .filter((c) => c.status === 'collected' || c.status === 'delivered')
    .reduce((sum, c) => sum + (c.actualWeighedKg || 0), 0);

  requirement.qcAcceptedQuantityKg = requirement.contributions
    .filter((c) => c.status === 'collected' || c.status === 'delivered')
    .reduce((sum, c) => sum + (c.acceptedQuantityKg || 0), 0);

  // Check if all accepted contributions are collected
  const allAcceptedCollected = requirement.contributions
    .filter((c) => ['accepted', 'collected', 'delivered'].includes(c.status))
    .every((c) => ['collected', 'delivered'].includes(c.status));

  if (allAcceptedCollected) {
    requirement.vehicle.currentStatus = 'collection_completed';
    requirement.status = 'in_transit';
  } else {
    requirement.vehicle.currentStatus = 'next_farmer';
  }

  await requirement.save();
  return { requirement, contribution };
}

export async function confirmBuyerDelivery({ requirementId, buyerId, deliveryData }) {
  const requirement = await BuyerRequirement.findOne({
    $or: [{ _id: requirementId }, { requirementId }],
    buyer: buyerId
  });

  if (!requirement) {
    throw new ApiError(404, 'Requirement not found or you are not authorized to confirm this delivery');
  }

  const receivedKg = Number(deliveryData?.receivedQuantityKg) || requirement.qcAcceptedQuantityKg || requirement.requiredQuantityKg;

  requirement.deliveryConfirmation = {
    confirmedByBuyer: true,
    confirmedAt: new Date(),
    receivedQuantityKg: receivedKg,
    buyerNotes: deliveryData?.buyerNotes || 'Delivery inspected and verified at destination.'
  };

  requirement.status = 'completed';
  requirement.vehicle.currentStatus = 'delivered';

  for (const contrib of requirement.contributions) {
    if (contrib.status === 'collected' || contrib.status === 'accepted') {
      contrib.status = 'delivered';
      await Crop.findByIdAndUpdate(contrib.crop, { cropStatus: 'delivered' });
    }
  }

  await requirement.save();
  return requirement;
}
