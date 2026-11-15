import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { User } from '../models/User.js';
import { Crop } from '../models/Crop.js';
import { Company } from '../models/Company.js';
import { BuyerDemand } from '../models/BuyerDemand.js';
import { AggregationLot } from '../models/AggregationLot.js';
import { signToken } from '../middleware/auth.js';

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'test-secret-key-phase9';
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
  const token = signToken(user);
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
}

describe('PHASE 9: AI-POWERED GLOBAL MARKETPLACE, DYNAMIC CROPS & DEMAND MATCHING', () => {
  let admin, farmer1, farmer2, buyer1;
  let cropTomato1, cropTomato2, cropMango;

  beforeAll(async () => {
    admin = await createAuthUser('admin', 'Admin User', 'admin-p9@test.com');
    farmer1 = await createAuthUser('farmer', 'Farmer Ramesh', 'ramesh-p9@test.com');
    farmer2 = await createAuthUser('farmer', 'Farmer Suresh', 'suresh-p9@test.com');
    buyer1 = await createAuthUser('buyer', 'Dubai Fresh Importers', 'buyer-p9@test.com');

    // Create crops for farmer1 and farmer2
    cropTomato1 = await Crop.create({
      farmer: farmer1.user._id,
      name: 'Organic Tomatoes',
      category: 'Vegetables',
      variety: 'Roma',
      grade: 'A',
      quantity: 10000,
      unit: 'kg',
      priceInr: 45,
      location: 'Nashik, Maharashtra',
      state: 'Maharashtra',
      country: 'India',
      status: 'available',
      organicCertified: true,
      allocatedQuantity: 0
    });

    cropTomato2 = await Crop.create({
      farmer: farmer2.user._id,
      name: 'Tomatoes',
      category: 'Vegetables',
      variety: 'Roma',
      grade: 'A',
      quantity: 15000,
      unit: 'kg',
      priceInr: 42,
      location: 'Kolar, Karnataka',
      state: 'Karnataka',
      country: 'India',
      status: 'available',
      allocatedQuantity: 0
    });

    cropMango = await Crop.create({
      farmer: farmer1.user._id,
      name: 'Alphonso Mango',
      category: 'Fruits',
      variety: 'Alphonso',
      grade: 'A',
      quantity: 5000,
      unit: 'kg',
      priceInr: 120,
      location: 'Ratnagiri, Maharashtra',
      state: 'Maharashtra',
      country: 'India',
      status: 'available',
      allocatedQuantity: 0
    });

    // Create companies for 3-tier directory test
    await Company.create({
      type: 'international_importer',
      name: 'Verified Gulf Food LLC',
      country: 'UAE',
      sourceUrl: 'https://trade.gov/uae-directory',
      verificationStatus: 'verified',
      productsHandled: ['tomato', 'mango'],
      rating: 4.8
    });

    await Company.create({
      type: 'international_importer',
      name: 'Potential Euro Trade B.V.',
      country: 'Netherlands',
      sourceUrl: 'https://apeda.gov.in/leads',
      verificationStatus: 'unverified',
      productsHandled: ['wheat', 'onion'],
      rating: 4.0
    });
  });

  describe('Module 1: Dynamic Global Crop Sell Marketplace', () => {
    it('discovers distinct crops dynamically from MongoDB without hardcoding', async () => {
      const res = await request(app).get('/api/crops/marketplace/dynamic-crops');
      expect(res.status).toBe(200);
      expect(res.body.totalDistinctCrops).toBeGreaterThanOrEqual(2);

      const tomatoGroup = res.body.crops.find((c) => c.cropName.toLowerCase().includes('tomato'));
      expect(tomatoGroup).toBeDefined();
      expect(tomatoGroup.totalQuantityKg).toBe(25000); // 10000 + 15000
      expect(tomatoGroup.freeStockKg).toBe(25000);
      expect(tomatoGroup.listingsCount).toBe(2);
      expect(tomatoGroup.gradesAvailable).toContain('A');
      expect(tomatoGroup.minPriceInr).toBe(42);
      expect(tomatoGroup.maxPriceInr).toBe(45);
      expect(tomatoGroup.exportSuitability).toContain('High Export Grade');
    });

    it('filters marketplace listings by grade, variety, and location', async () => {
      const res = await request(app)
        .get('/api/crops/marketplace/listings')
        .query({ crop: 'Tomato', grade: 'A', state: 'Maharashtra' });

      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].state).toBe('Maharashtra');
    });
  });

  describe('Module 2: Farmer Sell Offers', () => {
    it('allows farmer to activate a sell offer with min order quantity and export grade', async () => {
      const res = await request(app)
        .post(`/api/crops/${cropTomato1._id}/sell-offer`)
        .set(farmer1.auth)
        .send({
          offerPriceInr: 44,
          minOrderQuantityKg: 1000,
          exportSuitability: 'High Export Grade (Grade A Certified)',
          packagingOptions: ['Plastic Crates (20kg)', 'Corrugated Boxes']
        });

      expect(res.status).toBe(200);
      expect(res.body.crop.offerStatus).toBe('active');
      expect(res.body.crop.offerPriceInr).toBe(44);
      expect(res.body.crop.minOrderQuantityKg).toBe(1000);
    });

    it('allows farmer to withdraw their sell offer', async () => {
      const res = await request(app)
        .patch(`/api/crops/${cropTomato1._id}/withdraw-offer`)
        .set(farmer1.auth);

      expect(res.status).toBe(200);
      expect(res.body.crop.offerStatus).toBe('withdrawn');
    });
  });

  describe('Module 3: International Buyer Directory (3-Tier Categorization)', () => {
    it('returns buyers grouped into registered, verified, and potential tiers', async () => {
      const res = await request(app).get('/api/global-buyers').set(admin.auth);
      expect(res.status).toBe(200);
      expect(res.body.counts).toBeDefined();
      expect(res.body.counts.registered).toBeGreaterThanOrEqual(1);
      expect(res.body.counts.verified).toBeGreaterThanOrEqual(1);
      expect(res.body.counts.potential).toBeGreaterThanOrEqual(1);
    });

    it('filters directory by tier', async () => {
      const res = await request(app).get('/api/global-buyers?tier=potential').set(admin.auth);
      expect(res.status).toBe(200);
      expect(res.body.items.every((b) => b.tier === 'potential')).toBe(true);
      expect(res.body.items[0].tierLabel).toContain('Potential Buyer');
    });

    it('allows inviting an unverified potential buyer lead', async () => {
      const potentialBuyer = await Company.findOne({ verificationStatus: 'unverified' });
      const res = await request(app)
        .post(`/api/global-buyers/${potentialBuyer._id}/invite`)
        .set(admin.auth)
        .send({ note: 'Join AgriGlobal to procure Grade A Tomatoes' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Invitation generated');
    });

    it('allows admin to verify company credentials', async () => {
      const potentialBuyer = await Company.findOne({ verificationStatus: 'unverified' });
      const res = await request(app)
        .patch(`/api/global-buyers/${potentialBuyer._id}/verify-credentials`)
        .set(admin.auth)
        .send({ evidence: 'Verified valid import trade license with APEDA certification' });

      expect(res.status).toBe(200);
      expect(res.body.company.verificationStatus).toBe('verified');
    });
  });

  describe('Module 4, 5 & 6: Buyer Demand Creation, Live Farmer Contribution & Aggregation', () => {
    let createdDemand;

    it('allows international buyer to create a crop purchase demand', async () => {
      const res = await request(app)
        .post('/api/demands')
        .set(buyer1.auth)
        .send({
          cropName: 'Tomato',
          variety: 'Roma',
          requiredQuantity: 20000,
          unit: 'kg',
          targetGrade: 'A',
          targetPricePerKg: 48,
          currency: 'INR',
          destinationCountry: 'UAE',
          destinationPort: 'Jebel Ali Port, Dubai',
          incoterms: 'CIF',
          packaging: 'Corrugated cartons (10kg)',
          certifications: ['Phytosanitary Certificate', 'Global GAP'],
          deliveryDeadline: new Date(Date.now() + 14 * 86400000).toISOString(),
          notes: 'High firmness tomatoes for UAE supermarket chain.'
        });

      expect(res.status).toBe(201);
      expect(res.body.demand).toBeDefined();
      expect(res.body.demand.demandId).toMatch(/^DEM-/);
      expect(res.body.demand.requiredQuantityKg).toBe(20000);
      expect(res.body.demand.committedQuantityKg).toBe(0);
      expect(res.body.demand.remainingQuantityKg).toBe(20000);
      expect(res.body.demand.fulfillmentPercentage).toBe(0);
      expect(res.body.demand.status).toBe('open');

      createdDemand = res.body.demand;
    });

    it('rejects contribution when farmer has insufficient free stock', async () => {
      const res = await request(app)
        .post(`/api/demands/${createdDemand._id}/contribute`)
        .set(farmer1.auth)
        .send({
          cropId: cropTomato1._id,
          quantityKg: 50000, // Exceeds 10000 free stock
          offeredPriceInr: 46
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Insufficient free stock');
    });

    it('allows Farmer 1 to contribute partial produce towards the demand', async () => {
      const res = await request(app)
        .post(`/api/demands/${createdDemand._id}/contribute`)
        .set(farmer1.auth)
        .send({
          cropId: cropTomato1._id,
          quantityKg: 8000,
          offeredPriceInr: 46,
          notes: 'Standard export crates'
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.demand.committedQuantityKg).toBe(8000);
      expect(res.body.demand.remainingQuantityKg).toBe(12000);
      expect(res.body.demand.fulfillmentPercentage).toBe(40);
      expect(res.body.demand.status).toBe('partially_committed');

      // Verify farmer crop allocatedQuantity was incremented
      const updatedCrop1 = await Crop.findById(cropTomato1._id);
      expect(updatedCrop1.allocatedQuantity).toBe(8000);
    });

    it('prevents oversubscription if contribution exceeds remaining demand quota', async () => {
      const res = await request(app)
        .post(`/api/demands/${createdDemand._id}/contribute`)
        .set(farmer2.auth)
        .send({
          cropId: cropTomato2._id,
          quantityKg: 13000, // Remaining is only 12000!
          offeredPriceInr: 45
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('exceeds remaining demand quota');
    });

    it('allows Farmer 2 to contribute exact remaining quota, triggering 100% fulfillment and AggregationLot', async () => {
      const res = await request(app)
        .post(`/api/demands/${createdDemand._id}/contribute`)
        .set(farmer2.auth)
        .send({
          cropId: cropTomato2._id,
          quantityKg: 12000, // Exact remaining 12000
          offeredPriceInr: 45
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.demand.committedQuantityKg).toBe(20000);
      expect(res.body.demand.remainingQuantityKg).toBe(0);
      expect(res.body.demand.fulfillmentPercentage).toBe(100);
      expect(['fully_committed', 'fulfilled', 'in_aggregation']).toContain(res.body.demand.status);
      expect(res.body.demand.aggregationLot).toBeDefined();

      // Verify AggregationLot was created
      const lot = await AggregationLot.findById(res.body.demand.aggregationLot);
      expect(lot).toBeDefined();
      expect(lot.totalQuantityKg).toBe(20000);
      expect(lot.status).toBe('ready_for_inspection');
    });

    it('allows public viewing of demand board with privacy-protected anonymized farmers', async () => {
      const res = await request(app).get(`/api/demands/${createdDemand._id}`).set(buyer1.auth);
      expect(res.status).toBe(200);
      expect(res.body.demand.contributions.length).toBe(2);
      // Buyer viewing should not see farmer phone or full email
      expect(res.body.demand.contributions[0].farmerPhone).toBeUndefined();
    });
  });

  describe('Module 7: Contribution Cancellation & Safe Stock Release', () => {
    let cancellableDemand;
    let freshCrop;

    beforeAll(async () => {
      freshCrop = await Crop.create({
        farmer: farmer1.user._id,
        name: 'Organic Wheat',
        category: 'Grains',
        variety: 'Sharbati',
        grade: 'A',
        quantity: 8000,
        unit: 'kg',
        priceInr: 35,
        location: 'Ludhiana, Punjab',
        state: 'Punjab',
        country: 'India',
        status: 'available',
        allocatedQuantity: 0
      });

      const dRes = await request(app)
        .post('/api/demands')
        .set(buyer1.auth)
        .send({
          cropName: 'Wheat',
          requiredQuantity: 10000,
          unit: 'kg',
          targetGrade: 'A',
          targetPricePerKg: 38,
          destinationCountry: 'Saudi Arabia',
          destinationPort: 'Jeddah Islamic Port',
          deliveryDeadline: new Date(Date.now() + 10 * 86400000).toISOString()
        });
      cancellableDemand = dRes.body.demand;

      // Farmer contributes 4000 kg
      await request(app)
        .post(`/api/demands/${cancellableDemand._id}/contribute`)
        .set(farmer1.auth)
        .send({
          cropId: freshCrop._id,
          quantityKg: 4000,
          offeredPriceInr: 37
        });
    });

    it('allows farmer to cancel their committed contribution and safely releases allocated stock', async () => {
      const fetchDmd = await BuyerDemand.findById(cancellableDemand._id);
      const contribId = fetchDmd.contributions[0]._id;

      // Verify allocated quantity before cancellation
      const cropBefore = await Crop.findById(freshCrop._id);
      expect(cropBefore.allocatedQuantity).toBe(4000);

      const res = await request(app)
        .delete(`/api/demands/${cancellableDemand._id}/contributions/${contribId}`)
        .set(farmer1.auth)
        .send({ reason: 'Logistics conflict' });

      expect(res.status).toBe(200);
      expect(res.body.demand.committedQuantityKg).toBe(0);
      expect(res.body.demand.remainingQuantityKg).toBe(10000);
      expect(res.body.demand.fulfillmentPercentage).toBe(0);

      // Verify allocated stock was restored (decremented to 0)
      const cropAfter = await Crop.findById(freshCrop._id);
      expect(cropAfter.allocatedQuantity).toBe(0);
    });

    it('allows buyer to cancel entire demand and releases any committed allocations', async () => {
      // Re-contribute 3000 kg
      await request(app)
        .post(`/api/demands/${cancellableDemand._id}/contribute`)
        .set(farmer1.auth)
        .send({
          cropId: freshCrop._id,
          quantityKg: 3000,
          offeredPriceInr: 37
        });

      let cropAllocated = await Crop.findById(freshCrop._id);
      expect(cropAllocated.allocatedQuantity).toBe(3000);

      const cancelRes = await request(app)
        .delete(`/api/demands/${cancellableDemand._id}`)
        .set(buyer1.auth)
        .send({ reason: 'Procurement schedule deferred' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.demand.status).toBe('cancelled');

      // Verify stock was restored to farmer
      cropAllocated = await Crop.findById(freshCrop._id);
      expect(cropAllocated.allocatedQuantity).toBe(0);
    });
  });

  describe('Module 8: Admin QC Inspection & Stock Return on Rejection', () => {
    let inspectableDemand;
    let inspectableCrop;
    let contributionId;

    beforeAll(async () => {
      inspectableCrop = await Crop.create({
        farmer: farmer2.user._id,
        name: 'Fresh Onion',
        category: 'Vegetables',
        variety: 'Nashik Red',
        grade: 'A',
        quantity: 5000,
        unit: 'kg',
        priceInr: 25,
        location: 'Nashik, Maharashtra',
        state: 'Maharashtra',
        country: 'India',
        status: 'available',
        allocatedQuantity: 0
      });

      const dRes = await request(app)
        .post('/api/demands')
        .set(buyer1.auth)
        .send({
          cropName: 'Onion',
          requiredQuantity: 5000,
          unit: 'kg',
          targetGrade: 'A',
          targetPricePerKg: 28,
          destinationCountry: 'Malaysia',
          destinationPort: 'Port Klang',
          deliveryDeadline: new Date(Date.now() + 10 * 86400000).toISOString()
        });
      inspectableDemand = dRes.body.demand;

      const cRes = await request(app)
        .post(`/api/demands/${inspectableDemand._id}/contribute`)
        .set(farmer2.auth)
        .send({
          cropId: inspectableCrop._id,
          quantityKg: 5000,
          offeredPriceInr: 27
        });
      contributionId = cRes.body.demand.contributions[0]._id;
    });

    it('records QC inspection with accepted and rejected quantities, restoring rejected stock', async () => {
      // 4000 kg accepted, 1000 kg rejected due to moisture
      const res = await request(app)
        .post(`/api/demands/${inspectableDemand._id}/contributions/${contributionId}/inspection`)
        .set(admin.auth)
        .send({
          acceptedQuantityKg: 4000,
          rejectedQuantityKg: 1000,
          inspectionGrade: 'A',
          rejectionReason: '1000kg had high moisture content',
          qcInspectorNotes: 'Passed phytosanitary standards for 4000kg'
        });

      expect(res.status).toBe(200);
      const contrib = res.body.demand.contributions.find((c) => String(c._id) === String(contributionId));
      expect(contrib.status).toBe('accepted');
      expect(contrib.acceptedQuantityKg).toBe(4000);
      expect(contrib.rejectedQuantityKg).toBe(1000);

      // Verify 1000 kg rejected was released from allocated quantity on crop
      const updatedCrop = await Crop.findById(inspectableCrop._id);
      expect(updatedCrop.allocatedQuantity).toBe(4000); // 5000 - 1000 released
    });
  });

  describe('Module 9: AI Matching & Analytics', () => {
    it('returns AI crop demand matching for a farmer', async () => {
      const res = await request(app)
        .get('/api/demands/match/farmer-crops')
        .set(farmer1.auth);

      expect(res.status).toBe(200);
      expect(res.body.matches).toBeDefined();
      expect(Array.isArray(res.body.matches)).toBe(true);
    });

    it('returns global demand analytics summary', async () => {
      const res = await request(app).get('/api/demands/analytics/summary').set(admin.auth);
      expect(res.status).toBe(200);
      expect(res.body.totalDemands).toBeGreaterThanOrEqual(1);
      expect(res.body.totalDemandVolumeKg).toBeGreaterThanOrEqual(20000);
      expect(res.body.topDemandCrops).toBeDefined();
      expect(res.body.topDestinationCountries).toBeDefined();
    });
  });
});
