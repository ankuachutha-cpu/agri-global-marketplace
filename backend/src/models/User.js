import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['farmer', 'buyer', 'admin'], required: true },
  phone: { type: String, trim: true, maxlength: 30 },
  country: { type: String, trim: true, default: 'India' },
  currency: { type: String, enum: ['INR', 'USD', 'AED', 'EUR', 'GBP', 'SAR', 'SGD'], default: 'INR' },
  state: { type: String, trim: true, default: 'Karnataka' },
  city: { type: String, trim: true },
  organization: { type: String, trim: true },

  // Farmer Farm Location & Complete Geocoded Address
  farmLocation: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    village: { type: String, trim: true, default: '' },
    hobli: { type: String, trim: true, default: '' },
    taluk: { type: String, trim: true, default: '' },
    district: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: 'Karnataka' },
    country: { type: String, trim: true, default: 'India' },
    address: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },
  },

  // Buyer Company Profile Details & Verification
  companyName: { type: String, trim: true, default: '' },
  buyerType: {
    type: String,
    enum: ['bulk_buyer', 'processor', 'exporter', 'wholesaler', 'retail_chain', 'importer', 'other'],
    default: 'bulk_buyer'
  },
  businessRegistrationNumber: { type: String, trim: true, default: '' },
  gstin: { type: String, trim: true, default: '' },
  deliveryAddress: { type: String, trim: true, default: '' },
  verificationStatus: {
    type: String,
    enum: ['unverified', 'pending', 'verified', 'rejected'],
    default: 'verified'
  },
  verifiedAt: Date,

  // Banking & Financial Settlement Credentials for Farmer Payouts
  bankAccount: {
    accountHolderName: { type: String, trim: true, default: '' },
    accountNumber: { type: String, trim: true, default: '' },
    ifscCode: { type: String, trim: true, uppercase: true, default: '' },
    bankName: { type: String, trim: true, default: '' },
    upiId: { type: String, trim: true, lowercase: true, default: '' },
    settlementPreference: { type: String, enum: ['UPI', 'NEFT'], default: 'UPI' }
  },
  payableBalanceInr: { type: Number, default: 0, min: 0 },
  totalSettledEarningsInr: { type: Number, default: 0, min: 0 },

  active: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.methods.toSafe = function () {
  const o = this.toObject();
  delete o.passwordHash;
  delete o.__v;
  return o;
};

export const User = mongoose.models.User || mongoose.model('User', userSchema);
