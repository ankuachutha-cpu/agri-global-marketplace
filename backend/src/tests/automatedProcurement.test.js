import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../app.js';
import { User } from '../models/User.js';
import { Crop } from '../models/Crop.js';
import { BuyerRequirement } from '../models/BuyerRequirement.js';
import { FarmerPayment } from '../models/FarmerPayment.js';
import { PriceConfiguration } from '../models/PriceConfiguration.js';
import { signToken } from '../middleware/auth.js';

const TEST_DB = 'mongodb://127.0.0.1:27017/agri_test_automated_procurement_suite';

describe('Automated Agricultural Procurement, Collection & Aggregation Engine Suite', () => {
  let app;
  let farmer1Token, farmer2Token, buyerToken, adminToken;
  let farmer1User, farmer2User, buyerUser, adminUser;
  let crop1, crop2;

  beforeAll(async () => {
    await mongoose.connect(TEST_DB);
    app = createApp();

    // Clean test collections
    await User.deleteMany({});
    await Crop.deleteMany({});
    await BuyerRequirement.deleteMany({});
    await FarmerPayment.deleteMany({});
    await PriceConfiguration.deleteMany({});

    // Create test users
    adminUser = await User.create({
      name: 'Operations Admin',
      email: 'admin_test@procure.agri',
      passwordHash: 'hash123',
      role: 'admin'
    });
    adminToken = signToken(adminUser);

    farmer1User = await User.create({
      name: 'Ramesh Gowda',
      email: 'ramesh_farmer@procure.agri',
      passwordHash: 'hash123',
      role: 'farmer',
      phone: '+91 94481 12345',
      farmLocation: {
        address: 'Survey 101, Mandya, Karnataka',
        village: 'Dudda',
        district: 'Mandya',
        state: 'Karnataka',
        latitude: 12.5234,
        longitude: 76.8971
      },
      bankAccount: {
        accountHolderName: 'Ramesh Gowda',
        accountNumber: '1122334455',
        ifscCode: 'SBIN0001',
        bankName: 'SBI',
        upiId: 'ramesh@upi'
      }
    });
    farmer1Token = signToken(farmer1User);

    farmer2User = await User.create({
      name: 'Suresh Patel',
      email: 'suresh_farmer@procure.agri',
      passwordHash: 'hash123',
      role: 'farmer',
      phone: '+91 94482 67890',
      farmLocation: {
        address: 'Survey 202, Mysuru, Karnataka',
        village: 'Hullahalli',
        district: 'Mysuru',
        state: 'Karnataka',
        latitude: 12.1184,
        longitude: 76.6812
      },
      bankAccount: {
        accountHolderName: 'Suresh Patel',
        accountNumber: '9988776655',
        ifscCode: 'HDFC0001',
        bankName: 'HDFC',
        upiId: 'suresh@upi'
      }
    });
    farmer2Token = signToken(farmer2User);

    buyerUser = await User.create({
      name: 'Global Food Importers',
      email: 'buyer_test@procure.agri',
      passwordHash: 'hash123',
      role: 'buyer',
      companyName: 'Global Food Importers Ltd',
      gstin: '29AABCG1234Z1',
      deliveryAddress: 'APMC Hub, Yeshwanthpur, Bengaluru'
    });
    buyerToken = signToken(buyerUser);

    // Seed price configuration
    await PriceConfiguration.create([
      { cropName: 'Ragi', mandiReferencePricePerKg: 35, defaultFarmerProcurementPricePerKg: 38, buyerProcurementRatePerKg: 42 },
      { cropName: 'Rice', mandiReferencePricePerKg: 44, defaultFarmerProcurementPricePerKg: 48, buyerProcurementRatePerKg: 54 },
      { cropName: 'Jowar', mandiReferencePricePerKg: 38, defaultFarmerProcurementPricePerKg: 40, buyerProcurementRatePerKg: 45 }
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('1. Farmer uploads Ragi produce with quantity in Quintals and GPS location', async () => {
    const res = await request(app)
      .post('/api/farmer/crops')
      .set('Authorization', `Bearer ${farmer1Token}`)
      .send({
        name: 'Ragi',
        quantity: 200, // 200 quintals = 20,000 kg
        unit: 'quintal',
        expectedPricePerQuintal: 3800,
        grade: 'Grade A',
        village: 'Dudda Village',
        taluk: 'Mandya Taluk',
        district: 'Mandya',
        state: 'Karnataka',
        coordinates: { latitude: 12.5234, longitude: 76.8971 }
      });

    expect(res.status).toBe(201);
    expect(res.body.crop).toBeDefined();
    expect(res.body.crop.totalQuantityKg).toBe(20000);
    expect(res.body.crop.availableQuantityKg).toBe(20000);
    expect(res.body.crop.priceInr).toBe(38);
    crop1 = res.body.crop;
  });

  it('2. Rejects invalid crop names (enforces strictly Ragi, Rice, Jowar)', async () => {
    const res = await request(app)
      .post('/api/farmer/crops')
      .set('Authorization', `Bearer ${farmer1Token}`)
      .send({
        name: 'Wheat',
        quantity: 50,
        unit: 'quintal'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Allowed crops are strictly: Ragi, Rice, Jowar');
  });

  it('3. Farmer 2 uploads Ragi produce with quantity in Tonnes', async () => {
    const res = await request(app)
      .post('/api/farmer/crops')
      .set('Authorization', `Bearer ${farmer2Token}`)
      .send({
        name: 'Ragi',
        quantity: 15, // 15 tonnes = 15,000 kg
        unit: 'tonne',
        expectedPricePerQuintal: 3700,
        grade: 'Grade A',
        village: 'Hullahalli',
        district: 'Mysuru',
        coordinates: { latitude: 12.1184, longitude: 76.6812 }
      });

    expect(res.status).toBe(201);
    expect(res.body.crop.totalQuantityKg).toBe(15000);
    expect(res.body.crop.availableQuantityKg).toBe(15000);
    crop2 = res.body.crop;
  });

  let createdRequirement;

  it('4. Buyer creates bulk requirement for 25,000 kg of Ragi -> Automatically matches 2 farmers with ZERO farmer accept/reject', async () => {
    const res = await request(app)
      .post('/api/buyer/requirements')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        cropName: 'Ragi',
        quantity: 25000,
        unit: 'kg',
        requiredGrade: 'Grade A',
        targetBudgetPricePerKg: 40,
        deliveryDestination: 'Bengaluru Distribution Warehouse'
      });

    expect(res.status).toBe(201);
    const reqDoc = res.body.requirement;
    expect(reqDoc.requiredQuantityKg).toBe(25000);
    expect(reqDoc.allocatedQuantityKg).toBe(25000);
    expect(reqDoc.status).toBe('allocated');
    expect(reqDoc.allocations.length).toBe(2);

    // Check that neither allocation requires acceptance
    for (const alloc of reqDoc.allocations) {
      expect(alloc.collectionStatus).toBe('scheduled');
      expect(alloc.farmerGrossPayable).toBeGreaterThan(0);
    }

    // Verify atomic deduction from crops in DB
    const updatedCrop1 = await Crop.findById(crop1._id);
    const updatedCrop2 = await Crop.findById(crop2._id);
    expect(updatedCrop1.availableQuantityKg + updatedCrop2.availableQuantityKg).toBe(10000); // 35,000 - 25,000 = 10,000 kg remaining
    expect(updatedCrop1.allocatedQuantityKg + updatedCrop2.allocatedQuantityKg).toBe(25000);

    createdRequirement = reqDoc;
  });

  it('5. Vehicle capacity check: Rejects assigning vehicle when total weight exceeds capacity', async () => {
    const res = await request(app)
      .post(`/api/admin-portal/requirements/${createdRequirement._id}/assign-vehicle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vehicleType: 'Small Truck 3T',
        registrationNumber: 'KA-05-AB-1122',
        capacityKg: 3000, // 3,000 kg is too small for 25,000 kg!
        driverName: 'Kiran',
        driverPhone: '+91 99000 11223'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Capacity exceeded');
  });

  it('6. Successfully assigns vehicle with sufficient capacity (30T capacity for 25T load)', async () => {
    const res = await request(app)
      .post(`/api/admin-portal/requirements/${createdRequirement._id}/assign-vehicle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vehicleType: 'Heavy Truck 25T',
        registrationNumber: 'KA-09-AG-9988',
        capacityKg: 30000,
        driverName: 'Ravi Kumar',
        driverPhone: '+91 98765 43210'
      });

    expect(res.status).toBe(200);
    expect(res.body.requirement.vehicle.currentStatus).toBe('vehicle_assigned');
    expect(res.body.requirement.status).toBe('collecting');
    expect(res.body.requirement.vehicle.route.length).toBeGreaterThanOrEqual(2);
  });

  it('7. Progressive fleet status transition: Advances from vehicle_assigned to on_the_way and arrived', async () => {
    const step1 = await request(app)
      .patch(`/api/admin-portal/requirements/${createdRequirement._id}/vehicle-status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'on_the_way', trackingNotes: 'Truck dispatched from depot towards Farm 1' });
    expect(step1.status).toBe(200);
    expect(step1.body.requirement.vehicle.currentStatus).toBe('on_the_way');

    const step2 = await request(app)
      .patch(`/api/admin-portal/requirements/${createdRequirement._id}/vehicle-status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'arrived', trackingNotes: 'Truck arrived at Ramesh Gowda farm' });
    expect(step2.status).toBe(200);
    expect(step2.body.requirement.vehicle.currentStatus).toBe('arrived');
  });

  it('8. Farm weighing and QC recording: Weighs farm produce, deducts from farmer inventory, generates FarmerPayment record', async () => {
    const reqItem = await BuyerRequirement.findById(createdRequirement._id);
    const alloc1 = reqItem.allocations[0];

    const res = await request(app)
      .post(`/api/admin-portal/requirements/${createdRequirement._id}/collect`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        allocationId: alloc1.allocationId,
        actualWeighedKg: alloc1.allocatedQuantityKg,
        acceptedQuantityKg: alloc1.allocatedQuantityKg - 200, // 200 kg rejected
        rejectedQuantityKg: 200,
        qcGrade: 'Grade A',
        collectionNotes: 'Electronic scale weighed. 200 kg broken grains rejected and returned to farmer stock.',
        weightSlipImage: 'https://cdn.agriglobal.test/slips/slip-01.jpg'
      });

    expect(res.status).toBe(200);
    expect(res.body.allocation.collectionStatus).toBe('collected');
    expect(res.body.allocation.acceptedQuantityKg).toBe(alloc1.allocatedQuantityKg - 200);

    // Verify FarmerPayment record was generated automatically
    const payment = await FarmerPayment.findOne({ allocationId: alloc1.allocationId });
    expect(payment).toBeDefined();
    expect(payment.collectedQuantityKg).toBe(alloc1.allocatedQuantityKg - 200);
    expect(payment.finalPayableAmountInr).toBe((alloc1.allocatedQuantityKg - 200) * alloc1.procurementPricePerKg);
    expect(payment.status).toBe('pending');
  });

  it('9. Buyer confirms delivery receipt -> Order completed and farmer payments advance to processing', async () => {
    const res = await request(app)
      .post(`/api/buyer/requirements/${createdRequirement._id}/confirm-delivery`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        receivedQuantityKg: 24800,
        buyerInspectionNotes: 'Seal intact, 24,800 kg accepted at warehouse dock.'
      });

    expect(res.status).toBe(200);
    expect(res.body.requirement.status).toBe('completed');
    expect(res.body.requirement.delivery.confirmedByBuyer).toBe(true);

    // Verify payment status updated to processing
    const payment = await FarmerPayment.findOne({ requirementId: createdRequirement.requirementId });
    expect(payment.status).toBe('processing');
    expect(payment.transactionRef).toContain('TXN-');
  });

  it('10. Admin releases payment -> Payment status updated to completed', async () => {
    const payment = await FarmerPayment.findOne({ requirementId: createdRequirement.requirementId });
    const res = await request(app)
      .post(`/api/admin-portal/payments/${payment._id}/release`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe('completed');
  });

  it('11. Farmer Portal Dashboard returns updated live metrics and earnings', async () => {
    const res = await request(app)
      .get('/api/farmer/dashboard')
      .set('Authorization', `Bearer ${farmer1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.metrics.totalEarningsInr).toBeGreaterThan(0);
    expect(res.body.cropBreakdown.Ragi).toBeDefined();
  });

  it('12. Admin Portal Dashboard returns full platform metrics and crop breakdowns', async () => {
    const res = await request(app)
      .get('/api/admin-portal/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.metrics.totalFarmers).toBeGreaterThanOrEqual(2);
    expect(res.body.metrics.totalBuyers).toBeGreaterThanOrEqual(1);
    expect(res.body.cropBreakdown.Ragi.totalKg).toBeGreaterThan(0);
  });
});
