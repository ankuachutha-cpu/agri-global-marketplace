import crypto from 'node:crypto';
import { Crop } from '../models/Crop.js';
import { AggregationLot } from '../models/AggregationLot.js';
import { notify } from './notify.js';

export function toKg(qty, unit = 'kg') {
  const u = String(unit || 'kg').toLowerCase().trim();
  const q = Number(qty) || 0;
  if (u === 'tonne' || u === 'ton' || u === 'tonnes') return q * 1000;
  if (u === 'quintal' || u === 'quintals') return q * 100;
  return q;
}

export function fromKg(kg, targetUnit = 'kg') {
  const u = String(targetUnit || 'kg').toLowerCase().trim();
  const k = Number(kg) || 0;
  if (u === 'tonne' || u === 'ton' || u === 'tonnes') return k / 1000;
  if (u === 'quintal' || u === 'quintals') return k / 100;
  return k;
}

export function pricePerKg(priceInr, unit = 'kg') {
  const u = String(unit || 'kg').toLowerCase().trim();
  const p = Number(priceInr) || 0;
  if (u === 'tonne' || u === 'ton' || u === 'tonnes') return p / 1000;
  if (u === 'quintal' || u === 'quintals') return p / 100;
  return p;
}

export function normaliseCropName(name) {
  if (!name) return '';
  let s = String(name).trim();
  // Strip common marketing descriptors so crops group naturally by commodity
  s = s.replace(/^(organic|fresh|premium|export quality)\s+/i, '');
  // Standardise common plurals (e.g., Tomatoes -> Tomato, Potatoes -> Potato, Mangoes -> Mango, Apples -> Apple)
  s = s.replace(/tomatoes$/i, 'Tomato')
       .replace(/potatoes$/i, 'Potato')
       .replace(/mangoes$/i, 'Mango')
       .replace(/onions$/i, 'Onion')
       .replace(/bananas$/i, 'Banana')
       .replace(/apples$/i, 'Apple');
  // Capitalise first letter of each word
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function generateLotId(cropName, grade = 'A', state = 'IN') {
  const cropCode = (cropName.replace(/[^a-zA-Z]/g, '').slice(0, 3) || 'CRP').toUpperCase();
  const gradeCode = String(grade || 'A').toUpperCase().charAt(0);
  const stateCode = (state.replace(/[^a-zA-Z]/g, '').slice(0, 2) || 'IN').toUpperCase();
  const rand = crypto.randomInt(1000, 9999);
  return `LOT-${cropCode}-${gradeCode}-${stateCode}-${rand}`;
}

/**
 * Returns available crops grouped by compatible criteria:
 * (normalisedCropName, grade, state)
 */
export async function getCompatibleCropsGrouped(filterState = null) {
  const query = {
    status: 'available',
    quantity: { $gt: 0 }
  };
  if (filterState) {
    query.state = new RegExp(`^${filterState.trim()}$`, 'i');
  }

  const crops = await Crop.find(query)
    .populate('farmer', 'name email phone state city')
    .sort('-createdAt');

  const groups = {};

  for (const crop of crops) {
    const unallocatedUnits = Math.max(0, crop.quantity - (crop.allocatedQuantity || 0));
    if (unallocatedUnits <= 0) continue; // fully allocated to other lots or sold

    const normName = normaliseCropName(crop.name);
    const grade = crop.grade || 'Ungraded';
    const state = crop.state || 'Other';
    const key = `${normName}:::${grade}:::${state}`.toLowerCase();

    const unallocatedKg = toKg(unallocatedUnits, crop.unit);
    const pPerKg = pricePerKg(crop.priceInr, crop.unit);

    if (!groups[key]) {
      groups[key] = {
        key,
        cropName: normName,
        category: crop.category,
        grade,
        state,
        totalAvailableKg: 0,
        eligibleCropsCount: 0,
        uniqueFarmerIds: new Set(),
        crops: []
      };
    }

    groups[key].totalAvailableKg += unallocatedKg;
    groups[key].eligibleCropsCount += 1;
    if (crop.farmer?._id) {
      groups[key].uniqueFarmerIds.add(String(crop.farmer._id));
    }

    groups[key].crops.push({
      _id: crop._id,
      farmerId: crop.farmer?._id,
      farmerName: crop.farmer?.name || 'Farmer',
      farmerPhone: crop.farmer?.phone || '',
      farmerLocation: crop.location || crop.farmer?.city || '',
      farmerState: crop.state || crop.farmer?.state || '',
      originalQuantity: crop.quantity,
      allocatedQuantity: crop.allocatedQuantity || 0,
      unallocatedUnits,
      unallocatedKg,
      unit: crop.unit,
      priceInr: crop.priceInr,
      pricePerKg: pPerKg,
      images: crop.images || []
    });
  }

  return Object.values(groups).map((g) => ({
    ...g,
    farmersCount: g.uniqueFarmerIds.size,
    uniqueFarmerIds: undefined
  }));
}

/**
 * Automatically groups unallocated crops and creates/updates aggregation lots.
 */
export async function autoAggregateCrops({ targetLotSize = 1000, state = null } = {}) {
  const groups = await getCompatibleCropsGrouped(state);
  const createdLots = [];

  for (const group of groups) {
    // Only aggregate if there are at least 2 farmer contributions or at least 200 kg available
    if (group.crops.length < 1) continue;

    // Check if an active 'forming' lot already exists for this exact cropName, grade, state
    let lot = await AggregationLot.findOne({
      cropName: group.cropName,
      grade: group.grade,
      state: group.state,
      status: 'forming'
    });

    const isNew = !lot;
    if (!lot) {
      lot = new AggregationLot({
        lotId: generateLotId(group.cropName, group.grade, group.state),
        cropName: group.cropName,
        category: group.category,
        grade: group.grade,
        state: group.state,
        region: group.crops[0]?.farmerLocation || group.state,
        targetQuantityKg: targetLotSize,
        contributions: [],
        autoAggregated: true
      });
    }

    let addedKg = 0;
    const existingCropIds = new Set(lot.contributions.map((c) => String(c.crop)));

    for (const cropItem of group.crops) {
      if (existingCropIds.has(String(cropItem._id))) continue; // already contributed to this lot
      if (cropItem.unallocatedKg <= 0) continue;

      // Allocate the unallocated quantity to this lot
      const contribKg = cropItem.unallocatedKg;
      lot.contributions.push({
        crop: cropItem._id,
        farmer: cropItem.farmerId,
        farmerName: cropItem.farmerName,
        farmerPhone: cropItem.farmerPhone,
        farmerLocation: cropItem.farmerLocation,
        farmerState: cropItem.farmerState,
        quantityInKg: contribKg,
        pricePerKg: cropItem.pricePerKg,
        status: 'committed'
      });

      addedKg += contribKg;

      // Atomically update crop allocatedQuantity
      await Crop.findByIdAndUpdate(cropItem._id, {
        $inc: { allocatedQuantity: cropItem.unallocatedUnits },
        $set: {
          aggregationStatus: 'fully_aggregated',
          aggregationLot: lot._id
        }
      });

      // Notify farmer
      if (cropItem.farmerId) {
        notify(
          cropItem.farmerId,
          'crop_aggregated',
          `Your ${cropItem.unallocatedUnits} ${cropItem.unit} of ${group.cropName} has been aggregated into bulk export lot ${lot.lotId}`,
          `/farmer/aggregation`
        ).catch(() => {});
      }
    }

    if (addedKg > 0 || isNew) {
      // Recalculate totals and weighted average price
      const totalKg = lot.contributions.reduce((acc, c) => acc + c.quantityInKg, 0);
      const totalValue = lot.contributions.reduce((acc, c) => acc + (c.quantityInKg * c.pricePerKg), 0);
      lot.totalQuantityKg = Math.round(totalKg * 100) / 100;
      lot.weightedAvgPricePerKg = totalKg > 0 ? Math.round((totalValue / totalKg) * 100) / 100 : 0;
      lot.participatingFarmersCount = new Set(lot.contributions.map((c) => String(c.farmer))).size;

      // If reached target, mark as ready for inspection
      if (lot.totalQuantityKg >= lot.targetQuantityKg && lot.status === 'forming') {
        lot.status = 'ready_for_inspection';
      }

      await lot.save();
      createdLots.push(lot);
    }
  }

  return createdLots;
}

/**
 * Creates a custom aggregation lot with explicitly chosen crops and quantities.
 */
export async function createCustomLot({
  cropName,
  category = 'Vegetables',
  grade = 'A',
  state,
  region = '',
  targetQuantityKg = 1000,
  cropAllocations = [], // [{ cropId, quantityInOriginalUnit }]
  notes = ''
}) {
  if (!cropName || !state) {
    throw new Error('Crop name and state are required to create an aggregation lot');
  }

  const normName = normaliseCropName(cropName);
  const lotId = generateLotId(normName, grade, state);

  const lot = new AggregationLot({
    lotId,
    cropName: normName,
    category,
    grade,
    state,
    region,
    targetQuantityKg: Number(targetQuantityKg) || 1000,
    contributions: [],
    notes,
    autoAggregated: false
  });

  let totalKg = 0;
  let totalValue = 0;

  for (const alloc of cropAllocations) {
    const crop = await Crop.findById(alloc.cropId).populate('farmer', 'name phone state city');
    if (!crop) continue;

    const requestedUnits = Number(alloc.quantityInOriginalUnit) || (crop.quantity - (crop.allocatedQuantity || 0));
    const availableUnits = Math.max(0, crop.quantity - (crop.allocatedQuantity || 0));

    if (requestedUnits <= 0 || requestedUnits > availableUnits) {
      throw new Error(`Insufficient unallocated quantity for crop "${crop.name}" (requested ${requestedUnits}, available ${availableUnits})`);
    }

    const contribKg = toKg(requestedUnits, crop.unit);
    const pPerKg = pricePerKg(crop.priceInr, crop.unit);

    lot.contributions.push({
      crop: crop._id,
      farmer: crop.farmer?._id,
      farmerName: crop.farmer?.name || 'Farmer',
      farmerPhone: crop.farmer?.phone || '',
      farmerLocation: crop.location || crop.farmer?.city || '',
      farmerState: crop.state || crop.farmer?.state || '',
      quantityInKg: contribKg,
      pricePerKg: pPerKg,
      status: 'committed'
    });

    totalKg += contribKg;
    totalValue += (contribKg * pPerKg);

    const newAlloc = (crop.allocatedQuantity || 0) + requestedUnits;
    crop.allocatedQuantity = newAlloc;
    crop.aggregationStatus = newAlloc >= crop.quantity ? 'fully_aggregated' : 'partially_aggregated';
    crop.aggregationLot = lot._id;
    await crop.save();

    if (crop.farmer?._id) {
      notify(
        crop.farmer._id,
        'crop_aggregated',
        `Your ${requestedUnits} ${crop.unit} of ${normName} was added to lot ${lotId}`,
        `/farmer/aggregation`
      ).catch(() => {});
    }
  }

  lot.totalQuantityKg = Math.round(totalKg * 100) / 100;
  lot.weightedAvgPricePerKg = totalKg > 0 ? Math.round((totalValue / totalKg) * 100) / 100 : 0;
  lot.participatingFarmersCount = new Set(lot.contributions.map((c) => String(c.farmer))).size;

  if (lot.totalQuantityKg >= lot.targetQuantityKg) {
    lot.status = 'ready_for_inspection';
  }

  await lot.save();
  return lot;
}

/**
 * Updates status of an aggregation lot across the aggregation lifecycle.
 */
export async function updateLotStatus(lotIdOrMongoId, newStatus, metadata = {}) {
  const lot = await AggregationLot.findOne({
    $or: [{ lotId: String(lotIdOrMongoId).toUpperCase() }, { _id: lotIdOrMongoId }]
  });

  if (!lot) {
    throw new Error(`Aggregation lot not found: ${lotIdOrMongoId}`);
  }

  const prevStatus = lot.status;
  lot.status = newStatus;

  if (metadata.notes) lot.notes = metadata.notes;
  if (metadata.exportBuyer) lot.exportBuyer = metadata.exportBuyer;
  if (metadata.buyerName) lot.buyerName = metadata.buyerName;
  if (metadata.destinationCountry) lot.destinationCountry = metadata.destinationCountry;
  if (metadata.assignedCollectionCenter) lot.assignedCollectionCenter = metadata.assignedCollectionCenter;
  if (metadata.centerName) lot.centerName = metadata.centerName;

  if (metadata.inspection) {
    lot.inspectionReport = {
      ...lot.inspectionReport,
      ...metadata.inspection,
      inspectedAt: new Date()
    };
  }

  // Handle cancellation: release allocated quantities back to farmers
  if (newStatus === 'cancelled' && prevStatus !== 'cancelled') {
    for (const contrib of lot.contributions) {
      const crop = await Crop.findById(contrib.crop);
      if (crop) {
        const unitsInOriginal = fromKg(contrib.quantityInKg, crop.unit);
        const newAlloc = Math.max(0, (crop.allocatedQuantity || 0) - unitsInOriginal);
        crop.allocatedQuantity = newAlloc;
        crop.aggregationStatus = newAlloc > 0 ? 'partially_aggregated' : 'unallocated';
        if (String(crop.aggregationLot) === String(lot._id)) {
          crop.aggregationLot = null;
        }
        await crop.save();

        if (contrib.farmer) {
          notify(
            contrib.farmer,
            'lot_cancelled',
            `Aggregation lot ${lot.lotId} was cancelled. Your ${unitsInOriginal} ${crop.unit} is available again.`,
            `/farmer/crops`
          ).catch(() => {});
        }
      }
    }
  }

  // Handle export completion: permanently deduct quantities
  if (newStatus === 'exported' && prevStatus !== 'exported') {
    for (const contrib of lot.contributions) {
      const crop = await Crop.findById(contrib.crop);
      if (crop) {
        const unitsInOriginal = fromKg(contrib.quantityInKg, crop.unit);
        crop.quantity = Math.max(0, crop.quantity - unitsInOriginal);
        crop.allocatedQuantity = Math.max(0, (crop.allocatedQuantity || 0) - unitsInOriginal);
        if (crop.quantity <= 0) {
          crop.status = 'unavailable';
        }
        await crop.save();

        if (contrib.farmer) {
          notify(
            contrib.farmer,
            'lot_exported',
            `Congratulations! Lot ${lot.lotId} containing your produce has been exported to ${lot.destinationCountry || 'international buyers'}.`,
            `/farmer/aggregation`
          ).catch(() => {});
        }
      }
    }
  }

  // Handle collection status update
  if (newStatus === 'collected') {
    lot.contributions.forEach((c) => { c.status = 'collected'; });
  }

  await lot.save();
  return lot;
}

/**
 * Returns summary stats of all aggregated lots.
 */
export async function getAggregationStats() {
  const [totalLots, lots] = await Promise.all([
    AggregationLot.countDocuments(),
    AggregationLot.find().select('cropName state grade totalQuantityKg status participatingFarmersCount destinationCountry')
  ]);

  let totalAggregatedKg = 0;
  let exportReadyLots = 0;
  let exportedLots = 0;
  const uniqueFarmers = new Set();
  const byCrop = {};
  const byState = {};

  for (const lot of lots) {
    if (lot.status !== 'cancelled') {
      totalAggregatedKg += lot.totalQuantityKg || 0;
    }
    if (['ready_for_inspection', 'inspected', 'collected', 'allocated_for_export'].includes(lot.status)) {
      exportReadyLots += 1;
    }
    if (lot.status === 'exported') {
      exportedLots += 1;
    }

    // Crop breakdown
    byCrop[lot.cropName] = (byCrop[lot.cropName] || 0) + (lot.totalQuantityKg || 0);

    // State breakdown
    byState[lot.state] = (byState[lot.state] || 0) + (lot.totalQuantityKg || 0);
  }

  return {
    totalLots,
    totalAggregatedKg: Math.round(totalAggregatedKg),
    exportReadyLots,
    exportedLots,
    cropBreakdown: byCrop,
    stateBreakdown: byState
  };
}
