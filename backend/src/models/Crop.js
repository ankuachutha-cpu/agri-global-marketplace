import mongoose from 'mongoose';

export const ALLOWED_CROPS = ['Ragi', 'Rice', 'Jowar'];
export const CATEGORIES = ['Grains', 'Millets', 'Pulses'];

const cropSchema = new mongoose.Schema({
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: {
    type: String,
    required: true,
    enum: ALLOWED_CROPS,
    index: true
  },
  category: { type: String, default: 'Grains' },
  description: { type: String, trim: true, default: '' },
  qualityDescription: { type: String, trim: true, default: '' },
  images: [{ type: String }],

  // Stored normalized quantities in kilograms
  totalQuantityKg: { type: Number, required: true, min: 0 },
  availableQuantityKg: { type: Number, required: true, min: 0 },
  allocatedQuantityKg: { type: Number, default: 0, min: 0 },
  collectedQuantityKg: { type: Number, default: 0, min: 0 },

  // Display quantities
  quantity: { type: Number, required: true, min: 0 }, // Farmer-entered quantity
  unit: { type: String, enum: ['kg', 'quintal', 'tonne'], default: 'kg' },

  // Pricing
  priceInr: { type: Number, required: true, min: 0 }, // Price per kg
  expectedPricePerQuintal: { type: Number, min: 0 },

  // Location & Geocoding
  location: { type: String, required: true, trim: true },
  state: { type: String, trim: true, default: 'Karnataka' },
  country: { type: String, default: 'India' },
  village: { type: String, trim: true, default: '' },
  hobli: { type: String, trim: true, default: '' },
  taluk: { type: String, trim: true, default: '' },
  district: { type: String, trim: true, default: '' },
  farmAddress: { type: String, trim: true, default: '' },
  pincode: { type: String, trim: true, default: '' },
  coordinates: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null }
  },

  harvestDate: { type: Date },
  grade: {
    type: String,
    enum: ['Grade A', 'Grade B', 'Grade C', 'A', 'B', 'C', 'Ungraded'],
    default: 'Grade A'
  },

  status: {
    type: String,
    enum: ['available', 'allocated', 'in_collection', 'collected', 'delivered', 'unavailable'],
    default: 'available',
    index: true
  },

  // Linked Aggregation Lot
  aggregationLot: { type: mongoose.Schema.Types.ObjectId, ref: 'AggregationLot' },
}, { timestamps: true });

cropSchema.index({ name: 1, status: 1 });
cropSchema.index({ farmer: 1, status: 1 });
cropSchema.index({ 'coordinates.latitude': 1, 'coordinates.longitude': 1 });

cropSchema.set('toJSON', { virtuals: true });
cropSchema.set('toObject', { virtuals: true });

export const Crop = mongoose.models.Crop || mongoose.model('Crop', cropSchema);
