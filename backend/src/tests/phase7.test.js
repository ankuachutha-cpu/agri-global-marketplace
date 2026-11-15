import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app, mongod, User, Crop, AggregationLot, Order, Payment, Settlement, CollectionRequest, n = 0;

beforeAll(async () => {
  process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'agri-phase7-'));
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = (await import('../app.js')).createApp();
  User = (await import('../models/User.js')).User;
  Crop = (await import('../models/Crop.js')).Crop;
  AggregationLot = (await import('../models/AggregationLot.js')).AggregationLot;
  Order = (await import('../models/Order.js')).Order;
  Payment = (await import('../models/Payment.js')).Payment;
  Settlement = (await import('../models/Settlement.js')).Settlement;
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
    Order.deleteMany({}),
    Payment.deleteMany({}),
    Settlement.deleteMany({}),
    CollectionRequest.deleteMany({})
  ]);
});

async function createBuyer() {
  n += 1;
  const res = await request(app).post('/api/auth/register').send({
    name: `Buyer Corp ${n}`,
    email: `buyer${n}@tradecorp.test`,
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
    name: `Farmer Kisan ${n}`,
    email: `kisan${n}@bharatfarm.test`,
    password: 'Password123!',
    role: 'farmer',
    country: 'India',
    currency: 'INR'
  });
  return { auth: { Authorization: `Bearer ${res.body.token}` }, user: res.body.user };
}

async function createAdmin() {
  const bcrypt = (await import('bcryptjs')).default;
  n += 1;
  const u = await User.create({
    name: `Treasury Admin ${n}`,
    email: `treasury${n}@platform.test`,
    role: 'admin',
    passwordHash: await bcrypt.hash('Password123!', 4)
  });
  const res = await request(app).post('/api/auth/login').send({
    email: `treasury${n}@platform.test`,
    password: 'Password123!'
  });
  return { auth: { Authorization: `Bearer ${res.body.token}` }, user: u };
}

describe('Phase 7: Payment Gateway & Financial Settlement Backend', () => {
  it('exposes public payment config without leaking secrets and calculates 5% commission', async () => {
    const configRes = await request(app).get('/api/payments/config');
    expect(configRes.status).toBe(200);
    expect(configRes.body.razorpayKeyId).toBeDefined();
    expect(configRes.body.platformCommissionPercent).toBe(5);
    expect(configRes.body.razorpayKeySecret).toBeUndefined();

    // Create an order payment
    const buyer = await createBuyer();
    const farmer = await createFarmer();

    const order = await Order.create({
      buyer: buyer.user._id,
      farmer: farmer.user._id,
      crop: new mongoose.Types.ObjectId(),
      cropName: 'Organic Turmeric',
      quantity: 1000,
      unit: 'kg',
      unitPriceInr: 100,
      totalInr: 100000,
      invoiceNumber: 'INV-2611-8899',
      idempotencyKey: 'TEST-ORDER-PAY-01'
    });

    const createOrderRes = await request(app)
      .post('/api/payments/create-order')
      .set(buyer.auth)
      .send({
        orderId: order._id,
        amount: 100000,
        currency: 'INR',
        idempotencyKey: 'IDEM-PAY-TEST-01'
      });

    expect(createOrderRes.status).toBe(201);
    expect(createOrderRes.body.amountInr).toBe(100000);
    expect(createOrderRes.body.commission).toBe(5000); // 5%
    expect(createOrderRes.body.netDisbursal).toBe(95000); // 95%
    expect(createOrderRes.body.gatewayOrderId).toMatch(/^order_/);

    // Idempotency: same key returns existing payment order
    const idemRes = await request(app)
      .post('/api/payments/create-order')
      .set(buyer.auth)
      .send({
        orderId: order._id,
        amount: 100000,
        currency: 'INR',
        idempotencyKey: 'IDEM-PAY-TEST-01'
      });
    expect(idemRes.status).toBe(200);
    expect(idemRes.body.payment.paymentId).toBe(createOrderRes.body.paymentId);
  });

  it('cryptographically verifies payment signatures, completes orders, and rejects bad signatures', async () => {
    const buyer = await createBuyer();
    const farmer = await createFarmer();
    const { env } = await import('../config/env.js');

    const order = await Order.create({
      buyer: buyer.user._id,
      farmer: farmer.user._id,
      crop: new mongoose.Types.ObjectId(),
      cropName: 'Basmati Rice',
      quantity: 5000,
      unit: 'kg',
      unitPriceInr: 80,
      totalInr: 400000,
      invoiceNumber: 'INV-2611-9922',
      idempotencyKey: 'TEST-ORDER-VERIF-01'
    });

    const createOrder = await request(app)
      .post('/api/payments/create-order')
      .set(buyer.auth)
      .send({
        orderId: order._id,
        amount: 400000
      });

    const paymentId = createOrder.body.paymentId;
    const gatewayOrderId = createOrder.body.gatewayOrderId;
    const gatewayPaymentId = 'pay_test_987654321';

    // 1. Rejection of bad signature
    const badVerifRes = await request(app)
      .post('/api/payments/verify')
      .set(buyer.auth)
      .send({
        paymentId,
        gatewayOrderId,
        gatewayPaymentId,
        gatewaySignature: 'tampered_fake_signature'
      });
    expect(badVerifRes.status).toBe(400);
    expect(badVerifRes.body.message).toMatch(/Invalid payment signature/i);

    // 2. Acceptance of valid HMAC SHA256 signature
    const payload = `${gatewayOrderId}|${gatewayPaymentId}`;
    const validSignature = crypto.createHmac('sha256', env.razorpayKeySecret).update(payload).digest('hex');

    const goodVerifRes = await request(app)
      .post('/api/payments/verify')
      .set(buyer.auth)
      .send({
        paymentId,
        gatewayOrderId,
        gatewayPaymentId,
        gatewaySignature: validSignature
      });

    expect(goodVerifRes.status).toBe(200);
    expect(goodVerifRes.body.payment.status).toBe('completed');
    expect(goodVerifRes.body.receiptNumber).toMatch(/^REC-/);

    // Verify linked order updated
    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder.paymentStatus).toBe('paid');
    expect(updatedOrder.receiptNumber).toBe(goodVerifRes.body.receiptNumber);

    // Verify farmer payable balance credited
    const updatedFarmer = await User.findById(farmer.user._id);
    expect(updatedFarmer.payableBalanceInr).toBe(380000); // 400,000 - 5% (20,000)
  });

  it('settles farmer payouts via UPI/NEFT, prevents duplicate payouts, and updates earnings', async () => {
    const admin = await createAdmin();
    const farmer = await createFarmer();

    // Create a collection request for farmer
    const col = await CollectionRequest.create({
      collectionId: 'COL-TEST-7711',
      farmer: farmer.user._id,
      crop: new mongoose.Types.ObjectId(),
      cropName: 'Red Chillies',
      estimatedQuantityKg: 2000,
      acceptedQuantityKg: 2000,
      unitPriceInr: 150,
      totalEstimatedPayoutInr: 300000,
      totalFinalPayoutInr: 300000,
      status: 'accepted',
      paymentStatus: 'pending',
      pickupAddress: 'Guntur Cold Storage'
    });

    // 1. Settle farmer payout (Gross: 300,000 -> 5% Comm: 15,000 -> Net: 285,000)
    const settleRes = await request(app)
      .post('/api/payments/settle-farmer')
      .set(admin.auth)
      .send({
        farmerId: farmer.user._id,
        collectionId: col.collectionId,
        acceptedQuantityKg: 2000,
        ratePerKg: 150,
        amountInr: 300000,
        paymentMethod: 'UPI',
        beneficiaryDetails: { upiId: 'kisan@okhdfcbank' },
        idempotencyKey: 'IDEM-SETTLE-COL-7711'
      });

    expect(settleRes.status).toBe(201);
    expect(settleRes.body.settlement.settlementId).toMatch(/^SET-/);
    expect(settleRes.body.settlement.grossPayableInr).toBe(300000);
    expect(settleRes.body.settlement.platformCommissionInr).toBe(15000);
    expect(settleRes.body.settlement.netPayoutInr).toBe(285000);
    expect(settleRes.body.settlement.transactionReference).toMatch(/^UTR-/);

    // 2. Duplicate Payout Prevention Guard
    const dupRes = await request(app)
      .post('/api/payments/settle-farmer')
      .set(admin.auth)
      .send({
        farmerId: farmer.user._id,
        collectionId: col.collectionId,
        acceptedQuantityKg: 2000,
        ratePerKg: 150,
        amountInr: 300000,
        idempotencyKey: 'IDEM-SETTLE-COL-7711'
      });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.message).toMatch(/Duplicate settlement detected/i);

    // Verify farmer user earnings updated
    const updatedFarmer = await User.findById(farmer.user._id);
    expect(updatedFarmer.totalSettledEarningsInr).toBe(285000);

    // Verify collection request marked paid
    const updatedCol = await CollectionRequest.findOne({ collectionId: col.collectionId });
    expect(updatedCol.paymentStatus).toBe('paid');
  });

  it('handles milestone fund releases, refunds, invoices, and financial dashboards', async () => {
    const admin = await createAdmin();
    const buyer = await createBuyer();
    const farmer = await createFarmer();

    // 1. Create and complete a payment with milestone stage
    const order = await Order.create({
      buyer: buyer.user._id,
      farmer: farmer.user._id,
      crop: new mongoose.Types.ObjectId(),
      cropName: 'Alphonso Mangoes',
      quantity: 2000,
      unit: 'kg',
      unitPriceInr: 250,
      totalInr: 500000,
      invoiceNumber: 'INV-2611-3344',
      idempotencyKey: 'TEST-ORDER-MILESTONE-01'
    });

    const createOrder = await request(app)
      .post('/api/payments/create-order')
      .set(buyer.auth)
      .send({
        orderId: order._id,
        amount: 500000,
        milestoneStage: 'initial_deposit'
      });

    const paymentId = createOrder.body.paymentId;
    await request(app)
      .post('/api/payments/verify')
      .set(buyer.auth)
      .send({
        paymentId,
        gatewayOrderId: createOrder.body.gatewayOrderId,
        gatewayPaymentId: 'pay_demo_5555',
        gatewaySignature: 'demo_signature_ok'
      });

    // 2. Release milestone escrow funds
    const releaseRes = await request(app)
      .post('/api/payments/milestones/release')
      .set(admin.auth)
      .send({
        paymentId,
        milestoneStage: 'delivery_completed',
        releaseAmountInr: 475000
      });
    expect(releaseRes.status).toBe(200);
    expect(releaseRes.body.payment.milestoneReleased).toBe(true);

    // 3. Process refund
    const refundRes = await request(app)
      .post(`/api/payments/${paymentId}/refund`)
      .set(admin.auth)
      .send({
        reason: 'Transit delay beyond perishable shelf life',
        amountInr: 500000
      });

    expect(refundRes.status).toBe(200);
    expect(refundRes.body.refund.status).toBe('processed');
    expect(refundRes.body.refund.refundId).toMatch(/^REF-/);

    // 4. Invoices endpoint
    const invRes = await request(app)
      .get('/api/payments/invoices/INV-2611-3344')
      .set(buyer.auth);

    expect(invRes.status).toBe(200);
    expect(invRes.body.invoiceNumber).toBe('INV-2611-3344');
    expect(invRes.body.financialSummary.platformCommissionPercent).toBe(5);

    // 5. Admin financial dashboard
    const adminDash = await request(app)
      .get('/api/payments/dashboard/admin')
      .set(admin.auth);

    expect(adminDash.status).toBe(200);
    expect(adminDash.body.metrics.totalRefundsInr).toBe(500000);

    // 6. Farmer financial dashboard
    const farmerDash = await request(app)
      .get('/api/payments/dashboard/farmer')
      .set(farmer.auth);

    expect(farmerDash.status).toBe(200);
    expect(farmerDash.body.bankAccount).toBeDefined();
  });
});
