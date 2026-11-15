import mongoose from 'mongoose';
import crypto from 'node:crypto';

export const ALLOWED_REQUIREMENT_CROPS = ['Ragi', 'Rice', 'Jowar'];

export const VEHICLE_TYPES = [
  { type: 'Small Truck 3T', capacityKg: 3000 },
  { type: 'Medium Truck 10T', capacityKg: 10000 },
  { type: 'Heavy Truck 25T', capacityKg: 25000 },
  { type: 'Large Container 40T', capacityKg: 40000 }
];

const allocationSchema = new mongoose.Schema({
  allocationId: { type: String, required: true },
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  farmerName: { type: String, required: true },
  farmerPhone: { type: String, default: '' },
  farmerLocation: { type: String, default: '' },
  farmerVillage: { type: String, default: '' },
  farmerHobli: { type: String, default: '' },
  farmerTaluk: { type: String, default: '' },
  farmerDistrict: { type: String, default: '' },
  farmerCoordinates: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null }
  },
  crop: { type: mongoose.Schema.Types.ObjectId, ref: 'Crop', required: true, index: true },
  cropName: { type: String, required: true },
  grade: { type: String, default: 'Grade A' },
  allocatedQuantityKg: { type: Number, required: true, min: 0.1 },
  procurementPricePerKg: { type: Number, required: true, min: 0 },
  farmerGrossPayable: { type: Number, required: true, min: 0 },

  collectionStatus: {
    type: String,
    enum: ['scheduled', 'vehicle_assigned', 'on_the_way', 'arrived', 'weighed', 'collected'],
    default: 'scheduled'
  },
  actualWeighedKg: { type: Number, default: 0 },
  acceptedQuantityKg: { type: Number, default: 0 },
  rejectedQuantityKg: { type: Number, default: 0 },
  qcGrade: { type: String, default: '' },
  collectionNotes: { type: String, default: '' },
  weightSlipImage: { type: String, default: '' },
  allocatedAt: { type: Date, default: Date.now },
  collectedAt: { type: Date }
}, { _id: true });

const vehicleSchema = new mongoose.Schema({
  vehicleType: { type: String, default: '' },
  registrationNumber: { type: String, default: '' },
  capacityKg: { type: Number, default: 0 },
  driverName: { type: String, default: '' },
  driverPhone: { type: String, default: '' },
  scheduledPickupDate: { type: Date },
  currentStatus: {
    type: String,
    enum: [
      'none',
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
    ],
    default: 'none'
  },
  route: [{ type: String }],
  trackingNotes: { type: String, default: '' },
  assignedAt: { type: Date }
}, { _id: false });

const deliverySchema = new mongoose.Schema({
  dispatchedQuantityKg: { type: Number, default: 0 },
  receivedQuantityKg: { type: Number, default: 0 },
  buyerInspectionNotes: { type: String, default: '' },
  confirmedByBuyer: { type: Boolean, default: false },
  confirmedAt: { type: Date }
}, { _id: false });

const buyerRequirementSchema = new mongoose.Schema({
  requirementId: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  buyerName: { type: String, required: true },
  buyerEmail: { type: String, required: true },
  buyerCompany: { type: String, default: '' },
  cropName: {
    type: String,
    required: true,
    enum: ALLOWED_REQUIREMENT_CROPS,
    index: true
  },
  requiredQuantityKg: { type: Number, required: true, min: 1 },
  requiredGrade: { type: String, default: 'Grade A' },
  qualitySpecifications: { type: String, default: '' },
  targetBudgetPricePerKg: { type: Number, default: 0 },
  deliveryDestination: { type: String, required: true, trim: true },
  destinationAddress: { type: String, trim: true, default: '' },
  requiredDeliveryDate: { type: Date, default: () => new Date(Date.now() + 14 * 86400000) },
  additionalInstructions: { type: String, default: '' },

  // Live Aggregation & Fulfillment Metrics
  allocatedQuantityKg: { type: Number, default: 0, min: 0 },
  collectedQuantityKg: { type: Number, default: 0, min: 0 },
  qcAcceptedQuantityKg: { type: Number, default: 0, min: 0 },
  remainingQuantityKg: { type: Number, required: true, min: 0 },

  status: {
    type: String,
    enum: [
      'open',
      'partially_allocated',
      'allocated',
      'collecting',
      'in_transit',
      'delivered',
      'completed',
      'cancelled'
    ],
    default: 'open',
    index: true
  },

  // Automated Farmer Allocations (Zero farmer accept/reject)
  allocations: [allocationSchema],
  vehicle: { type: vehicleSchema, default: () => ({}) },
  delivery: { type: deliverySchema, default: () => ({}) },

  // Linked Aggregation Lot
  aggregationLot: { type: mongoose.Schema.Types.ObjectId, ref: 'AggregationLot' },
}, { timestamps: true });

export function generateRequirementId() {
  const d = new Date().toISOString().slice(2, 7).replace('-', '');
  const r = crypto.randomInt(1000, 9999);
  return `REQ-${d}-${r}`;
}

export function generateAllocationId() {
  const d = new Date().toISOString().slice(2, 7).replace('-', '');
  const r = crypto.randomInt(1000, 9999);
  return `ALC-${d}-${r}`;
}
export const generateContributionId = generateAllocationId;

export const BuyerRequirement = mongoose.models.BuyerRequirement || mongoose.model('BuyerRequirement', buyerRequirementSchema);
