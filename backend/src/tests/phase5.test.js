import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app, mongod, User, Crop, AggregationLot, Order, Rfq, n = 0;

beforeAll(async () => {
  process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'agri-phase5-'));
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = (await import('../app.js')).createApp();
  User = (await import('../models/User.js')).User;
  Crop = (await import('../models/Crop.js')).Crop;
  AggregationLot = (await import('../models/AggregationLot.js')).AggregationLot;
  Order = (await import('../models/Order.js')).Order;
  Rfq = (await import('../models/Rfq.js')).Rfq;
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
    Order.deleteMany({}),
    Rfq.deleteMany({})
  ]);
});

async function createBuyer() {
  n += 1;
  const res = await request(app).post('/api/auth/register').send({
    name: `Buyer ${n}`,
    email: `buyer${n}@global.test`,
    password: 'Password123!',
    role: 'buyer',
    country: 'UAE',
    currency: 'USD'
  });
  return { auth: { Authorization: `Bearer ${res.body.token}` }, user: res.body.user };
}

async function createFarmer() {
  n += 1;
  const res = await request(app).post('/api/auth/register').send({
    name: `Farmer ${n}`,
    email: `farmer${n}@agri.test`,
    password: 'Password123!',
    role: 'farmer',
    country: 'India',
    state: 'Karnataka',
    city: 'Kolar',
    phone: '9876543210'
  });
  return { auth: { Authorization: `Bearer ${res.body.token}` }, user: res.body.user };
}

describe('Phase 5: International Buyer Portal & Global Marketplace', () => {
  it('allows international buyers to verify company credentials', async () => {
    const buyer = await createBuyer();

    const verifyRes = await request(app)
      .post('/api/buyer/verify-company')
      .set(buyer.auth)
      .send({
        companyName: 'Al-Khaleej Food Distribution LLC',
        buyerType: 'importer',
        businessRegistrationNumber: 'TRN-1002938471',
        importLicenseNumber: 'DXB-IMP-84920',
        targetCrops: ['tomatoes', 'mango', 'grapes'],
        verificationEvidence: 'Dubai Chamber of Commerce License #849210'
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.user.verificationStatus).toBe('verified');
    expect(verifyRes.body.user.companyName).toBe('Al-Khaleej Food Distribution LLC');
  });

  it('manages buyer watchlist for crops and bulk lots', async () => {
    const buyer = await createBuyer();
    const farmer = await createFarmer();

    const crop = await Crop.create({
      name: 'Pomegranate',
      category: 'Fruits',
      quantity: 1000,
      unit: 'kg',
      priceInr: 90,
      location: 'Solapur',
      state: 'Maharashtra',
      farmer: farmer.user._id
    });

    const lot = await AggregationLot.create({
      lotId: 'LOT-POM-001',
      cropName: 'Pomegranate',
      category: 'Fruits',
      grade: 'A',
      state: 'Maharashtra',
      totalQuantityKg: 5000,
      targetQuantityKg: 5000,
      weightedAvgPricePerKg: 85,
      status: 'ready_for_inspection'
    });

    // Add crop to watchlist
    const addCropRes = await request(app)
      .post('/api/buyer/watchlist')
      .set(buyer.auth)
      .send({ cropId: crop._id });
    expect(addCropRes.status).toBe(201);

    // Add lot to watchlist
    const addLotRes = await request(app)
      .post('/api/buyer/watchlist')
      .set(buyer.auth)
      .send({ lotId: lot._id });
    expect(addLotRes.status).toBe(201);

    // Get watchlist
    const getRes = await request(app)
      .get('/api/buyer/watchlist')
      .set(buyer.auth);
    expect(getRes.status).toBe(200);
    expect(getRes.body.count).toBe(2);

    // Remove item
    const delRes = await request(app)
      .delete(`/api/buyer/watchlist/${crop._id}`)
      .set(buyer.auth);
    expect(delRes.status).toBe(200);
    expect(delRes.body.watchlist.length).toBe(1);
  });

  it('full RFQ lifecycle: post RFQ, submit quote, accept, and convert to Purchase Order with Commercial Invoice', async () => {
    const buyer = await createBuyer();
    const farmer = await createFarmer();

    // 1. Buyer posts RFQ
    const rfqRes = await request(app)
      .post('/api/rfqs')
      .set(buyer.auth)
      .send({
        cropName: 'Tomatoes',
        category: 'Vegetables',
        quantity: 5000,
        unit: 'kg',
        grade: 'A',
        targetPriceInr: 35,
        currency: 'USD',
        deliveryDestination: 'Jebel Ali Port, Dubai',
        deliveryTerms: 'CIF',
        requiredByDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        qualitySpecifications: 'Firm red tomatoes, 55-65mm diameter, export reefer packaging'
      });

    expect(rfqRes.status).toBe(201);
    const rfq = rfqRes.body.rfq;
    expect(rfq.rfqNumber).toMatch(/^RFQ-/);
    expect(rfq.status).toBe('open');

    // 2. Supplier quotes on the RFQ
    const quoteRes = await request(app)
      .post(`/api/rfqs/${rfq.rfqNumber}/quotes`)
      .set(farmer.auth)
      .send({
        offeredQuantityKg: 5000,
        unitPriceInr: 32,
        freightAndInsuranceInr: 15000,
        leadTimeDays: 10,
        notes: 'Can supply Grade A Roma Hybrid from Kolar harvest'
      });

    expect(quoteRes.status).toBe(201);
    const quoteId = quoteRes.body.quote.quoteId;
    expect(quoteRes.body.quote.totalPriceInr).toBe(5000 * 32 + 15000); // 175,000 INR

    // 3. Buyer accepts the quote
    const acceptRes = await request(app)
      .patch(`/api/rfqs/${rfq.rfqNumber}/quotes/${quoteId}`)
      .set(buyer.auth)
      .send({ action: 'accept' });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.rfq.status).toBe('accepted');
    expect(acceptRes.body.rfq.acceptedQuoteId).toBe(quoteId);

    // 4. Convert accepted RFQ to confirmed Purchase Order & Commercial Invoice
    const poRes = await request(app)
      .post(`/api/rfqs/${rfq.rfqNumber}/convert-to-order`)
      .set(buyer.auth);

    expect(poRes.status).toBe(201);
    expect(poRes.body.invoiceNumber).toMatch(/^INV-/);
    expect(poRes.body.order.status).toBe('Confirmed');
    expect(poRes.body.order.totalInr).toBe(175000);
    expect(poRes.body.order.destinationPort).toBe('Jebel Ali Port, Dubai');

    // 5. Verify Buyer Dashboard aggregates RFQs, Invoices, and Purchase Orders
    const dashRes = await request(app)
      .get('/api/buyer/dashboard')
      .set(buyer.auth);

    expect(dashRes.status).toBe(200);
    expect(dashRes.body.metrics.totalRfqs).toBe(1);
    expect(dashRes.body.metrics.totalOrders).toBe(1);
    expect(dashRes.body.metrics.invoicesCount).toBe(1);
    expect(dashRes.body.metrics.totalPurchaseOrdersValueInr).toBe(175000);
  });
});
