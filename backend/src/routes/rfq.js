import express from 'express';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Rfq, generateRfqNumber } from '../models/Rfq.js';
import { Order, generateInvoiceNumber } from '../models/Order.js';
import { AggregationLot } from '../models/AggregationLot.js';
import { Crop } from '../models/Crop.js';
import { asyncHandler, ApiError } from '../middleware/http.js';
import { authenticate } from '../middleware/auth.js';
import { notify } from '../services/notify.js';
import { toKg } from '../services/aggregation.js';

const router = express.Router();
router.use(authenticate);

/**
 * POST /api/rfqs
 * Buyer creates a new Request for Quotation (RFQ).
 */
router.post('/', asyncHandler(async (req, res) => {
  const {
    cropName,
    category,
    quantity,
    unit = 'kg',
    grade = 'A',
    targetPriceInr,
    currency = 'USD',
    deliveryDestination,
    deliveryTerms = 'CIF',
    portOfDischarge,
    requiredByDate,
    packagingRequirements,
    qualitySpecifications,
    notes
  } = req.body || {};

  if (!cropName || !quantity || !deliveryDestination || !requiredByDate) {
    throw new ApiError(400, 'cropName, quantity, deliveryDestination, and requiredByDate are required');
  }

  const qtyKg = toKg(Number(quantity), unit);

  // Look for compatible active AggregationLot in the same crop
  const normCrop = cropName.toLowerCase().trim();
  const matchingLot = await AggregationLot.findOne({
    cropName: new RegExp(`^${normCrop}`, 'i'),
    status: { $in: ['ready_for_inspection', 'inspected', 'forming'] }
  });

  const rfq = new Rfq({
    rfqNumber: generateRfqNumber(),
    buyer: req.user._id,
    buyerName: req.user.name,
    buyerEmail: req.user.email,
    buyerCountry: req.user.country || 'International',
    buyerCompany: req.user.companyName || req.user.organization || '',
    cropName,
    category: category || 'Vegetables',
    quantity: Number(quantity),
    unit,
    quantityInKg: qtyKg,
    grade,
    targetPriceInr: targetPriceInr ? Number(targetPriceInr) : null,
    currency,
    deliveryDestination,
    deliveryTerms,
    portOfDischarge: portOfDischarge || deliveryDestination,
    requiredByDate: new Date(requiredByDate),
    packagingRequirements: packagingRequirements || 'Standard export packaging',
    qualitySpecifications: qualitySpecifications || '',
    status: 'open',
    matchingLot: matchingLot?._id || null,
    matchingLotId: matchingLot?.lotId || '',
    notes: notes || ''
  });

  await rfq.save();

  res.status(201).json({
    message: 'RFQ posted successfully',
    rfq
  });
}));

/**
 * GET /api/rfqs
 * Lists RFQs:
 * - Buyers see their own RFQs
 * - Farmers / Exporters / Admins see all open RFQs
 */
router.get('/', asyncHandler(async (req, res) => {
  const filter = {};

  if (req.user.role === 'buyer') {
    filter.buyer = req.user._id;
  } else {
    // Suppliers and admins see open RFQs or filter by status
    if (req.query.status) {
      filter.status = req.query.status;
    } else {
      filter.status = { $in: ['open', 'quoted', 'negotiating'] };
    }
  }

  if (req.query.cropName) {
    filter.cropName = new RegExp(req.query.cropName, 'i');
  }
  if (req.query.destination) {
    filter.deliveryDestination = new RegExp(req.query.destination, 'i');
  }

  const rfqs = await Rfq.find(filter)
    .populate('buyer', 'name email country companyName')
    .populate('matchingLot', 'lotId cropName grade totalQuantityKg weightedAvgPricePerKg')
    .sort('-createdAt')
    .limit(Number(req.query.limit) || 100);

  res.json({ count: rfqs.length, rfqs });
}));

/**
 * GET /api/rfqs/:id
 * Retrieve details of a specific RFQ.
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const query = req.params.id.startsWith('RFQ-')
    ? { rfqNumber: req.params.id.toUpperCase() }
    : { _id: req.params.id };

  const rfq = await Rfq.findOne(query)
    .populate('buyer', 'name email country companyName verificationStatus')
    .populate('matchingLot')
    .populate('quotes.supplier', 'name email role state city phone');

  if (!rfq) throw new ApiError(404, 'RFQ not found');

  res.json({ rfq });
}));

/**
 * POST /api/rfqs/:id/quotes
 * Exporter, farmer, or aggregation manager submits a formal quotation for an open RFQ.
 */
router.post('/:id/quotes', asyncHandler(async (req, res) => {
  const {
    offeredQuantityKg,
    unitPriceInr,
    freightAndInsuranceInr = 0,
    leadTimeDays = 14,
    notes = ''
  } = req.body || {};

  if (!offeredQuantityKg || !unitPriceInr) {
    throw new ApiError(400, 'offeredQuantityKg and unitPriceInr are required');
  }

  const query = req.params.id.startsWith('RFQ-')
    ? { rfqNumber: req.params.id.toUpperCase() }
    : { _id: req.params.id };

  const rfq = await Rfq.findOne(query);
  if (!rfq) throw new ApiError(404, 'RFQ not found');

  if (['fulfilled', 'cancelled'].includes(rfq.status)) {
    throw new ApiError(400, 'Cannot quote on a closed or fulfilled RFQ');
  }

  const totalBase = Number(offeredQuantityKg) * Number(unitPriceInr);
  const totalCif = totalBase + Number(freightAndInsuranceInr);

  const quoteId = `QT-${Date.now().toString().slice(-6)}-${crypto.randomInt(100, 999)}`;

  const quote = {
    quoteId,
    supplier: req.user._id,
    supplierName: req.user.name,
    supplierRole: req.user.role,
    offeredQuantityKg: Number(offeredQuantityKg),
    unitPriceInr: Number(unitPriceInr),
    freightAndInsuranceInr: Number(freightAndInsuranceInr),
    totalPriceInr: totalCif,
    leadTimeDays: Number(leadTimeDays),
    validUntil: new Date(Date.now() + 14 * 86400000),
    status: 'pending',
    notes,
    createdAt: new Date()
  };

  rfq.quotes.push(quote);
  if (rfq.status === 'open') rfq.status = 'quoted';
  await rfq.save();

  notify(
    rfq.buyer,
    'rfq_quote_received',
    `You received a quote of ₹${totalCif} for RFQ ${rfq.rfqNumber} from ${req.user.name}`,
    `/rfqs/${rfq._id}`
  ).catch(() => {});

  res.status(201).json({
    message: 'Quotation submitted successfully',
    quote,
    rfq
  });
}));

/**
 * PATCH /api/rfqs/:id/quotes/:quoteId
 * Buyer responds to a quotation: accepts, rejects, or counter-offers.
 */
router.patch('/:id/quotes/:quoteId', asyncHandler(async (req, res) => {
  const { action, counterPriceInr, notes } = req.body || {};

  if (!['accept', 'reject', 'counter'].includes(action)) {
    throw new ApiError(400, 'Valid action (accept, reject, counter) required');
  }

  const query = req.params.id.startsWith('RFQ-')
    ? { rfqNumber: req.params.id.toUpperCase() }
    : { _id: req.params.id };

  const rfq = await Rfq.findOne(query);
  if (!rfq) throw new ApiError(404, 'RFQ not found');

  if (req.user.role !== 'admin' && String(rfq.buyer) !== String(req.user._id)) {
    throw new ApiError(403, 'Only the buyer who posted the RFQ can respond to quotes');
  }

  const quote = rfq.quotes.find((q) => q.quoteId === req.params.quoteId || String(q._id) === req.params.quoteId);
  if (!quote) throw new ApiError(404, 'Quotation not found');

  if (action === 'accept') {
    quote.status = 'accepted';
    rfq.acceptedQuoteId = quote.quoteId;
    rfq.status = 'accepted';
    // Reject other quotes
    rfq.quotes.forEach((q) => {
      if (q.quoteId !== quote.quoteId && q.status === 'pending') {
        q.status = 'rejected';
      }
    });
  } else if (action === 'reject') {
    quote.status = 'rejected';
  } else if (action === 'counter') {
    quote.status = 'countered';
    quote.counterPriceInr = Number(counterPriceInr);
    rfq.status = 'negotiating';
  }

  if (notes) quote.notes = notes;
  await rfq.save();

  notify(
    quote.supplier,
    'rfq_quote_update',
    `Buyer responded with '${action}' to your quote on RFQ ${rfq.rfqNumber}`,
    `/rfqs/${rfq._id}`
  ).catch(() => {});

  res.json({ message: `Quotation marked as ${quote.status}`, rfq, quote });
}));

/**
 * POST /api/rfqs/:id/convert-to-order
 * Buyer converts an accepted quotation into an official Purchase Order & Invoice.
 */
router.post('/:id/convert-to-order', asyncHandler(async (req, res) => {
  const query = req.params.id.startsWith('RFQ-')
    ? { rfqNumber: req.params.id.toUpperCase() }
    : { _id: req.params.id };

  const rfq = await Rfq.findOne(query);
  if (!rfq) throw new ApiError(404, 'RFQ not found');

  if (rfq.status !== 'accepted' || !rfq.acceptedQuoteId) {
    throw new ApiError(400, 'RFQ must have an accepted quotation to convert to an order');
  }

  if (rfq.order) {
    throw new ApiError(409, 'A purchase order has already been issued for this RFQ');
  }

  const acceptedQuote = rfq.quotes.find((q) => q.quoteId === rfq.acceptedQuoteId);
  if (!acceptedQuote) throw new ApiError(404, 'Accepted quote not found');

  // Find or create crop reference
  let crop = await Crop.findOne({ name: new RegExp(`^${rfq.cropName}`, 'i') });
  if (!crop) {
    crop = await Crop.findOne();
  }
  if (!crop) {
    crop = await Crop.create({
      name: rfq.cropName,
      category: rfq.category || 'Vegetables',
      quantity: acceptedQuote.offeredQuantityKg,
      unit: 'kg',
      priceInr: acceptedQuote.unitPriceInr,
      location: 'Export Aggregation Hub',
      state: 'Karnataka',
      farmer: acceptedQuote.supplier,
      grade: rfq.grade === 'Any' ? 'A' : rfq.grade
    });
  }

  const invoiceNumber = generateInvoiceNumber();
  const idempotencyKey = `PO-${rfq.rfqNumber}-${Date.now()}`;

  const order = new Order({
    buyer: rfq.buyer,
    farmer: acceptedQuote.supplier,
    crop: crop._id,
    cropName: rfq.cropName,
    quantity: acceptedQuote.offeredQuantityKg,
    unit: 'kg',
    unitPriceInr: acceptedQuote.unitPriceInr,
    totalInr: acceptedQuote.totalPriceInr,
    buyerCountry: rfq.buyerCountry,
    buyerCurrency: rfq.currency || 'USD',
    note: `Purchase Order generated from RFQ ${rfq.rfqNumber} (Terms: ${rfq.deliveryTerms} ${rfq.deliveryDestination})`,
    status: 'Confirmed',
    idempotencyKey,
    invoiceNumber,
    rfq: rfq._id,
    rfqNumber: rfq.rfqNumber,
    aggregationLot: rfq.matchingLot || undefined,
    destinationPort: rfq.portOfDischarge || rfq.deliveryDestination,
    deliveryTerms: rfq.deliveryTerms,
    paymentStatus: 'pending',
    shipmentTracking: {
      status: 'booked',
      carrier: 'Commercial Freight Partner',
      eta: rfq.requiredByDate
    }
  });

  await order.save();

  rfq.order = order._id;
  rfq.status = 'fulfilled';
  await rfq.save();

  res.status(201).json({
    message: 'Purchase Order and Commercial Invoice created successfully',
    order,
    invoiceNumber,
    rfq
  });
}));

export default router;
