import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { CollectionRequest } from '../models/CollectionRequest.js';
import { Crop } from '../models/Crop.js';
import { AggregationLot } from '../models/AggregationLot.js';
import { toKg, pricePerKg } from './aggregation.js';
import { notify } from './notify.js';

export function generateCollectionId() {
  const d = new Date().toISOString().slice(2, 7).replace('-', '');
  const r = crypto.randomInt(1000, 9999);
  return `COL-${d}-${r}`;
}

/**
 * Creates a new collection request for a farmer's crop listing.
 * Strictly prevents duplicate active requests for the same crop.
 */
export async function scheduleCollection({
  farmerId,
  cropId,
  scheduledDate,
  pickupAddress,
  coordinates = null,
  pickupContactPhone = '',
  notes = ''
}) {
  const crop = await Crop.findById(cropId).populate('farmer', 'name phone state city');
  if (!crop) throw new Error('Crop listing not found');

  // Prevent duplicate active collection requests for the same crop
  const activeExisting = await CollectionRequest.findOne({
    crop: crop._id,
    status: { $in: ['scheduled', 'in_transit', 'inspected_at_farm', 'delivered_to_hub'] }
  });
  if (activeExisting) {
    throw new Error(`A collection pickup (${activeExisting.collectionId}) is already active for this crop.`);
  }

  const estKg = toKg(crop.quantity, crop.unit);
  const pPerKg = pricePerKg(crop.priceInr, crop.unit);
  const estPayout = Math.round(estKg * pPerKg);

  const address = pickupAddress || crop.farmAddress || crop.location || crop.farmer?.city || 'Farm location';
  const coords = (coordinates?.latitude && coordinates?.longitude)
    ? coordinates
    : (crop.coordinates?.latitude && crop.coordinates?.longitude)
      ? crop.coordinates
      : null;

  const collection = new CollectionRequest({
    collectionId: generateCollectionId(),
    farmer: crop.farmer._id,
    crop: crop._id,
    cropName: crop.name,
    grade: crop.grade || 'A',
    aggregationLot: crop.aggregationLot || null,
    scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(Date.now() + 48 * 3600 * 1000),
    pickupAddress: address,
    coordinates: coords,
    pickupContactPhone: pickupContactPhone || crop.farmer?.phone || '',
    estimatedQuantityKg: estKg,
    unitPriceInr: pPerKg,
    totalEstimatedPayoutInr: estPayout,
    status: 'scheduled',
    paymentStatus: 'pending',
    notes,
    timeline: [
      {
        status: 'scheduled',
        timestamp: new Date(),
        note: `Collection pickup scheduled for ${estKg} kg of ${crop.name} (Grade ${crop.grade || 'A'})`,
        actor: 'Farmer'
      }
    ]
  });

  // If crop is part of an AggregationLot, populate lotId
  if (crop.aggregationLot) {
    const lot = await AggregationLot.findById(crop.aggregationLot);
    if (lot) collection.lotId = lot.lotId;
  }

  await collection.save();

  notify(
    crop.farmer._id,
    'collection_scheduled',
    `Collection pickup ${collection.collectionId} scheduled for ${crop.name}`,
    `/farmer/collections`
  ).catch(() => {});

  return collection;
}

/**
 * Updates collection status through inspection, hub delivery, acceptance and payment.
 */
export async function updateCollectionStatus(collectionIdOrMongoId, newStatus, metadata = {}) {
  const query = mongoose.isValidObjectId(collectionIdOrMongoId)
    ? { $or: [{ _id: collectionIdOrMongoId }, { collectionId: String(collectionIdOrMongoId).toUpperCase() }] }
    : { collectionId: String(collectionIdOrMongoId).toUpperCase() };
  const col = await CollectionRequest.findOne(query);

  if (!col) throw new Error(`Collection request not found: ${collectionIdOrMongoId}`);

  const prevStatus = col.status;
  col.status = newStatus;

  if (metadata.notes) col.notes = metadata.notes;
  if (metadata.centerName) col.centerName = metadata.centerName;
  if (metadata.collectionCenter) col.collectionCenter = metadata.collectionCenter;

  // On-site farm / center inspection
  if (metadata.inspection) {
    col.qualityInspection = {
      ...col.qualityInspection,
      ...metadata.inspection,
      inspectedAt: new Date()
    };
  }

  // Acceptance & QC outcome
  if (newStatus === 'accepted') {
    const acceptedKg = Number(metadata.acceptedQuantityKg) > 0
      ? Number(metadata.acceptedQuantityKg)
      : (col.acceptedQuantityKg ?? col.estimatedQuantityKg);
    col.acceptedQuantityKg = acceptedKg;
    col.rejectedQuantityKg = Math.max(0, col.estimatedQuantityKg - acceptedKg);
    col.totalFinalPayoutInr = Math.round(acceptedKg * col.unitPriceInr);
    if (!col.paymentStatus || col.paymentStatus === 'pending') {
      col.paymentStatus = 'processing';
    }

    // Synchronize with AggregationLot if linked
    if (col.aggregationLot) {
      const lot = await AggregationLot.findById(col.aggregationLot);
      if (lot) {
        const contrib = lot.contributions.find((c) => String(c.crop) === String(col.crop));
        if (contrib) {
          contrib.status = 'delivered';
          contrib.quantityInKg = acceptedKg;
          await lot.save();
        }
      }
    }
  }

  // Rejection
  if (newStatus === 'rejected') {
    col.rejectedQuantityKg = col.estimatedQuantityKg;
    col.acceptedQuantityKg = 0;
    col.totalFinalPayoutInr = 0;
    col.paymentStatus = 'failed';
    if (metadata.rejectionReason) {
      col.qualityInspection.notes = metadata.rejectionReason;
    }
  }

  // Payment processing & completion
  if (metadata.paymentStatus) {
    col.paymentStatus = metadata.paymentStatus;
    if (metadata.paymentReference) col.paymentReference = metadata.paymentReference;
    if (metadata.paymentStatus === 'paid') {
      col.paidAt = new Date();
    }
  }

  // Record timeline event
  col.timeline.push({
    status: newStatus,
    timestamp: new Date(),
    note: metadata.note || `Status updated to ${newStatus}`,
    actor: metadata.actor || 'Logistics Partner'
  });

  await col.save();

  // Notify farmer of critical status milestones
  const msgMap = {
    in_transit: `Logistics vehicle is on the way for collection pickup ${col.collectionId}.`,
    inspected_at_farm: `Your produce was inspected at farm. Quality grade: ${col.qualityInspection?.gradeAssigned || col.grade}.`,
    delivered_to_hub: `Collection ${col.collectionId} safely delivered to regional hub ${col.centerName || ''}.`,
    accepted: `Produce accepted! Verified quantity: ${col.acceptedQuantityKg} kg. Payout of ₹${col.totalFinalPayoutInr} is processing.`,
    rejected: `Collection ${col.collectionId} was rejected during inspection: ${metadata.rejectionReason || 'Quality standards not met'}.`
  };

  if (msgMap[newStatus]) {
    notify(col.farmer, 'collection_update', msgMap[newStatus], `/farmer/collections`).catch(() => {});
  }

  if (metadata.paymentStatus === 'paid') {
    notify(
      col.farmer,
      'payment_received',
      `Payment of ₹${col.totalFinalPayoutInr} for collection ${col.collectionId} has been disbursed (Ref: ${col.paymentReference || 'UPI'}).`,
      `/farmer/collections`
    ).catch(() => {});
  }

  return col;
}

/**
 * Aggregates collection analytics and payouts for a given farmer.
 */
export async function getFarmerCollectionSummary(farmerId) {
  const collections = await CollectionRequest.find({ farmer: farmerId }).sort('-createdAt');

  let totalScheduledKg = 0;
  let totalAcceptedKg = 0;
  let estimatedEarningsInr = 0;
  let receivedEarningsInr = 0;
  let pendingPayoutInr = 0;

  for (const c of collections) {
    if (['scheduled', 'in_transit', 'inspected_at_farm', 'delivered_to_hub'].includes(c.status)) {
      totalScheduledKg += c.estimatedQuantityKg || 0;
      estimatedEarningsInr += c.totalEstimatedPayoutInr || 0;
    }
    if (c.status === 'accepted') {
      totalAcceptedKg += c.acceptedQuantityKg || 0;
      if (c.paymentStatus === 'paid') {
        receivedEarningsInr += c.totalFinalPayoutInr || 0;
      } else {
        pendingPayoutInr += c.totalFinalPayoutInr || 0;
      }
    }
  }

  return {
    totalCollectionsCount: collections.length,
    totalScheduledKg: Math.round(totalScheduledKg),
    totalAcceptedKg: Math.round(totalAcceptedKg),
    estimatedEarningsInr,
    receivedEarningsInr,
    pendingPayoutInr,
    collections
  };
}
