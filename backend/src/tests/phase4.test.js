import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app, mongod, User, Crop, AggregationLot, CollectionRequest, AuditLog, Company, n = 0;

beforeAll(async () => {
  process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'agri-phase4-'));
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = (await import('../app.js')).createApp();
  User = (await import('../models/User.js')).User;
  Crop = (await import('../models/Crop.js')).Crop;
  AggregationLot = (await import('../models/AggregationLot.js')).AggregationLot;
  CollectionRequest = (await import('../models/CollectionRequest.js')).CollectionRequest;
  AuditLog = (await import('../models/AuditLog.js')).AuditLog;
  Company = (await import('../models/Company.js')).Company;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Crop.deleteMany({}),
    AggregationLot.deleteMany({}),
    CollectionRequest.deleteMany({}),
    AuditLog.deleteMany({}),
    Company.deleteMany({})
  ]);
});

async function createAdmin() {
  n += 1;
  const bcrypt = (await import('bcryptjs')).default;
  const admin = await User.create({
    name: `Admin ${n}`,
    email: `admin${n}@agri.test`,
    passwordHash: await bcrypt.hash('Password123!', 4),
    role: 'admin',
    country: 'India'
  });
  const res = await request(app).post('/api/auth/login').send({
    email: `admin${n}@agri.test`,
    password: 'Password123!'
  });
  return { auth: { Authorization: `Bearer ${res.body.token}` }, user: admin };
}

async function createFarmer() {
  n += 1;
  const res = await request(app).post('/api/auth/register').send({
    name: `Farmer ${n}`,
    email: `farmer${n}@agri.test`,
    password: 'Password123!',
    role: 'farmer',
    state: 'Karnataka',
    city: 'Kolar',
    phone: '9876543210'
  });
  return { auth: { Authorization: `Bearer ${res.body.token}` }, user: res.body.user };
}

describe('Phase 4: Admin Aggregation Dashboard Backend', () => {
  it('blocks non-admin users from admin endpoints', async () => {
    const farmer = await createFarmer();
    const res = await request(app).get('/api/admin/overview-metrics').set(farmer.auth);
    expect(res.status).toBe(403);
  });

  it('retrieves comprehensive KPI overview metrics', async () => {
    const admin = await createAdmin();
    const farmer = await createFarmer();

    // Create a lot
    await AggregationLot.create({
      lotId: 'LOT-TEST-001',
      cropName: 'Tomatoes',
      category: 'Vegetables',
      grade: 'A',
      state: 'Karnataka',
      totalQuantityKg: 1500,
      targetQuantityKg: 1000,
      weightedAvgPricePerKg: 25,
      status: 'ready_for_inspection'
    });

    const res = await request(app).get('/api/admin/overview-metrics').set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.users.farmers).toBe(1);
    expect(res.body.users.admins).toBe(1);
    expect(res.body.aggregation.totalLots).toBe(1);
    expect(res.body.aggregation.totalAggregatedKg).toBe(1500);
    expect(res.body.aggregation.exportReadyLots).toBe(1);
  });

  it('manages aggregation lots: QC inspection, container allocation, buyer assignment, and audit logging', async () => {
    const admin = await createAdmin();
    const farmer = await createFarmer();

    const lot = await AggregationLot.create({
      lotId: 'LOT-TOM-A-01',
      cropName: 'Tomatoes',
      category: 'Vegetables',
      grade: 'A',
      state: 'Karnataka',
      totalQuantityKg: 2000,
      targetQuantityKg: 1000,
      weightedAvgPricePerKg: 30,
      status: 'ready_for_inspection'
    });

    // 1. Record QC Inspection
    const inspectRes = await request(app)
      .post(`/api/admin/aggregation/lots/${lot.lotId}/inspection`)
      .set(admin.auth)
      .send({
        inspectorName: 'Chief Inspector Verma',
        passed: true,
        gradeAssigned: 'A',
        moisturePercent: 11.2,
        notes: 'Premium grade tomatoes ready for reefer transport'
      });
    expect(inspectRes.status).toBe(200);
    expect(inspectRes.body.lot.status).toBe('inspected');
    expect(inspectRes.body.lot.inspectionReport.inspectorName).toBe('Chief Inspector Verma');

    // 2. Allocate Container & Shipping
    const containerRes = await request(app)
      .post(`/api/admin/aggregation/lots/${lot.lotId}/container`)
      .set(admin.auth)
      .send({
        containerType: '40ft High Cube Reefer',
        containerId: 'MSKU-887711-2',
        sealNumber: 'IN-BLR-44221',
        temperatureSetpoint: '+4°C',
        shippingLine: 'Maersk Line',
        portOfLoading: 'JNPT Mumbai',
        portOfDischarge: 'Jebel Ali Port, Dubai'
      });
    expect(containerRes.status).toBe(200);
    expect(containerRes.body.lot.containerId).toBe('MSKU-887711-2');
    expect(containerRes.body.lot.sealNumber).toBe('IN-BLR-44221');

    // 3. Assign International Buyer
    const buyerRes = await request(app)
      .post(`/api/admin/aggregation/lots/${lot.lotId}/buyer`)
      .set(admin.auth)
      .send({
        buyerName: 'Al-Madina Fresh LLC',
        destinationCountry: 'UAE',
        exportSalePricePerKg: 40, // 40 INR/kg
        platformCommissionPercent: 5 // 5% fee
      });
    expect(buyerRes.status).toBe(200);
    expect(buyerRes.body.lot.status).toBe('allocated_for_export');
    expect(buyerRes.body.lot.totalExportValueInr).toBe(80000); // 2000kg * 40
    expect(buyerRes.body.lot.platformCommissionInr).toBe(4000); // 5% of 80,000
    expect(buyerRes.body.lot.netFarmerDisbursalInr).toBe(76000);

    // 4. Update Shipment Status
    const shipRes = await request(app)
      .patch(`/api/admin/exports/${lot.lotId}/shipment-status`)
      .set(admin.auth)
      .send({
        shipmentStatus: 'in_transit_sea',
        notes: 'Vessel MSC Isabella departed JNPT Mumbai'
      });
    expect(shipRes.status).toBe(200);
    expect(shipRes.body.lot.shipmentStatus).toBe('in_transit_sea');
    expect(shipRes.body.lot.status).toBe('in_transit');

    // 5. Verify Audit Logs recorded
    const auditRes = await request(app)
      .get('/api/admin/audit-logs')
      .set(admin.auth);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.count).toBeGreaterThanOrEqual(4);
    const actions = auditRes.body.logs.map((l) => l.action);
    expect(actions).toContain('LOT_INSPECTED');
    expect(actions).toContain('CONTAINER_ALLOCATED');
    expect(actions).toContain('BUYER_ASSIGNED');
    expect(actions).toContain('SHIPMENT_STATUS_UPDATED');
  });

  it('manages collection centers and settles farmer payments', async () => {
    const admin = await createAdmin();
    const farmer = await createFarmer();

    const crop = await Crop.create({
      name: 'Tomatoes',
      category: 'Vegetables',
      quantity: 500,
      unit: 'kg',
      priceInr: 25,
      location: 'Kolar',
      state: 'Karnataka',
      farmer: farmer.user._id
    });

    const col = await CollectionRequest.create({
      collectionId: 'COL-TEST-999',
      farmer: farmer.user._id,
      crop: crop._id,
      cropName: 'Tomatoes',
      grade: 'A',
      scheduledDate: new Date(),
      pickupAddress: 'Farmer Gate, Kolar',
      estimatedQuantityKg: 500,
      unitPriceInr: 25,
      totalEstimatedPayoutInr: 12500,
      status: 'accepted',
      acceptedQuantityKg: 490,
      rejectedQuantityKg: 10,
      totalFinalPayoutInr: 12250,
      paymentStatus: 'processing'
    });

    // Settle farmer payment
    const settleRes = await request(app)
      .post(`/api/admin/financials/settle-farmer/${col.collectionId}`)
      .set(admin.auth)
      .send({
        paymentReference: 'UPI-AGRI-123456',
        notes: 'Bank transfer verified'
      });

    expect(settleRes.status).toBe(200);
    expect(settleRes.body.collection.paymentStatus).toBe('paid');
    expect(settleRes.body.collection.paymentReference).toBe('UPI-AGRI-123456');

    // Financials summary
    const finRes = await request(app)
      .get('/api/admin/financials/summary')
      .set(admin.auth);
    expect(finRes.status).toBe(200);
    expect(finRes.body.metrics.totalPaidFarmerInr).toBe(12250);
    expect(finRes.body.recentSettlements.length).toBe(1);
  });
});
