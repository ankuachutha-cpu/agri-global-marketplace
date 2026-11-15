import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { User } from '../models/User.js';
import { Crop } from '../models/Crop.js';
import { Company } from '../models/Company.js';
import { Rfq } from '../models/Rfq.js';
import { AggregationLot } from '../models/AggregationLot.js';
import { Shipment } from '../models/Shipment.js';
import { Settlement } from '../models/Settlement.js';
import { Notification } from '../models/Notification.js';
import { signToken } from '../middleware/auth.js';
import { notify, notifyOrderEvent, notifyPaymentEvent, notifyShipmentEvent, notifyCollectionEvent } from '../services/notify.js';

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'test-secret-key-12345';
  process.env.NODE_ENV = 'test';
  await mongoose.connect(mongod.getUri());
  app = createApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

async function createAuthUser(role = 'farmer', name = 'Test User', email = `user-${Date.now()}-${Math.random()}@test.com`) {
  const user = await User.create({
    name,
    email,
    passwordHash: 'hashed_password_placeholder',
    role,
    country: role === 'buyer' ? 'UAE' : 'India',
    currency: role === 'buyer' ? 'AED' : 'INR',
    phone: '+919876543210'
  });
  const res = await request(app).post('/api/auth/login').send({
    email,
    password: 'password123'
  });
  // Generate valid test JWT token using signToken
  const token = signToken(user);
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
}

describe('Phase 8: AI Intelligence, Business Analytics & Multi-Channel Notifications', () => {
  it('AI Intelligence: predicts international crop demand with seasonality, confidence, and explainability', async () => {
    const farmer = await createAuthUser('farmer', 'Farmer Ramesh', 'farmer.ramesh@test.com');

    const res = await request(app)
      .post('/api/ai/demand-forecast')
      .set(farmer.auth)
      .send({
        crop: 'Basmati Rice',
        targetCountry: 'United Arab Emirates',
        targetMonth: 11
      });

    expect(res.status).toBe(200);
    expect(res.body.crop).toBe('Basmati Rice');
    expect(res.body.demandIndex).toBeGreaterThanOrEqual(70);
    expect(res.body.confidenceScore).toBeGreaterThanOrEqual(0.8);
    expect(res.body.projectedPriceUsdPerMt).toBeGreaterThan(0);
    expect(Array.isArray(res.body.factors)).toBe(true);
    expect(res.body.factors.length).toBeGreaterThanOrEqual(3);
    expect(res.body.methodology).toContain('Bayesian');
  });

  it('AI Intelligence: recommends export destinations with tariffs (CEPA/FTAs), transit times, and margins', async () => {
    const buyer = await createAuthUser('buyer', 'Dubai Importer', 'buyer.dubai@test.com');

    const res = await request(app)
      .post('/api/ai/destination-recommendations')
      .set(buyer.auth)
      .send({
        crop: 'Mango',
        grade: 'A',
        volumeKg: 24000
      });

    expect(res.status).toBe(200);
    expect(res.body.evaluatedGrade).toBe('A');
    expect(Array.isArray(res.body.recommendations)).toBe(true);
    expect(res.body.recommendations.length).toBeGreaterThanOrEqual(3);

    const topDest = res.body.recommendations[0];
    expect(topDest.country).toBeTruthy();
    expect(topDest.tariffBenefit).toBeTruthy();
    expect(topDest.estimatedTransitDays).toBeGreaterThan(0);
    expect(topDest.targetPriceUsdPerMt).toBeGreaterThan(0);
    expect(topDest.confidenceScore).toBeGreaterThanOrEqual(0.8);
  });

  it('AI Intelligence: executes smart matching pairing crops with verified buyers and active RFQs', async () => {
    const farmer = await createAuthUser('farmer', 'Farmer Suresh', 'farmer.suresh@test.com');

    // Create a verified company
    await Company.create({
      name: 'Gulf Fresh Fruits LLC',
      country: 'United Arab Emirates',
      type: 'international_importer',
      buyerType: 'importer',
      productsHandled: ['mango', 'grapes', 'fresh vegetables'],
      verificationStatus: 'verified',
      sourceUrl: 'https://gulffresh.example.com',
      verifiedAt: new Date()
    });

    const res = await request(app)
      .post('/api/ai/smart-matching')
      .set(farmer.auth)
      .send({
        cropName: 'Mango',
        quantityKg: 5000,
        targetCountry: 'United Arab Emirates'
      });

    expect(res.status).toBe(200);
    expect(res.body.totalMatchesFound).toBeGreaterThanOrEqual(1);
    const firstMatch = res.body.topMatches[0];
    expect(firstMatch.matchScore).toBeGreaterThanOrEqual(60);
    expect(firstMatch.confidenceScore).toBeGreaterThan(0);
    expect(Array.isArray(firstMatch.compatibilityFactors)).toBe(true);
    expect(firstMatch.recommendedAction).toBeTruthy();
  });

  it('AI Intelligence: analyzes crop quality parameters to assign export grade (A, B, C, Reject) with confidence', async () => {
    const farmer = await createAuthUser('farmer', 'Farmer Anita', 'farmer.anita@test.com');

    // Test Grade A Crop
    const gradeARes = await request(app)
      .post('/api/ai/quality-analysis')
      .set(farmer.auth)
      .send({
        cropName: 'Basmati Rice',
        moisturePercent: 12.8,
        defectPercent: 1.2,
        sizeUniformityPercent: 94.0,
        foreignMatterPercent: 0.1,
        colorScore: 92
      });

    expect(gradeARes.status).toBe(200);
    expect(gradeARes.body.gradeCode).toBe('A');
    expect(gradeARes.body.exportEligibility).toBe(true);
    expect(gradeARes.body.pricePremiumDiscountPercent).toBe(15);
    expect(gradeARes.body.confidenceScore).toBeGreaterThanOrEqual(0.9);

    // Test Non-compliant / Rejected Produce
    const rejectRes = await request(app)
      .post('/api/ai/quality-analysis')
      .set(farmer.auth)
      .send({
        cropName: 'Basmati Rice',
        moisturePercent: 19.5,
        defectPercent: 12.0,
        sizeUniformityPercent: 55.0,
        foreignMatterPercent: 2.5,
        colorScore: 40
      });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.gradeCode).toBe('Reject');
    expect(rejectRes.body.exportEligibility).toBe(false);
  });

  it('Business Analytics: provides admin BI metrics, supply/demand, country trends, and downloadable reports', async () => {
    const admin = await createAuthUser('admin', 'Super Admin', 'admin.bi@test.com');
    const farmer = await createAuthUser('farmer', 'Farmer Vijay', 'farmer.vijay@test.com');

    // Seed test aggregation lot and settlement
    await AggregationLot.create({
      lotId: 'LOT-TEST-P8',
      lotNumber: 'LOT-TEST-P8',
      cropName: 'Table Grapes',
      category: 'Fruits',
      grade: 'A',
      state: 'Maharashtra',
      targetCountry: 'Netherlands',
      status: 'allocated_for_export',
      totalQuantityKg: 20000,
      targetQuantityKg: 20000,
      weightedAvgPricePerKg: 140,
      totalExportValueInr: 2800000,
      platformCommissionInr: 140000
    });

    await Settlement.create({
      settlementId: 'SET-TEST-P8',
      farmer: farmer.user._id,
      farmerName: 'Farmer Vijay',
      cropName: 'Table Grapes',
      acceptedQuantityKg: 10000,
      ratePerKg: 140,
      grossPayableInr: 1400000,
      platformCommissionInr: 70000,
      netPayoutInr: 1330000,
      paymentMethod: 'NEFT',
      transactionReference: 'NEFT987654321',
      idempotencyKey: 'IDEMP-SET-TEST-P8',
      status: 'completed'
    });

    // Admin Analytics endpoint
    const adminRes = await request(app)
      .get('/api/analytics/admin')
      .set(admin.auth);

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.overview.totalAggregatedVolumeKg).toBeGreaterThanOrEqual(20000);
    expect(adminRes.body.overview.grossExportValueInr).toBeGreaterThan(0);
    expect(adminRes.body.overview.platformCommissionInr).toBeGreaterThan(0);
    expect(Array.isArray(adminRes.body.countryTrends)).toBe(true);
    expect(Array.isArray(adminRes.body.supplyVsDemand)).toBe(true);
    expect(Array.isArray(adminRes.body.monthlyTrends)).toBe(true);

    // Non-admin blocked from admin analytics
    const forbiddenRes = await request(app)
      .get('/api/analytics/admin')
      .set(farmer.auth);
    expect(forbiddenRes.status).toBe(403);

    // Download CSV report
    const downloadRes = await request(app)
      .get('/api/analytics/download-report?format=csv&type=admin')
      .set(admin.auth);

    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers['content-type']).toContain('text/csv');
    expect(downloadRes.text).toContain('--- AGGREGATION LOTS ---');
    expect(downloadRes.text).toContain('LOT-TEST-P8');
    expect(downloadRes.text).toContain('--- SETTLEMENTS & PAYOUTS ---');
  });

  it('Exporter Performance Analytics: provides on-time delivery rate, cold chain compliance, and port distribution', async () => {
    const admin = await createAuthUser('admin', 'Exporter Admin', 'admin.exporter@test.com');
    const res = await request(app)
      .get('/api/analytics/exporter')
      .set(admin.auth);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeTruthy();
    expect(typeof res.body.summary.onTimeDeliveryRate).toBe('number');
    expect(typeof res.body.summary.coldChainCompliancePercent).toBe('number');
    expect(Array.isArray(res.body.shippingLineDistribution)).toBe(true);
    expect(Array.isArray(res.body.destinationPortDistribution)).toBe(true);
  });

  it('Multi-Channel Notifications: records multi-channel dispatch (In-App, Email, SMS) with event tracking', async () => {
    const farmer = await createAuthUser('farmer', 'Farmer Manoj', 'farmer.manoj@test.com');

    // Test notify with multi-channel options
    const notif = await notify(
      farmer.user,
      'order_confirmed',
      'Your order for 5000 kg Alphonso Mangoes is confirmed by Dubai Importer',
      '/orders',
      {
        channels: ['in_app', 'email', 'sms'],
        emailSubject: 'Order Confirmation #ORD-1099',
        severity: 'success',
        metadata: { orderId: 'ORD-1099' }
      }
    );

    expect(notif).toBeTruthy();
    expect(notif.channels).toEqual(expect.arrayContaining(['in_app', 'email', 'sms']));
    expect(notif.emailStatus).toBe('simulated');
    expect(notif.smsStatus).toBe('simulated');
    expect(notif.recipientEmail).toBe('farmer.manoj@test.com');
    expect(notif.recipientPhone).toBe('+919876543210');
    expect(notif.severity).toBe('success');

    // Retrieve via user notifications API
    const listRes = await request(app)
      .get('/api/notifications')
      .set(farmer.auth);

    expect(listRes.status).toBe(200);
    expect(listRes.body.items.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body.items[0].message).toContain('Alphonso Mangoes');

    // Mark all as read
    const readRes = await request(app)
      .post('/api/notifications/read-all')
      .set(farmer.auth);
    expect(readRes.status).toBe(200);

    const checkRes = await request(app)
      .get('/api/notifications')
      .set(farmer.auth);
    expect(checkRes.body.unread).toBe(0);
  });

  it('Production & Security: verifies system health check endpoint and database status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
    expect(res.body.service).toBe('agri-global-marketplace-api');
    expect(['2.8.0', '2.9.0']).toContain(res.body.version);
    expect(typeof res.body.uptimeSeconds).toBe('number');
  });
});
