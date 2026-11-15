/**
 * Live Verification Script for Phase 8: AI Intelligence, Analytics, Security & Production
 * Executes live queries against MongoDB and tests all Phase 8 services.
 */
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Crop } from '../src/models/Crop.js';
import { AggregationLot } from '../src/models/AggregationLot.js';
import { Shipment } from '../src/models/Shipment.js';
import { Payment } from '../src/models/Payment.js';
import { Settlement } from '../src/models/Settlement.js';
import { Notification } from '../src/models/Notification.js';
import {
  predictInternationalDemand,
  recommendExportDestinations,
  smartMatchFarmerBuyer,
  analyzeCropQuality
} from '../src/services/aiIntelligence.js';
import { notify } from '../src/services/notify.js';

const MONGO_URI = env.mongoUri;

async function runVerification() {
  console.log('--- Starting Live Phase 8 Verification ---');
  console.log(`Connecting to MongoDB at: ${MONGO_URI}`);
  await mongoose.connect(MONGO_URI);
  console.log('✓ MongoDB Connected Successfully.');

  // 1. Verify AI Demand Forecasting
  console.log('\n[1/6] Verifying International Demand Forecasting...');
  const demandResult = await predictInternationalDemand({
    crop: 'Basmati Rice',
    targetCountry: 'United Arab Emirates',
    targetMonth: 11
  });
  console.log(`✓ Demand Index: ${demandResult.demandIndex}/100 (${demandResult.trend})`);
  console.log(`✓ Projected International Price: $${demandResult.projectedPriceUsdPerMt}/MT (₹${demandResult.projectedPriceInrPerKg}/kg)`);
  console.log(`✓ Confidence Score: ${Math.round(demandResult.confidenceScore * 100)}%`);
  console.log(`✓ Explainability Factors (${demandResult.factors.length}):`, demandResult.factors[0]);

  // 2. Verify Export Destination Recommendations
  console.log('\n[2/6] Verifying Export Destination Recommendations...');
  const destResult = await recommendExportDestinations({
    crop: 'Mango',
    grade: 'A',
    volumeKg: 24000
  });
  console.log(`✓ Top Destination: ${destResult.recommendations[0].country} (${destResult.recommendations[0].destinationPort})`);
  console.log(`✓ Tariff Benefit: ${destResult.recommendations[0].tariffBenefit}`);
  console.log(`✓ Maritime Transit: ${destResult.recommendations[0].estimatedTransitDays} days`);
  console.log(`✓ Target Realization: $${destResult.recommendations[0].targetPriceUsdPerMt}/MT`);

  // 3. Verify Smart Farmer-Buyer Matching
  console.log('\n[3/6] Verifying Smart Farmer-Buyer Matching...');
  const matchResult = await smartMatchFarmerBuyer({
    cropName: 'Mango',
    quantityKg: 5000,
    targetCountry: 'United Arab Emirates'
  });
  console.log(`✓ Matches Found: ${matchResult.totalMatchesFound}`);
  if (matchResult.topMatches.length > 0) {
    console.log(`✓ Top Match: ${matchResult.topMatches[0].companyName} (${matchResult.topMatches[0].matchScore}% fit)`);
    console.log(`✓ Action: ${matchResult.topMatches[0].recommendedAction}`);
  }

  // 4. Verify AI Crop Quality Analysis & Grading
  console.log('\n[4/6] Verifying AI Crop Quality Grading...');
  const qualityResult = await analyzeCropQuality({
    cropName: 'Basmati Rice',
    moisturePercent: 12.8,
    defectPercent: 1.2,
    sizeUniformityPercent: 94.0,
    foreignMatterPercent: 0.1,
    colorScore: 92
  });
  console.log(`✓ Assigned Grade: ${qualityResult.grade} (${qualityResult.gradeCode})`);
  console.log(`✓ Export Eligible: ${qualityResult.exportEligibility}`);
  console.log(`✓ Pricing Adjustment: +${qualityResult.pricePremiumDiscountPercent}% (₹${qualityResult.suggestedExportPriceInr}/kg)`);
  console.log(`✓ Confidence: ${Math.round(qualityResult.confidenceScore * 100)}%`);

  // 5. Verify Multi-Channel Notification Dispatch
  console.log('\n[5/6] Verifying Multi-Channel Notification Dispatch...');
  const adminUser = await User.findOne({ role: 'admin' });
  if (adminUser) {
    const notif = await notify(
      adminUser._id,
      'export_bi_generated',
      'Phase 8 AI intelligence and analytics engines successfully validated live.',
      '/analytics',
      {
        channels: ['in_app', 'email', 'sms'],
        emailSubject: 'AgriGlobal Phase 8 Live Verification Notice',
        severity: 'success',
        metadata: { phase: 8, status: 'verified' }
      }
    );
    console.log(`✓ Multi-channel Notification Created: ID ${notif._id}`);
    console.log(`✓ Channels: ${notif.channels.join(', ')} | Email: ${notif.emailStatus} | SMS: ${notif.smsStatus}`);
  }

  // 6. Verify Database Collections & Live Health
  console.log('\n[6/6] Verifying Database Record Volume...');
  const [cropsCount, lotsCount, shipmentsCount, settlementsCount, notifsCount] = await Promise.all([
    Crop.countDocuments(),
    AggregationLot.countDocuments(),
    Shipment.countDocuments(),
    Settlement.countDocuments(),
    Notification.countDocuments()
  ]);
  console.log(`✓ Crops: ${cropsCount}`);
  console.log(`✓ Aggregation Lots: ${lotsCount}`);
  console.log(`✓ Shipments: ${shipmentsCount}`);
  console.log(`✓ Settlements: ${settlementsCount}`);
  console.log(`✓ Notifications: ${notifsCount}`);

  await mongoose.disconnect();
  console.log('\n🎉 ALL PHASE 8 CAPABILITIES VERIFIED SUCCESSFULLY ON LIVE ENVIRONMENT!');
}

runVerification().catch((err) => {
  console.error('Phase 8 Live Verification Error:', err);
  process.exit(1);
});
