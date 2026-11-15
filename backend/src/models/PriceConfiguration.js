import mongoose from 'mongoose';

const priceConfigurationSchema = new mongoose.Schema({
  cropName: {
    type: String,
    required: true,
    unique: true,
    enum: ['Ragi', 'Rice', 'Jowar']
  },
  mandiReferencePricePerKg: { type: Number, required: true, min: 0 },
  defaultFarmerProcurementPricePerKg: { type: Number, required: true, min: 0 },
  buyerProcurementRatePerKg: { type: Number, required: true, min: 0 },
  platformMarginPercent: { type: Number, default: 5, min: 0, max: 50 },
  logisticsCostPerKg: { type: Number, default: 2, min: 0 },
  qualityAdjustments: {
    gradeA: { type: Number, default: 0 },
    gradeB: { type: Number, default: -2 },
    gradeC: { type: Number, default: -4 }
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export const PriceConfiguration = mongoose.models.PriceConfiguration || mongoose.model('PriceConfiguration', priceConfigurationSchema);
