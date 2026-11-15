import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app, mongod, User, Crop, AggregationLot, Order, Shipment, n = 0;

beforeAll(async () => {
  process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'agri-phase6-'));
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = (await import('../app.js')).createApp();
  User = (await import('../models/User.js')).User;
  Crop = (await import('../models/Crop.js')).Crop;
  AggregationLot = (await import('../models/AggregationLot.js')).AggregationLot;
  Order = (await import('../models/Order.js')).Order;
  Shipment = (await import('../models/Shipment.js')).Shipment;
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
    Shipment.deleteMany({})
  ]);
});

async function createBuyer() {
  n += 1;
  const res = await request(app).post('/api/auth/register').send({
    name: `Global Importer ${n}`,
    email: `importer${n}@dubaitrade.test`,
    password: 'Password123!',
    role: 'buyer',
    country: 'UAE',
    currency: 'USD'
  });
  return { auth: { Authorization: `Bearer ${res.body.token}` }, user: res.body.user };
}

async function createExporter() {
  n += 1;
  const res = await request(app).post('/api/auth/register').send({
    name: `Agri Exporter ${n}`,
    email: `exporter${n}@indianagro.test`,
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
    name: `Port Authority ${n}`,
    email: `admin${n}@ports.test`,
    role: 'admin',
    passwordHash: await bcrypt.hash('Password123!', 4)
  });
  const res = await request(app).post('/api/auth/login').send({
    email: `admin${n}@ports.test`,
    password: 'Password123!'
  });
  return { auth: { Authorization: `Bearer ${res.body.token}` }, user: u };
}

describe('Phase 6: Export Management & International Logistics Backend', () => {
  it('prevents container over-allocation and validates reefer capacity limits', async () => {
    const admin = await createAdmin();
    const buyer = await createBuyer();

    // 1. Attempt to over-allocate: 25,000 kg into a 20ft Reefer (max 22,000 kg)
    const overAllocRes = await request(app)
      .post('/api/logistics/shipments')
      .set(admin.auth)
      .send({
        cropName: 'Alphonso Mangoes',
        containerType: '20ft Reefer',
        allocatedWeightKg: 25000,
        destinationPort: 'Jebel Ali Port, Dubai (UAE)',
        buyerId: buyer.user._id
      });

    expect(overAllocRes.status).toBe(400);
    expect(overAllocRes.body.message).toMatch(/Container capacity exceeded/i);
    expect(overAllocRes.body.message).toMatch(/over-allocation prevented/i);

    // 2. Valid allocation: 20,000 kg into 20ft Reefer
    const validRes = await request(app)
      .post('/api/logistics/shipments')
      .set(admin.auth)
      .send({
        cropName: 'Alphonso Mangoes',
        containerType: '20ft Reefer',
        allocatedWeightKg: 20000,
        destinationPort: 'Jebel Ali Port, Dubai (UAE)',
        buyerId: buyer.user._id,
        temperatureSetpoint: 8.0
      });

    expect(validRes.status).toBe(201);
    expect(validRes.body.shipment.shipmentNumber).toMatch(/^SHP-/);
    expect(validRes.body.shipment.allocatedWeightKg).toBe(20000);
    expect(validRes.body.shipment.containerCapacityKg).toBe(22000);
  });

  it('manages container stuffing, sealing, and complete milestone lifecycle progression', async () => {
    const admin = await createAdmin();
    const buyer = await createBuyer();
    const exporter = await createExporter();

    // Create an order and lot to link
    const order = await Order.create({
      buyer: buyer.user._id,
      farmer: exporter.user._id,
      crop: new mongoose.Types.ObjectId(),
      cropName: 'Pomegranate Bhagwa',
      quantity: 15000,
      unit: 'kg',
      unitPriceInr: 90,
      totalInr: 1350000,
      invoiceNumber: 'INV-2611-7711',
      idempotencyKey: 'TEST-PO-8811'
    });

    // 1. Book shipment
    const bookRes = await request(app)
      .post('/api/logistics/shipments')
      .set(exporter.auth)
      .send({
        orderId: order._id,
        cropName: 'Pomegranate Bhagwa',
        containerType: '40ft Reefer',
        allocatedWeightKg: 15000,
        destinationPort: 'Port of Rotterdam',
        destinationCountry: 'Netherlands',
        shippingLine: 'Maersk Line',
        vesselName: 'Maersk Mc-Kinney',
        voyageNumber: '2611E'
      });

    expect(bookRes.status).toBe(201);
    const shp = bookRes.body.shipment;
    expect(shp.status).toBe('booked');

    // 2. Allocate container & seal
    const contRes = await request(app)
      .patch(`/api/logistics/shipments/${shp._id}/container`)
      .set(admin.auth)
      .send({
        containerId: 'MSKU-821940-1',
        sealNumber: 'SL-CUSTOMS-9012',
        temperatureSetpoint: 5.0,
        humiditySetpoint: 90
      });

    expect(contRes.status).toBe(200);
    expect(contRes.body.shipment.status).toBe('container_allocated');
    expect(contRes.body.shipment.containerId).toBe('MSKU-821940-1');

    // 3. Advance to loaded_at_port
    const loadRes = await request(app)
      .patch(`/api/logistics/shipments/${shp._id}/milestone`)
      .set(admin.auth)
      .send({
        status: 'loaded_at_port',
        location: 'JNPT Berth 3',
        description: 'Container loaded onto vessel Maersk Mc-Kinney'
      });
    expect(loadRes.status).toBe(200);
    expect(loadRes.body.shipment.status).toBe('loaded_at_port');

    // 4. Advance to in_transit
    const transitRes = await request(app)
      .patch(`/api/logistics/shipments/${shp._id}/milestone`)
      .set(admin.auth)
      .send({
        status: 'in_transit',
        location: 'Arabian Sea',
        description: 'Vessel departed JNPT en route to Rotterdam'
      });
    expect(transitRes.status).toBe(200);
    expect(transitRes.body.shipment.status).toBe('in_transit');

    // Verify linked order updated
    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder.status).toBe('In Transit');
    expect(updatedOrder.shipmentTracking.status).toBe('in_transit');
  });

  it('records cold chain telemetry, detects temperature excursions, and generates real-time alerts', async () => {
    const admin = await createAdmin();
    const buyer = await createBuyer();

    // Book shipment with 4°C setpoint (allowed range: 2.0°C to 6.0°C)
    const bookRes = await request(app)
      .post('/api/logistics/shipments')
      .set(admin.auth)
      .send({
        cropName: 'Fresh Table Grapes',
        containerType: '40ft High Cube Reefer',
        allocatedWeightKg: 22000,
        destinationPort: 'Port of London Gateway',
        temperatureSetpoint: 4.0
      });

    const shpId = bookRes.body.shipment._id;

    // 1. Submit normal telemetry log (4.1°C) -> no alert
    const log1 = await request(app)
      .post(`/api/logistics/shipments/${shpId}/cold-chain-log`)
      .set(admin.auth)
      .send({
        temperature: 4.1,
        humidity: 85,
        powerStatus: 'connected',
        sensorId: 'IOT-REEFER-01'
      });

    expect(log1.status).toBe(201);
    expect(log1.body.newAlertsCount).toBe(0);

    // 2. Submit high temperature excursion (8.2°C) -> critical alarm
    const log2 = await request(app)
      .post(`/api/logistics/shipments/${shpId}/cold-chain-log`)
      .set(admin.auth)
      .send({
        temperature: 8.2,
        humidity: 88,
        powerStatus: 'connected',
        location: 'Suez Canal Transit',
        sensorId: 'IOT-REEFER-01'
      });

    expect(log2.status).toBe(201);
    expect(log2.body.newAlertsCount).toBe(1);
    expect(log2.body.newAlerts[0].type).toBe('temperature_high');
    expect(log2.body.newAlerts[0].severity).toBe('critical');

    // Verify shipment has active alerts
    const updated = await Shipment.findById(shpId);
    expect(updated.hasActiveAlerts).toBe(true);
    expect(updated.coldChainAlerts.length).toBe(1);

    // 3. Resolve alert
    const alertId = updated.coldChainAlerts[0].alertId;
    const resolveRes = await request(app)
      .patch(`/api/logistics/shipments/${shpId}/cold-chain-alerts/${alertId}/resolve`)
      .set(admin.auth)
      .send({ resolutionNotes: 'Reefer compressor defrost cycle completed; temperature restored to 3.9°C' });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.alert.resolved).toBe(true);

    const cleared = await Shipment.findById(shpId);
    expect(cleared.hasActiveAlerts).toBe(false);
  });

  it('manages export documents, customs clearance, Proof of Delivery, and fleet analytics', async () => {
    const admin = await createAdmin();
    const buyer = await createBuyer();

    const bookRes = await request(app)
      .post('/api/logistics/shipments')
      .set(admin.auth)
      .send({
        cropName: 'Red Onions',
        containerType: '40ft Reefer',
        allocatedWeightKg: 24000,
        destinationPort: 'Port of Singapore',
        buyerId: buyer.user._id
      });

    const shpId = bookRes.body.shipment._id;

    // 1. Upload Phytosanitary Certificate
    const docRes = await request(app)
      .post(`/api/logistics/shipments/${shpId}/documents`)
      .set(admin.auth)
      .send({
        docType: 'phytosanitary_certificate',
        title: 'Phytosanitary Certificate of India',
        docNumber: 'PHYTO-IN-2026-9811',
        issuingAuthority: 'APEDA India',
        fileUrl: 'https://storage.agriglobal.test/docs/phyto-9811.pdf'
      });

    expect(docRes.status).toBe(201);

    // 2. Verify Document
    const verifyDocRes = await request(app)
      .patch(`/api/logistics/shipments/${shpId}/documents/phytosanitary_certificate/verify`)
      .set(admin.auth)
      .send({ status: 'verified', verificationNotes: 'APEDA seal validated' });

    expect(verifyDocRes.status).toBe(200);
    expect(verifyDocRes.body.doc.status).toBe('verified');

    // 3. Update Customs Clearances
    const customsRes = await request(app)
      .patch(`/api/logistics/shipments/${shpId}/customs`)
      .set(admin.auth)
      .send({
        originShippingBillNumber: 'ICEGATE-SB-2026-4412',
        originStatus: 'cleared',
        destBillOfEntryNumber: 'SINGAPORE-BOE-8821',
        destStatus: 'cleared',
        destDutyAmountPaid: 450
      });

    expect(customsRes.status).toBe(200);
    expect(customsRes.body.originCustoms.status).toBe('cleared');
    expect(customsRes.body.destinationCustoms.status).toBe('cleared');

    // 4. Importer confirms Proof of Delivery (POD)
    const podRes = await request(app)
      .post(`/api/logistics/shipments/${shpId}/proof-of-delivery`)
      .set(buyer.auth)
      .send({
        recipientName: 'Singapore Cold Storage Logistics Pte Ltd',
        receivedQuantityKg: 24000,
        conditionOnArrival: 'Excellent - Cold Chain Maintained',
        remarks: 'Zero transit loss, cargo temperature 4.1°C at unloading bay.'
      });

    expect(podRes.status).toBe(200);
    expect(podRes.body.shipment.status).toBe('delivered');
    expect(podRes.body.proofOfDelivery.conditionOnArrival).toBe('Excellent - Cold Chain Maintained');

    // 5. Check Fleet Analytics
    const analyticsRes = await request(app)
      .get('/api/logistics/analytics')
      .set(admin.auth);

    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.fleet.totalShipments).toBeGreaterThanOrEqual(1);
    expect(analyticsRes.body.statusBreakdown.delivered).toBeGreaterThanOrEqual(1);
  });
});
