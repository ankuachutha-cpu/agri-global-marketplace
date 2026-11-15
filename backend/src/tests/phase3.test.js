import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app, mongod, User, Crop, AggregationLot, CollectionRequest, n = 0;

beforeAll(async () => {
  process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'agri-phase3-'));
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = (await import('../app.js')).createApp();
  User = (await import('../models/User.js')).User;
  Crop = (await import('../models/Crop.js')).Crop;
  AggregationLot = (await import('../models/AggregationLot.js')).AggregationLot;
  CollectionRequest = (await import('../models/CollectionRequest.js')).CollectionRequest;
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
    CollectionRequest.deleteMany({})
  ]);
});

async function createFarmer() {
  n += 1;
  const res = await request(app).post('/api/auth/register').send({
    name: `Farmer ${n}`,
    email: `farmer${n}@test.agri`,
    password: 'Password123!',
    role: 'farmer',
    state: 'Karnataka',
    city: 'Kolar',
    phone: '9876543210'
  });

  const auth = { Authorization: `Bearer ${res.body.token}` };

  // Update farm location profile
  await request(app).patch('/api/auth/me').set(auth).send({
    latitude: 13.1378,
    longitude: 78.1291,
    farmAddress: 'Survey 42, Kolar Farm Road',
    district: 'Kolar',
    pincode: '563101'
  });

  return { auth, user: res.body.user };
}

describe('Phase 3 - Farmer Location and Quality Specs', () => {
  it('saves crop with GPS coordinates, farm address, and quality specifications', async () => {
    const farmer = await createFarmer();
    const cropRes = await request(app)
      .post('/api/crops')
      .set(farmer.auth)
      .send({
        name: 'Tomatoes',
        category: 'Vegetables',
        variety: 'Roma Hybrid',
        quantity: 500,
        unit: 'kg',
        priceInr: 30,
        state: 'Karnataka',
        location: 'Kolar',
        farmAddress: 'Green Valley Plot 4, Kolar',
        pincode: '563101',
        latitude: 13.1378,
        longitude: 78.1291,
        grade: 'A',
        moisturePercent: 12.5,
        grainOrFruitSize: 'Medium',
        color: 'Deep Red',
        organicCertified: true,
        packagingType: 'Crates',
        shelfLifeDays: 14,
        description: 'Naturally grown farm fresh tomatoes'
      });

    expect(cropRes.status).toBe(201);
    const crop = cropRes.body.crop;
    expect(crop.variety).toBe('Roma Hybrid');
    expect(crop.coordinates.latitude).toBe(13.1378);
    expect(crop.coordinates.longitude).toBe(78.1291);
    expect(crop.moisturePercent).toBe(12.5);
    expect(crop.organicCertified).toBe(true);
    expect(crop.shelfLifeDays).toBe(14);
  });
});

describe('Phase 3 - Collection Scheduling & Workflow', () => {
  it('allows farmer to schedule pickup and prevents duplicate requests', async () => {
    const farmer = await createFarmer();
    const cropRes = await request(app)
      .post('/api/crops')
      .set(farmer.auth)
      .send({
        name: 'Tomatoes',
        category: 'Vegetables',
        quantity: 400,
        unit: 'kg',
        priceInr: 25,
        state: 'Karnataka',
        location: 'Kolar',
        grade: 'A'
      });

    const cropId = cropRes.body.crop._id;

    // Schedule collection
    const scheduleRes = await request(app)
      .post('/api/collections/schedule')
      .set(farmer.auth)
      .send({
        cropId,
        scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        pickupAddress: 'Farmer Gate 1, Kolar',
        pickupContactPhone: '9876543210',
        notes: 'Call before dispatch'
      });

    expect(scheduleRes.status).toBe(201);
    const col = scheduleRes.body.collection;
    expect(col.collectionId).toMatch(/^COL-/);
    expect(col.status).toBe('scheduled');
    expect(col.estimatedQuantityKg).toBe(400);
    expect(col.unitPriceInr).toBe(25);
    expect(col.totalEstimatedPayoutInr).toBe(10000);

    // Duplicate scheduling attempt must be rejected
    const dupRes = await request(app)
      .post('/api/collections/schedule')
      .set(farmer.auth)
      .send({
        cropId,
        pickupAddress: 'Duplicate request'
      });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.message).toContain('already active');
  });

  it('progresses collection through inspection, acceptance, and payout', async () => {
    const farmer = await createFarmer();
    const cropRes = await request(app)
      .post('/api/crops')
      .set(farmer.auth)
      .send({
        name: 'Tomatoes',
        category: 'Vegetables',
        quantity: 1000,
        unit: 'kg',
        priceInr: 20,
        state: 'Karnataka',
        location: 'Kolar',
        grade: 'A'
      });

    const cropId = cropRes.body.crop._id;
    const scheduleRes = await request(app)
      .post('/api/collections/schedule')
      .set(farmer.auth)
      .send({ cropId });

    const colId = scheduleRes.body.collection._id;

    // 1. Dispatch vehicle
    const transitRes = await request(app)
      .patch(`/api/collections/${colId}/status`)
      .set(farmer.auth)
      .send({ status: 'in_transit', note: 'Truck KA-04-1234 dispatched' });
    expect(transitRes.body.collection.status).toBe('in_transit');

    // 2. Farm Inspection
    const inspectRes = await request(app)
      .patch(`/api/collections/${colId}/status`)
      .set(farmer.auth)
      .send({
        status: 'inspected_at_farm',
        inspection: {
          inspectorName: 'QC Inspector Ramesh',
          gradeAssigned: 'A',
          moisturePercent: 11.8,
          passed: true,
          notes: 'High quality firm tomatoes'
        }
      });
    expect(inspectRes.body.collection.status).toBe('inspected_at_farm');
    expect(inspectRes.body.collection.qualityInspection.moisturePercent).toBe(11.8);

    // 3. Accepted & Delivered to hub with QC verification
    const acceptRes = await request(app)
      .patch(`/api/collections/${colId}/status`)
      .set(farmer.auth)
      .send({
        status: 'accepted',
        acceptedQuantityKg: 980, // 20kg rejected during sorting
        centerName: 'Bangalore East Hub'
      });
    expect(acceptRes.body.collection.status).toBe('accepted');
    expect(acceptRes.body.collection.acceptedQuantityKg).toBe(980);
    expect(acceptRes.body.collection.rejectedQuantityKg).toBe(20);
    expect(acceptRes.body.collection.totalFinalPayoutInr).toBe(980 * 20); // 19,600 INR
    expect(acceptRes.body.collection.paymentStatus).toBe('processing');

    // 4. Disburse payout
    const payRes = await request(app)
      .patch(`/api/collections/${colId}/status`)
      .set(farmer.auth)
      .send({
        status: 'accepted',
        paymentStatus: 'paid',
        paymentReference: 'UPI-AGRI-8472910'
      });
    expect(payRes.body.collection.paymentStatus).toBe('paid');
    expect(payRes.body.collection.paymentReference).toBe('UPI-AGRI-8472910');

    // 5. Verify farmer summary
    const summaryRes = await request(app)
      .get('/api/collections/farmer')
      .set(farmer.auth);
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.totalCollectionsCount).toBe(1);
    expect(summaryRes.body.totalAcceptedKg).toBe(980);
    expect(summaryRes.body.receivedEarningsInr).toBe(19600);
    expect(summaryRes.body.pendingPayoutInr).toBe(0);
  });
});
