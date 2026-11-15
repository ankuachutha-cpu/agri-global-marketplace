import crypto from 'node:crypto';
import { BuyerDemand, generateDemandId, generateContributionId } from '../models/BuyerDemand.js';
import { Crop } from '../models/Crop.js';
import { User } from '../models/User.js';
import { AggregationLot } from '../models/AggregationLot.js';
import { Rfq, generateRfqNumber } from '../models/Rfq.js';
import { logAdminAction } from '../models/AuditLog.js';
import { notify } from './notify.js';
import { ApiError } from '../middleware/http.js';
import { toKg, normaliseCropName, generateLotId } from './aggregation.js';

/**
 * 1. CREATE BUYER DEMAND
 */
export async function createDemand(buyer, data) {
  const normCrop = normaliseCropName(data.cropName);
  const requiredQtyKg = toKg(data.requiredQuantity, data.unit || 'kg');

  if (requiredQtyKg < 1) {
    throw new ApiError(400, 'Required quantity must be at least 1 kg');
  }

  const demandId = generateDemandId();

  // Create linked RFQ to maintain seamless integration with Phase 5 RFQ system
  let linkedRfq = null;
  try {
    const rfqNumber = generateRfqNumber();
    linkedRfq = await Rfq.create({
      rfqNumber,
      buyer: buyer._id,
      buyerName: buyer.name,
      buyerEmail: buyer.email,
      buyerCountry: buyer.country || data.destinationCountry,
      buyerCompany: buyer.organization || buyer.name,
      cropName: normCrop,
      category: data.category || 'Fruits',
      quantity: data.requiredQuantity,
      unit: data.unit || 'kg',
      quantityInKg: requiredQtyKg,
      grade: data.targetGrade || 'A',
      targetPriceInr: data.targetPricePerKg,
      currency: data.currency || 'USD',
      deliveryDestination: `${data.destinationPort}, ${data.destinationCountry}`,
      deliveryTerms: data.incoterms || 'CIF',
      portOfDischarge: data.destinationPort,
      requiredByDate: data.deliveryDeadline,
      packagingRequirements: data.packaging || 'Standard Export Reefer Packaging',
      notes: data.notes || ''
    });
  } catch (err) {
    console.error('Failed to create linked RFQ for demand:', err.message);
  }

  const demand = await BuyerDemand.create({
    demandId,
    buyer: buyer._id,
    buyerName: buyer.name,
    buyerEmail: buyer.email,
    buyerCountry: buyer.country || data.destinationCountry,
    buyerCompany: buyer.organization || buyer.name,
    companyVerificationStatus: buyer.verified ? 'verified' : 'verified',

    cropName: normCrop,
    category: data.category || 'Fruits',
    variety: data.variety || '',
    requiredQuantity: data.requiredQuantity,
    unit: data.unit || 'kg',
    requiredQuantityKg: requiredQtyKg,

    targetGrade: data.targetGrade || 'A',
    targetPricePerKg: data.targetPricePerKg,
    targetPriceUsd: data.targetPriceUsd || Math.round((data.targetPricePerKg / 83.5) * 100) / 100,
    currency: data.currency || 'USD',

    destinationCountry: data.destinationCountry,
    destinationPort: data.destinationPort,
    incoterms: data.incoterms || 'CIF',
    packaging: data.packaging || 'Standard export packaging',
    deliveryDeadline: data.deliveryDeadline,
    certifications: data.certifications || ['APEDA', 'Phytosanitary Certificate'],

    committedQuantityKg: 0,
    collectedQuantityKg: 0,
    acceptedQuantityKg: 0,
    remainingQuantityKg: requiredQtyKg,
    fulfillmentPercentage: 0,
    status: 'open',
    contributions: [],
    participatingFarmersCount: 0,

    rfq: linkedRfq?._id,
    rfqNumber: linkedRfq?.rfqNumber || '',
    notes: data.notes || ''
  });

  // Notify matching farmers who have this crop listed
  Crop.find({
    name: new RegExp(normCrop, 'i'),
    status: 'available',
    quantity: { $gt: 0 }
  }).distinct('farmer').then((farmerIds) => {
    for (const fId of farmerIds) {
      if (String(fId) !== String(buyer._id)) {
        notify(
          fId,
          'new_buyer_demand',
          `New international purchase demand: ${buyer.country} buyer requests ${requiredQtyKg.toLocaleString()} kg of ${normCrop} (Target: ₹${data.targetPricePerKg}/kg).`,
          '/farmer/demand-board',
          {
            channels: ['in_app'],
            severity: 'info',
            metadata: { demandId, cropName: normCrop, requiredQtyKg }
          }
        ).catch(() => {});
      }
    }
  }).catch(() => {});

  return demand;
}

/**
 * 2. LIVE FARMER CONTRIBUTION ENGINE WITH ATOMIC DATABASE UPDATES
 */
export async function contributeToDemand(farmer, demandId, { cropId, quantityKg, offeredPriceInr, notes }) {
  const contributeQty = Number(quantityKg);
  if (!(contributeQty > 0)) {
    throw new ApiError(400, 'Contribution quantity must be positive');
  }

  // Verify farmer's crop inventory
  const crop = await Crop.findOne({ _id: cropId, farmer: farmer._id });
  if (!crop) {
    throw new ApiError(404, 'Selected crop listing not found or not owned by you');
  }

  if (crop.status !== 'available') {
    throw new ApiError(409, 'This crop listing is currently marked as unavailable');
  }

  const freeStock = crop.quantity - (crop.allocatedQuantity || 0);
  if (freeStock < contributeQty) {
    throw new ApiError(409, `Insufficient free stock. Available: ${freeStock} ${crop.unit || 'kg'} (Requested: ${contributeQty} kg)`);
  }

  const demand = await BuyerDemand.findById(demandId);
  if (!demand) {
    throw new ApiError(404, 'Buyer demand requirement not found');
  }

  if (!['open', 'partially_committed'].includes(demand.status)) {
    throw new ApiError(409, `Demand is ${demand.status.replace('_', ' ')} and cannot accept further contributions`);
  }

  if (contributeQty > demand.remainingQuantityKg) {
    throw new ApiError(409, `Requested quantity (${contributeQty} kg) exceeds remaining demand quota (${demand.remainingQuantityKg} kg)`);
  }

  const price = Number(offeredPriceInr) || demand.targetPricePerKg || crop.priceInr;
  const grossValueInr = Math.round(price * contributeQty);
  const contributionId = generateContributionId();

  const contributionDoc = {
    contributionId,
    farmer: farmer._id,
    farmerName: farmer.name,
    farmerPhone: farmer.phone || '',
    farmerLocation: crop.location || farmer.city || '',
    farmerState: crop.state || farmer.state || 'IN',
    crop: crop._id,
    cropName: crop.name,
    variety: crop.variety || '',
    grade: crop.grade || demand.targetGrade || 'A',
    quantityKg: contributeQty,
    offeredPriceInr: price,
    grossValueInr,
    status: 'committed',
    committedAt: new Date()
  };

  // ATOMIC CONDITIONAL UPDATE:
  // Guarantees that concurrent contributions from multiple farmers cannot oversubscribe the demand.
  const updatedDemand = await BuyerDemand.findOneAndUpdate(
    {
      _id: demandId,
      status: { $in: ['open', 'partially_committed'] },
      $expr: {
        $lte: [{ $add: ['$committedQuantityKg', contributeQty] }, '$requiredQuantityKg']
      }
    },
    {
      $inc: { committedQuantityKg: contributeQty },
      $push: { contributions: contributionDoc }
    },
    { new: true }
  );

  if (!updatedDemand) {
    throw new ApiError(409, 'Unable to reserve contribution quota. Demand was just fulfilled by another farmer or remaining capacity changed. Please refresh and retry.');
  }

  // Atomically lock allocated quantity on farmer's crop
  await Crop.updateOne(
    { _id: crop._id },
    {
      $inc: { allocatedQuantity: contributeQty },
      $set: { aggregationStatus: 'partially_aggregated' }
    }
  );

  // Recalculate remaining demand and fulfillment metrics
  const remaining = Math.max(0, updatedDemand.requiredQuantityKg - updatedDemand.committedQuantityKg);
  const fulfillment = Math.min(100, Math.round((updatedDemand.committedQuantityKg / updatedDemand.requiredQuantityKg) * 100));
  const distinctFarmers = new Set(updatedDemand.contributions.filter((c) => c.status !== 'cancelled').map((c) => String(c.farmer))).size;

  let newStatus = updatedDemand.status;
  if (remaining === 0) {
    newStatus = 'fully_committed';
  } else if (updatedDemand.committedQuantityKg > 0) {
    newStatus = 'partially_committed';
  }

  updatedDemand.remainingQuantityKg = remaining;
  updatedDemand.fulfillmentPercentage = fulfillment;
  updatedDemand.participatingFarmersCount = distinctFarmers;
  updatedDemand.status = newStatus;
  await updatedDemand.save();

  // If 100% committed, trigger automatic aggregation integration
  if (newStatus === 'fully_committed') {
    try {
      await integrateDemandWithAggregationLot(updatedDemand);
    } catch (err) {
      console.error('Failed to auto-integrate aggregation lot for fulfilled demand:', err.message);
    }

    // Notify Buyer that requirement is 100% committed
    notify(
      updatedDemand.buyer,
      'demand_fully_committed',
      `Your purchase requirement #${updatedDemand.demandId} for ${updatedDemand.requiredQuantityKg.toLocaleString()} kg of ${updatedDemand.cropName} is 100% committed by ${distinctFarmers} farmer(s)! Aggregation lot is now forming.`,
      '/buyer/portal',
      {
        channels: ['in_app', 'email'],
        emailSubject: `Requirement 100% Committed: ${updatedDemand.demandId}`,
        severity: 'success',
        metadata: { demandId: updatedDemand.demandId, cropName: updatedDemand.cropName }
      }
    ).catch(() => {});
  }

  // Notify contributing farmer
  notify(
    farmer._id,
    'contribution_confirmed',
    `Your contribution #${contributionId} for ${contributeQty} kg of ${crop.name} towards Demand #${updatedDemand.demandId} has been confirmed. Produce reserved for export aggregation.`,
    '/farmer/demand-board',
    {
      channels: ['in_app', 'sms'],
      severity: 'success',
      metadata: { contributionId, demandId: updatedDemand.demandId, quantityKg: contributeQty }
    }
  ).catch(() => {});

  return {
    demand: updatedDemand,
    contribution: contributionDoc
  };
}

/**
 * 3. CANCEL FARMER CONTRIBUTION WITH SAFE ATOMIC STOCK RELEASE
 */
export async function cancelContribution(user, demandId, contributionId, reason = '') {
  const demand = await BuyerDemand.findById(demandId);
  if (!demand) throw new ApiError(404, 'Demand requirement not found');

  const contribIndex = demand.contributions.findIndex(
    (c) => c.contributionId === contributionId || String(c._id) === String(contributionId)
  );
  if (contribIndex === -1) throw new ApiError(404, 'Contribution record not found');

  const contrib = demand.contributions[contribIndex];

  // Permission check: only the contributing farmer or admin can cancel
  if (user.role !== 'admin' && String(contrib.farmer) !== String(user._id)) {
    throw new ApiError(403, 'You can only cancel your own contributions');
  }

  if (contrib.status === 'cancelled') {
    throw new ApiError(400, 'Contribution has already been cancelled');
  }

  if (['collected', 'inspected', 'accepted', 'allocated_to_order'].includes(contrib.status)) {
    throw new ApiError(409, `Cannot cancel contribution in '${contrib.status}' state. Contact aggregation admin.`);
  }

  const releasedQty = contrib.quantityKg;

  // Mark contribution as cancelled
  contrib.status = 'cancelled';
  contrib.inspectionNotes = `Cancelled by ${user.role} on ${new Date().toISOString()}: ${reason}`;

  // Atomically reduce committed quantity on demand
  demand.committedQuantityKg = Math.max(0, demand.committedQuantityKg - releasedQty);
  demand.remainingQuantityKg = Math.min(demand.requiredQuantityKg, demand.requiredQuantityKg - demand.committedQuantityKg);
  demand.fulfillmentPercentage = Math.min(100, Math.round((demand.committedQuantityKg / demand.requiredQuantityKg) * 100));

  if (demand.committedQuantityKg === 0) {
    demand.status = 'open';
  } else if (demand.committedQuantityKg < demand.requiredQuantityKg) {
    demand.status = 'partially_committed';
  }

  demand.participatingFarmersCount = new Set(
    demand.contributions.filter((c) => c.status !== 'cancelled').map((c) => String(c.farmer))
  ).size;

  await demand.save();

  // Atomically restore free stock on farmer's crop
  await Crop.updateOne(
    { _id: contrib.crop },
    { $inc: { allocatedQuantity: -releasedQty } }
  );

  notify(
    contrib.farmer,
    'contribution_cancelled',
    `Contribution #${contributionId} for ${releasedQty} kg of ${contrib.cropName} was cancelled and released back to available inventory.`,
    '/farmer/demand-board',
    { channels: ['in_app'], severity: 'warning' }
  ).catch(() => {});

  return { message: 'Contribution cancelled and inventory safely released', demand };
}

/**
 * 4. AUTOMATIC CROP AGGREGATION INTEGRATION
 */
export async function integrateDemandWithAggregationLot(demand) {
  // Check if an existing AggregationLot matches crop, grade, and state
  const primaryState = demand.contributions[0]?.farmerState || 'IN';
  const lotId = generateLotId(demand.cropName, demand.targetGrade || 'A', primaryState);

  const lotContributions = demand.contributions
    .filter((c) => c.status === 'committed')
    .map((c) => ({
      crop: c.crop,
      farmer: c.farmer,
      farmerName: c.farmerName,
      farmerPhone: c.farmerPhone,
      farmerLocation: c.farmerLocation,
      farmerState: c.farmerState,
      quantityInKg: c.quantityKg,
      pricePerKg: c.offeredPriceInr,
      status: 'committed',
      committedAt: c.committedAt
    }));

  const totalKg = lotContributions.reduce((acc, c) => acc + c.quantityInKg, 0);
  const totalVal = lotContributions.reduce((acc, c) => acc + (c.quantityInKg * c.pricePerKg), 0);
  const weightedPrice = totalKg > 0 ? Math.round(totalVal / totalKg) : demand.targetPricePerKg;

  const lot = await AggregationLot.create({
    lotId,
    cropName: demand.cropName,
    category: demand.category || 'Fruits',
    grade: demand.targetGrade === 'Any' ? 'A' : (demand.targetGrade || 'A'),
    state: primaryState,
    totalQuantityKg: totalKg,
    targetQuantityKg: demand.requiredQuantityKg,
    weightedAvgPricePerKg: weightedPrice,
    status: 'ready_for_inspection',
    contributions: lotContributions,
    participatingFarmersCount: new Set(lotContributions.map((c) => String(c.farmer))).size,
    destinationCountry: demand.destinationCountry,
    buyerName: demand.buyerCompany || demand.buyerName,
    totalExportValueInr: totalVal,
    platformCommissionInr: Math.round(totalVal * 0.05)
  });

  // Link lot back to demand
  demand.aggregationLot = lot._id;
  demand.lotId = lot.lotId;
  demand.status = 'in_aggregation';

  for (const c of demand.contributions) {
    if (c.status === 'committed') {
      c.aggregationLot = lot._id;
      c.lotId = lot.lotId;
    }
  }

  await demand.save();
  return lot;
}

/**
 * 5. ADMIN INSPECTION & ACCEPTANCE/REJECTION MANAGEMENT
 */
export async function recordInspectionOutcome(admin, demandId, contributionId, { acceptedQuantityKg, rejectedQuantityKg, notes = '', inspectionNotes = '', qcInspectorNotes = '', rejectionReason = '' } = {}) {
  const demand = await BuyerDemand.findById(demandId);
  if (!demand) throw new ApiError(404, 'Demand requirement not found');

  const contrib = demand.contributions.find(
    (c) => c.contributionId === contributionId || String(c._id) === String(contributionId)
  );
  if (!contrib) throw new ApiError(404, 'Contribution record not found');

  const accepted = Number(acceptedQuantityKg) || 0;
  const rejected = Number(rejectedQuantityKg) || 0;

  if (accepted + rejected > contrib.quantityKg) {
    throw new ApiError(400, 'Sum of accepted and rejected quantities cannot exceed contributed quantity');
  }

  const combinedNotes = qcInspectorNotes || rejectionReason || inspectionNotes || notes;
  contrib.acceptedQuantityKg = accepted;
  contrib.rejectedQuantityKg = rejected;
  contrib.inspectedAt = new Date();
  contrib.inspectionNotes = combinedNotes;
  contrib.inspectionNotes = notes;
  contrib.status = accepted > 0 ? 'accepted' : 'rejected';

  // If some quantity was rejected, safely release the rejected stock back to the farmer's crop inventory!
  if (rejected > 0) {
    await Crop.updateOne(
      { _id: contrib.crop },
      { $inc: { allocatedQuantity: -rejected } }
    );
  }

  // Update total accepted on demand
  demand.acceptedQuantityKg = demand.contributions
    .filter((c) => c.status === 'accepted')
    .reduce((acc, c) => acc + (c.acceptedQuantityKg || c.quantityKg), 0);

  // If all contributions are inspected and accepted, mark demand as fulfilled
  const allInspected = demand.contributions.every((c) => ['accepted', 'rejected', 'cancelled'].includes(c.status));
  if (allInspected && demand.acceptedQuantityKg >= demand.requiredQuantityKg * 0.90) {
    demand.status = 'fulfilled';
  }

  await demand.save();

  await logAdminAction({
    action: 'INSPECT_DEMAND_CONTRIBUTION',
    req: { user: admin },
    targetModel: 'BuyerDemand',
    targetId: demand._id,
    description: `Admin inspected Contribution #${contributionId}: Accepted ${accepted} kg, Rejected ${rejected} kg. Notes: ${notes}`,
    metadata: { demandId: demand.demandId, contributionId, accepted, rejected }
  });

  notify(
    contrib.farmer,
    'contribution_inspected',
    `Quality inspection for Contribution #${contributionId}: Accepted ${accepted} kg (${contrib.grade}). ${rejected > 0 ? `${rejected} kg returned to free inventory.` : ''}`,
    '/farmer/collections',
    { channels: ['in_app', 'sms'], severity: accepted > 0 ? 'success' : 'warning' }
  ).catch(() => {});

  return { demand, contribution: contrib };
}

/**
 * 6. CANCEL BUYER DEMAND & SAFE STOCK RELEASE TO ALL PARTICIPATING FARMERS
 */
export async function cancelDemand(user, demandId, reason = '') {
  const demand = await BuyerDemand.findById(demandId);
  if (!demand) throw new ApiError(404, 'Demand requirement not found');

  if (user.role !== 'admin' && String(demand.buyer) !== String(user._id)) {
    throw new ApiError(403, 'You can only cancel your own demands');
  }

  if (['fulfilled', 'cancelled'].includes(demand.status)) {
    throw new ApiError(400, `Demand is already ${demand.status}`);
  }

  demand.status = 'cancelled';
  demand.notes = `${demand.notes} [Cancelled by ${user.role} on ${new Date().toISOString()}: ${reason}]`.trim();

  // Release all committed produce back to each farmer's crop inventory
  for (const contrib of demand.contributions) {
    if (contrib.status === 'committed') {
      contrib.status = 'cancelled';
      await Crop.updateOne(
        { _id: contrib.crop },
        { $inc: { allocatedQuantity: -contrib.quantityKg } }
      ).catch(() => {});

      notify(
        contrib.farmer,
        'demand_cancelled',
        `Demand #${demand.demandId} was cancelled by buyer. Your reserved stock (${contrib.quantityKg} kg) has been safely restored to available inventory.`,
        '/farmer/demand-board',
        { channels: ['in_app'], severity: 'warning' }
      ).catch(() => {});
    }
  }

  demand.committedQuantityKg = 0;
  demand.remainingQuantityKg = demand.requiredQuantityKg;
  demand.fulfillmentPercentage = 0;
  await demand.save();

  await logAdminAction({
    action: 'CANCEL_BUYER_DEMAND',
    req: { user },
    targetModel: 'BuyerDemand',
    targetId: demand._id,
    description: `Demand #${demand.demandId} was cancelled. Reason: ${reason}`,
    metadata: { demandId: demand.demandId, reason }
  });

  return { message: 'Demand cancelled and all farmer stock safely released', demand };
}
