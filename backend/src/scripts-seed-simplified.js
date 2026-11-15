import mongoose from 'mongoose';
import { Crop } from './models/Crop.js';
import { User } from './models/User.js';
import { BuyerRequirement, generateRequirementId, generateAllocationId } from './models/BuyerRequirement.js';
import { AggregationLot } from './models/AggregationLot.js';
import { FarmerPayment, generatePaymentId } from './models/FarmerPayment.js';
import { PriceConfiguration } from './models/PriceConfiguration.js';

const DEMO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agri_marketplace_demo';

async function seed() {
  await mongoose.connect(DEMO_URI);
  console.log('Connected to MongoDB:', DEMO_URI);

  // 1. Seed or update Price Configurations
  await PriceConfiguration.deleteMany({});
  await PriceConfiguration.insertMany([
    {
      cropName: 'Ragi',
      mandiReferencePricePerKg: 35,
      defaultFarmerProcurementPricePerKg: 38,
      buyerProcurementRatePerKg: 42,
      platformMarginPercent: 5,
      logisticsCostPerKg: 2,
      qualityAdjustments: { gradeA: 0, gradeB: -2, gradeC: -4 }
    },
    {
      cropName: 'Rice',
      mandiReferencePricePerKg: 44,
      defaultFarmerProcurementPricePerKg: 48,
      buyerProcurementRatePerKg: 54,
      platformMarginPercent: 5,
      logisticsCostPerKg: 2.5,
      qualityAdjustments: { gradeA: 0, gradeB: -3, gradeC: -5 }
    },
    {
      cropName: 'Jowar',
      mandiReferencePricePerKg: 38,
      defaultFarmerProcurementPricePerKg: 41,
      buyerProcurementRatePerKg: 46,
      platformMarginPercent: 5,
      logisticsCostPerKg: 2,
      qualityAdjustments: { gradeA: 0, gradeB: -2, gradeC: -4 }
    }
  ]);
  console.log('Price Configurations seeded.');

  // 2. Fetch farmers and buyers
  const farmers = await User.find({ role: 'farmer' }).sort('email');
  const buyers = await User.find({ role: 'buyer' }).sort('email');

  if (farmers.length < 3 || buyers.length < 1) {
    console.log('Not enough farmers or buyers found in demo DB.');
    await mongoose.disconnect();
    return;
  }

  const f1 = await User.findOne({ email: 'farmer1@demo.agriglobal.test' }) || farmers[0];
  const f2 = await User.findOne({ email: 'farmer2@demo.agriglobal.test' }) || farmers[1];
  const f3 = await User.findOne({ email: 'farmer3@demo.agriglobal.test' }) || farmers[2];
  const b1 = await User.findOne({ email: 'buyer1@demo.agriglobal.test' }) || buyers[0];

  // Update farmer profiles with real Karnataka farm locations and bank info
  f1.farmLocation = {
    address: 'Survey No 142, Dudda Village, Dudda Hobli, Mandya Taluk, Mandya District, Karnataka, 571401',
    village: 'Dudda Village',
    hobli: 'Dudda Hobli',
    taluk: 'Mandya Taluk',
    district: 'Mandya',
    state: 'Karnataka',
    country: 'India',
    pincode: '571401',
    latitude: 12.5234,
    longitude: 76.8971
  };
  f1.bankAccount = {
    accountHolderName: f1.name,
    accountNumber: '40982210045612',
    ifscCode: 'SBIN0001244',
    bankName: 'State Bank of India',
    upiId: 'farmer1@oksbi'
  };
  await f1.save();

  f2.farmLocation = {
    address: 'Survey No 88, Hullahalli Village, Nanjangud Hobli, Nanjangud Taluk, Mysuru District, Karnataka, 571314',
    village: 'Hullahalli Village',
    hobli: 'Nanjangud Hobli',
    taluk: 'Nanjangud Taluk',
    district: 'Mysuru',
    state: 'Karnataka',
    country: 'India',
    pincode: '571314',
    latitude: 12.1184,
    longitude: 76.6812
  };
  f2.bankAccount = {
    accountHolderName: f2.name,
    accountNumber: '50200034189201',
    ifscCode: 'HDFC0000412',
    bankName: 'HDFC Bank',
    upiId: 'farmer2@okhdfcbank'
  };
  await f2.save();

  f3.farmLocation = {
    address: 'Survey No 211, Bagur Village, Nuggehalli Hobli, Channarayapatna Taluk, Hassan District, Karnataka, 573116',
    village: 'Bagur Village',
    hobli: 'Nuggehalli Hobli',
    taluk: 'Channarayapatna Taluk',
    district: 'Hassan',
    state: 'Karnataka',
    country: 'India',
    pincode: '573116',
    latitude: 13.0033,
    longitude: 76.3804
  };
  f3.bankAccount = {
    accountHolderName: f3.name,
    accountNumber: '621455009182',
    ifscCode: 'CNRB0002145',
    bankName: 'Canara Bank',
    upiId: 'farmer3@okaxis'
  };
  await f3.save();

  // Update buyer profile
  b1.companyName = 'Global Agro Foods Corp';
  b1.gstin = '29ABCDE1234F1Z5';
  b1.deliveryAddress = 'Plot 45, APMC Yard, Yeshwanthpur Industrial Suburb, Bengaluru, Karnataka, 560022';
  await b1.save();

  // 3. Clean and reseed Crops strictly for Ragi, Rice, Jowar
  await Crop.deleteMany({});

  const cropsToInsert = [
    {
      farmer: f1._id,
      name: 'Ragi',
      category: 'Grains',
      quantity: 35000,
      unit: 'kg',
      totalQuantityKg: 35000,
      availableQuantityKg: 20000,
      allocatedQuantityKg: 15000,
      collectedQuantityKg: 0,
      priceInr: 38,
      expectedPricePerQuintal: 3800,
      location: f1.farmLocation.address,
      village: f1.farmLocation.village,
      hobli: f1.farmLocation.hobli,
      taluk: f1.farmLocation.taluk,
      district: f1.farmLocation.district,
      state: f1.farmLocation.state,
      country: 'India',
      latitude: f1.farmLocation.latitude,
      longitude: f1.farmLocation.longitude,
      farmAddress: f1.farmLocation.address,
      grade: 'Grade A',
      qualityDescription: 'Export Grade finger millet, moisture 10.9%, sortex cleaned',
      status: 'allocated',
      cropStatus: 'allocated',
      coordinates: { latitude: f1.farmLocation.latitude, longitude: f1.farmLocation.longitude }
    },
    {
      farmer: f1._id,
      name: 'Rice',
      category: 'Grains',
      quantity: 28000,
      unit: 'kg',
      totalQuantityKg: 28000,
      availableQuantityKg: 28000,
      allocatedQuantityKg: 0,
      collectedQuantityKg: 0,
      priceInr: 48,
      expectedPricePerQuintal: 4800,
      location: f1.farmLocation.address,
      village: f1.farmLocation.village,
      hobli: f1.farmLocation.hobli,
      taluk: f1.farmLocation.taluk,
      district: f1.farmLocation.district,
      state: f1.farmLocation.state,
      country: 'India',
      latitude: f1.farmLocation.latitude,
      longitude: f1.farmLocation.longitude,
      farmAddress: f1.farmLocation.address,
      grade: 'Grade A',
      qualityDescription: 'Sona Masoori Raw Rice, unpolished single boiled, aged 12 months',
      status: 'available',
      cropStatus: 'available',
      coordinates: { latitude: f1.farmLocation.latitude, longitude: f1.farmLocation.longitude }
    },
    {
      farmer: f2._id,
      name: 'Ragi',
      category: 'Grains',
      quantity: 25000,
      unit: 'kg',
      totalQuantityKg: 25000,
      availableQuantityKg: 10000,
      allocatedQuantityKg: 15000,
      collectedQuantityKg: 0,
      priceInr: 37,
      expectedPricePerQuintal: 3700,
      location: f2.farmLocation.address,
      village: f2.farmLocation.village,
      hobli: f2.farmLocation.hobli,
      taluk: f2.farmLocation.taluk,
      district: f2.farmLocation.district,
      state: f2.farmLocation.state,
      country: 'India',
      latitude: f2.farmLocation.latitude,
      longitude: f2.farmLocation.longitude,
      farmAddress: f2.farmLocation.address,
      grade: 'Grade A',
      qualityDescription: 'Organic certified native red ragi, high calcium, farm dried',
      status: 'allocated',
      cropStatus: 'allocated',
      coordinates: { latitude: f2.farmLocation.latitude, longitude: f2.farmLocation.longitude }
    },
    {
      farmer: f2._id,
      name: 'Jowar',
      category: 'Grains',
      quantity: 30000,
      unit: 'kg',
      totalQuantityKg: 30000,
      availableQuantityKg: 30000,
      allocatedQuantityKg: 0,
      collectedQuantityKg: 0,
      priceInr: 41,
      expectedPricePerQuintal: 4100,
      location: f2.farmLocation.address,
      village: f2.farmLocation.village,
      hobli: f2.farmLocation.hobli,
      taluk: f2.farmLocation.taluk,
      district: f2.farmLocation.district,
      state: f2.farmLocation.state,
      country: 'India',
      latitude: f2.farmLocation.latitude,
      longitude: f2.farmLocation.longitude,
      farmAddress: f2.farmLocation.address,
      grade: 'Grade A',
      qualityDescription: 'White Sorghum / Maldandi Jowar, premium export grade, moisture 11%',
      status: 'available',
      cropStatus: 'available',
      coordinates: { latitude: f2.farmLocation.latitude, longitude: f2.farmLocation.longitude }
    },
    {
      farmer: f3._id,
      name: 'Ragi',
      category: 'Grains',
      quantity: 20000,
      unit: 'kg',
      totalQuantityKg: 20000,
      availableQuantityKg: 20000,
      allocatedQuantityKg: 0,
      collectedQuantityKg: 0,
      priceInr: 36,
      expectedPricePerQuintal: 3600,
      location: f3.farmLocation.address,
      village: f3.farmLocation.village,
      hobli: f3.farmLocation.hobli,
      taluk: f3.farmLocation.taluk,
      district: f3.farmLocation.district,
      state: f3.farmLocation.state,
      country: 'India',
      latitude: f3.farmLocation.latitude,
      longitude: f3.farmLocation.longitude,
      farmAddress: f3.farmLocation.address,
      grade: 'Grade B',
      qualityDescription: 'Commercial grade brown finger millet, clean quality',
      status: 'available',
      cropStatus: 'available',
      coordinates: { latitude: f3.farmLocation.latitude, longitude: f3.farmLocation.longitude }
    },
    {
      farmer: f3._id,
      name: 'Jowar',
      category: 'Grains',
      quantity: 18000,
      unit: 'kg',
      totalQuantityKg: 18000,
      availableQuantityKg: 18000,
      allocatedQuantityKg: 0,
      collectedQuantityKg: 0,
      priceInr: 40,
      expectedPricePerQuintal: 4000,
      location: f3.farmLocation.address,
      village: f3.farmLocation.village,
      hobli: f3.farmLocation.hobli,
      taluk: f3.farmLocation.taluk,
      district: f3.farmLocation.district,
      state: f3.farmLocation.state,
      country: 'India',
      latitude: f3.farmLocation.latitude,
      longitude: f3.farmLocation.longitude,
      farmAddress: f3.farmLocation.address,
      grade: 'Grade B',
      qualityDescription: 'Yellow sorghum grains, suitable for processing and bulk feed',
      status: 'available',
      cropStatus: 'available',
      coordinates: { latitude: f3.farmLocation.latitude, longitude: f3.farmLocation.longitude }
    }
  ];

  const seededCrops = await Crop.insertMany(cropsToInsert);
  console.log(`Seeded ${seededCrops.length} crops.`);

  // 4. Seed an Active Buyer Requirement with Automated Multi-Farm Allocation
  await BuyerRequirement.deleteMany({});
  await AggregationLot.deleteMany({});
  await FarmerPayment.deleteMany({});

  const ragiCrops = seededCrops.filter((c) => c.name === 'Ragi' && c.allocatedQuantityKg > 0);
  const reqId = generateRequirementId();

  const alloc1Id = generateAllocationId();
  const alloc2Id = generateAllocationId();

  const reqDoc = await BuyerRequirement.create({
    requirementId: reqId,
    buyer: b1._id,
    buyerName: b1.name,
    buyerEmail: b1.email,
    buyerCompany: b1.companyName,
    cropName: 'Ragi',
    requiredQuantityKg: 30000,
    allocatedQuantityKg: 30000,
    remainingQuantityKg: 0,
    collectedQuantityKg: 0,
    qcAcceptedQuantityKg: 0,
    requiredGrade: 'Grade A',
    qualitySpecifications: 'Export Grade finger millet with moisture below 12%',
    targetBudgetPricePerKg: 42,
    deliveryDestination: b1.deliveryAddress,
    requiredDeliveryDate: new Date(Date.now() + 7 * 86400000),
    requiredByDate: new Date(Date.now() + 7 * 86400000),
    status: 'collecting',
    allocations: [
      {
        allocationId: alloc1Id,
        farmer: f1._id,
        farmerName: f1.name,
        farmerPhone: f1.phone,
        farmerLocation: f1.farmLocation.address,
        farmerVillage: f1.farmLocation.village,
        farmerHobli: f1.farmLocation.hobli,
        farmerTaluk: f1.farmLocation.taluk,
        farmerDistrict: f1.farmLocation.district,
        farmerCoordinates: { latitude: f1.farmLocation.latitude, longitude: f1.farmLocation.longitude },
        crop: ragiCrops[0]._id,
        cropName: 'Ragi',
        grade: 'Grade A',
        allocatedQuantityKg: 15000,
        procurementPricePerKg: 38,
        farmerGrossPayable: 15000 * 38,
        collectionStatus: 'vehicle_assigned',
        allocatedAt: new Date()
      },
      {
        allocationId: alloc2Id,
        farmer: f2._id,
        farmerName: f2.name,
        farmerPhone: f2.phone,
        farmerLocation: f2.farmLocation.address,
        farmerVillage: f2.farmLocation.village,
        farmerHobli: f2.farmLocation.hobli,
        farmerTaluk: f2.farmLocation.taluk,
        farmerDistrict: f2.farmLocation.district,
        farmerCoordinates: { latitude: f2.farmLocation.latitude, longitude: f2.farmLocation.longitude },
        crop: ragiCrops[1]._id,
        cropName: 'Ragi',
        grade: 'Grade A',
        allocatedQuantityKg: 15000,
        procurementPricePerKg: 37,
        farmerGrossPayable: 15000 * 37,
        collectionStatus: 'vehicle_assigned',
        allocatedAt: new Date()
      }
    ],
    vehicle: {
      vehicleType: 'Large Container 40T',
      registrationNumber: 'KA-09-AG-7788',
      capacityKg: 40000,
      driverName: 'Ramesh Kumar',
      driverPhone: '+91 98765 43210',
      scheduledPickupDate: new Date(Date.now() + 86400000),
      currentStatus: 'vehicle_assigned',
      route: [
        `${f1.name} (${f1.farmLocation.village})`,
        `${f2.name} (${f2.farmLocation.village})`,
        `Buyer Facility: ${b1.deliveryAddress}`
      ],
      trackingNotes: 'Vehicle assigned for multi-farm aggregation route.',
      assignedAt: new Date()
    }
  });

  // Create linked Aggregation Lot
  const lot = await AggregationLot.create({
    lotId: `LOT-DEMO-01`,
    cropName: 'Ragi',
    category: 'Grains',
    grade: 'A',
    state: 'Karnataka',
    region: 'Bengaluru / Mandya',
    buyerRequirement: reqDoc._id,
    targetQuantityKg: 30000,
    totalQuantityKg: 30000,
    weightedAvgPricePerKg: 37.5,
    participatingFarmersCount: 2,
    containerType: 'Large Container 40T',
    containerCapacityKg: 40000,
    status: 'collected',
    autoAggregated: true
  });

  reqDoc.aggregationLot = lot._id;
  await reqDoc.save();

  // Create an initial completed payment for historical view
  await FarmerPayment.create({
    paymentId: generatePaymentId(),
    farmer: f1._id,
    farmerName: f1.name,
    cropName: 'Ragi',
    collectedQuantityKg: 5000,
    agreedPricePerKg: 38,
    grossAmountInr: 190000,
    deductionsInr: 0,
    finalPayableAmountInr: 190000,
    status: 'completed',
    paymentMethod: 'UPI',
    transactionRef: 'TXN-UPI-884129',
    paymentDate: new Date(Date.now() - 3 * 86400000),
    bankDetailsSnapshot: f1.bankAccount,
    notes: 'Settlement for previous Grade A Ragi batch completed.'
  });

  console.log('Automated Procurement Demo data successfully seeded!');
  await mongoose.disconnect();
}

seed().catch(console.error);
