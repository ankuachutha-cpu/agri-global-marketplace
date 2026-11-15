import mongoose from 'mongoose';

export const LOT_STATUSES = [
  'forming',              // Crop being aggregated from farmers
  'ready_for_inspection', // Bulk target reached, waiting for QC / grading
  'inspected',            // Quality certified
  'collected',            // Transferred to regional aggregation center
  'allocated_for_export', // Assigned to international buyer / container
  'in_transit',           // En route / dispatched
  'exported',             // Shipped / delivered internationally
  'cancelled'             // Released back to individual farmers
];

const contributionSchema = new mongoose.Schema({
  crop: { type: mongoose.Schema.Types.ObjectId, ref: 'Crop', required: true },
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  farmerName: { type: String, required: true },
  farmerPhone: { type: String, default: '' },
  farmerLocation: { type: String, default: '' },
  farmerState: { type: String, default: '' },
  quantityInKg: { type: Number, required: true, min: 0.1 },
  pricePerKg: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['committed', 'collected', 'delivered', 'cancelled'], default: 'committed' },
  committedAt: { type: Date, default: Date.now },
  notes: { type: String, default: '' }
}, { _id: true });

const documentSchema = new mongoose.Schema({
  docType: { type: String, required: true }, // e.g. Phytosanitary Certificate, Certificate of Origin, Bill of Lading, Invoice & Packing List, Lab Quality Cert
  docNumber: { type: String, default: '' },
  issuedBy: { type: String, default: '' },
  issueDate: Date,
  status: { type: String, enum: ['pending', 'issued', 'verified'], default: 'pending' },
  fileUrl: { type: String, default: '' }
}, { _id: true });

const aggregationLotSchema = new mongoose.Schema({
  lotId: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  cropName: { type: String, required: true, trim: true, index: true },
  category: { type: String, required: true, trim: true },
  grade: { type: String, enum: ['A', 'B', 'C', 'Ungraded'], required: true, default: 'A' },
  state: { type: String, required: true, trim: true, index: true },
  region: { type: String, trim: true, default: '' },
  
  // Total aggregated volume in kg
  totalQuantityKg: { type: Number, required: true, min: 0, default: 0 },
  // Bulk target threshold for commercial export (e.g., 1000 kg, 5000 kg, 10000 kg)
  targetQuantityKg: { type: Number, required: true, default: 1000 },
  
  // Weighted average price across all farmer contributions
  weightedAvgPricePerKg: { type: Number, required: true, default: 0 },
  
  status: { type: String, enum: LOT_STATUSES, default: 'forming', index: true },
  contributions: [contributionSchema],
  participatingFarmersCount: { type: Number, default: 0 },

  // Quality Inspection
  inspectionReport: {
    passed: { type: Boolean, default: null },
    inspectorName: { type: String, default: '' },
    inspectedAt: Date,
    moisturePercent: Number,
    gradeAssigned: String,
    notes: { type: String, default: '' }
  },

  // Buyer Requirement & Destination
  buyerRequirement: { type: mongoose.Schema.Types.ObjectId, ref: 'BuyerRequirement' },
  exportBuyer: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  buyerName: { type: String, default: '' },
  destinationCountry: { type: String, default: '' },
  assignedCollectionCenter: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectionCenter' },
  centerName: { type: String, default: '' },

  // Container & Shipping Logistics
  containerType: { type: String, default: '40ft High Cube Reefer' },
  containerCapacityKg: { type: Number, default: 24000 },
  containerId: { type: String, default: '' },
  sealNumber: { type: String, default: '' },
  temperatureSetpoint: { type: String, default: '+4°C to +6°C' },
  shippingLine: { type: String, default: '' },
  vesselName: { type: String, default: '' },
  portOfLoading: { type: String, default: 'JNPT Mumbai' },
  portOfDischarge: { type: String, default: '' },
  shipmentStatus: {
    type: String,
    enum: ['unallocated', 'booked', 'loaded_at_port', 'in_transit_sea', 'customs_cleared', 'delivered_to_importer'],
    default: 'unallocated'
  },
  
  // Financials & Platform Commissions
  exportSalePricePerKg: { type: Number, default: 0 },
  totalExportValueInr: { type: Number, default: 0 },
  platformCommissionPercent: { type: Number, default: 5 },
  platformCommissionInr: { type: Number, default: 0 },
  netFarmerDisbursalInr: { type: Number, default: 0 },
  buyerPaymentStatus: { type: String, enum: ['pending', 'partially_paid', 'paid'], default: 'pending' },

  // Export Documentation Checklist
  documents: [documentSchema],
  
  notes: { type: String, default: '' },
  autoAggregated: { type: Boolean, default: false }
}, { timestamps: true });

aggregationLotSchema.index({ cropName: 1, grade: 1, state: 1, status: 1 });
aggregationLotSchema.index({ shipmentStatus: 1 });
aggregationLotSchema.index({ exportBuyer: 1 });

export const AggregationLot = mongoose.models.AggregationLot || mongoose.model('AggregationLot', aggregationLotSchema);
