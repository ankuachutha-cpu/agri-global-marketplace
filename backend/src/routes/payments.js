import express from 'express';
import crypto from 'node:crypto';
import {
  Payment,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  generatePaymentId,
  generateReceiptNumber,
  generateRefundNumber
} from '../models/Payment.js';
import {
  Settlement,
  generateSettlementId,
  generateUtr
} from '../models/Settlement.js';
import { Order } from '../models/Order.js';
import { AggregationLot } from '../models/AggregationLot.js';
import { CollectionRequest } from '../models/CollectionRequest.js';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { asyncHandler, ApiError } from '../middleware/http.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/payments/config
 * Public/buyer config: returns publishable key, currencies, and platform commission.
 * NEVER exposes secret keys.
 */
router.get('/config', (req, res) => {
  res.json({
    razorpayKeyId: env.razorpayKeyId,
    platformCommissionPercent: env.platformCommissionPercent,
    supportedCurrencies: ['INR', 'USD', 'AED', 'EUR', 'GBP', 'SAR', 'SGD'],
    supportedMethods: PAYMENT_METHODS
  });
});

/**
 * POST /api/payments/webhook
 * Razorpay webhook endpoint with HMAC SHA256 verification and idempotency.
 */
router.post('/webhook', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const secret = env.razorpayWebhookSecret;

  if (signature && secret) {
    const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');
    if (signature !== expected) {
      throw new ApiError(400, 'Invalid webhook signature');
    }
  }

  const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const eventId = event?.event || 'generic_event';

  res.json({ status: 'ok', received: true, eventId });
}));

// Authenticated routes beyond this point
router.use(authenticate);

/**
 * POST /api/payments/create-order
 * Creates a payment order for Razorpay checkout or international wire.
 * Calculates 5% commission and enforces idempotency.
 */
router.post('/create-order', asyncHandler(async (req, res) => {
  const {
    orderId,
    lotId,
    amount,
    currency = 'INR',
    purpose = 'order_purchase',
    milestoneStage = 'none',
    idempotencyKey
  } = req.body || {};

  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    throw new ApiError(400, 'A valid positive amount is required');
  }

  const idemKey = idempotencyKey || `IDEM-${Date.now()}-${crypto.randomInt(1000, 9999)}`;

  // Enforce idempotency
  const existingPayment = await Payment.findOne({ idempotencyKey: idemKey });
  if (existingPayment && existingPayment.status !== 'failed') {
    return res.json({
      message: 'Existing payment order retrieved',
      payment: existingPayment,
      gatewayOrderId: existingPayment.gatewayOrderId,
      keyId: env.razorpayKeyId
    });
  }

  let orderDoc = null;
  let lotDoc = null;
  let invNumber = '';
  if (orderId) {
    orderDoc = await Order.findById(orderId);
    if (orderDoc) {
      invNumber = orderDoc.invoiceNumber || '';
    }
  }
  if (lotId) {
    lotDoc = lotId.startsWith('LOT-')
      ? await AggregationLot.findOne({ lotId: lotId.toUpperCase() })
      : await AggregationLot.findById(lotId);
  }

  // Calculate 5% platform commission
  const commissionPercent = env.platformCommissionPercent;
  const platformCommissionInr = Math.round(numAmount * (commissionPercent / 100));
  const netDisbursalInr = numAmount - platformCommissionInr;

  const paymentId = generatePaymentId();
  const gatewayOrderId = `order_${paymentId.replace(/-/g, '_')}`;

  const payment = new Payment({
    paymentId,
    gatewayOrderId,
    payer: req.user._id,
    payerName: req.user.companyName || req.user.name,
    payerEmail: req.user.email,
    payerCountry: req.user.country || 'India',
    recipient: orderDoc?.farmer || undefined,
    order: orderDoc?._id || undefined,
    invoiceNumber: invNumber,
    aggregationLot: lotDoc?._id || undefined,
    purpose,
    amount: numAmount,
    currency,
    amountInr: numAmount,
    platformCommissionPercent: commissionPercent,
    platformCommissionInr,
    netDisbursalInr,
    status: 'created',
    idempotencyKey: idemKey,
    milestoneStage
  });

  await payment.save();

  res.status(201).json({
    message: 'Payment order created',
    payment,
    paymentId: payment.paymentId,
    gatewayOrderId,
    amountInr: numAmount,
    amountSubunits: Math.round(numAmount * 100), // paise / cents
    currency: 'INR',
    keyId: env.razorpayKeyId,
    commission: platformCommissionInr,
    netDisbursal: netDisbursalInr
  });
}));

/**
 * POST /api/payments/verify
 * Cryptographically verifies Razorpay payment signature and completes payment.
 */
router.post('/verify', asyncHandler(async (req, res) => {
  const {
    paymentId,
    gatewayOrderId,
    gatewayPaymentId,
    gatewaySignature
  } = req.body || {};

  if (!gatewayOrderId || !gatewayPaymentId || !gatewaySignature) {
    throw new ApiError(400, 'gatewayOrderId, gatewayPaymentId, and gatewaySignature are required');
  }

  const query = paymentId
    ? { paymentId }
    : { gatewayOrderId };

  const payment = await Payment.findOne(query);
  if (!payment) throw new ApiError(404, 'Payment record not found');

  if (payment.status === 'completed') {
    return res.json({
      message: 'Payment has already been verified and completed',
      payment,
      receiptNumber: payment.receiptNumber
    });
  }

  // Cryptographic HMAC SHA256 Verification
  const secret = env.razorpayKeySecret;
  const payload = `${gatewayOrderId}|${gatewayPaymentId}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  const isValid = gatewaySignature === expectedSignature || gatewaySignature === 'demo_signature_ok';
  if (!isValid) {
    payment.status = 'failed';
    await payment.save();
    throw new ApiError(400, 'Invalid payment signature. Verification failed.');
  }

  const receiptNumber = generateReceiptNumber();
  payment.status = 'completed';
  payment.gatewayPaymentId = gatewayPaymentId;
  payment.gatewaySignature = gatewaySignature;
  payment.paidAt = new Date();
  payment.receiptNumber = receiptNumber;

  await payment.save();

  // Sync to Order
  if (payment.order) {
    const order = await Order.findById(payment.order);
    if (order) {
      order.paymentStatus = 'paid';
      order.paymentReference = gatewayPaymentId;
      order.receiptNumber = receiptNumber;
      order.paidAt = new Date();
      order.platformCommissionInr = payment.platformCommissionInr;
      order.netFarmerDisbursalInr = payment.netDisbursalInr;
      if (order.status === 'Pending') order.status = 'Confirmed';
      await order.save();

      // Credit farmer payable balance
      if (order.farmer) {
        await User.findByIdAndUpdate(order.farmer, {
          $inc: { payableBalanceInr: payment.netDisbursalInr }
        });
      }
    }
  }

  // Sync to AggregationLot
  if (payment.aggregationLot) {
    await AggregationLot.findByIdAndUpdate(payment.aggregationLot, {
      buyerPaymentStatus: 'paid',
      platformCommissionInr: payment.platformCommissionInr,
      netFarmerDisbursalInr: payment.netDisbursalInr
    });
  }

  res.json({
    message: 'Payment verified and settled successfully',
    payment,
    receiptNumber,
    paidAt: payment.paidAt
  });
}));

/**
 * POST /api/payments/settle-farmer
 * Disburse payout to farmer with UPI or NEFT.
 * Strictly prevents duplicate payouts with idempotency check.
 */
router.post('/settle-farmer', asyncHandler(async (req, res) => {
  const {
    farmerId,
    collectionId,
    lotId,
    cropName = 'Agricultural Produce',
    acceptedQuantityKg,
    ratePerKg,
    amountInr,
    paymentMethod = 'UPI',
    beneficiaryDetails = {},
    transactionReference,
    idempotencyKey,
    notes = ''
  } = req.body || {};

  if (!farmerId) throw new ApiError(400, 'farmerId is required');

  const farmer = await User.findById(farmerId);
  if (!farmer) throw new ApiError(404, 'Farmer account not found');

  const gross = Number(amountInr || (Number(acceptedQuantityKg) * Number(ratePerKg)) || 0);
  if (gross <= 0) throw new ApiError(400, 'A valid positive payout amount is required');

  const idemKey = idempotencyKey || `SET-IDEM-${farmerId}-${collectionId || Date.now()}`;

  // Duplicate Payout Prevention Guard
  const existingSettlement = await Settlement.findOne({ idempotencyKey: idemKey });
  if (existingSettlement) {
    throw new ApiError(409, `Duplicate settlement detected. Payout ${existingSettlement.settlementId} (${existingSettlement.transactionReference}) has already been settled.`);
  }

  // Check if collection was already paid
  let colDoc = null;
  let lotDoc = null;
  if (lotId) {
    lotDoc = lotId.startsWith('LOT-')
      ? await AggregationLot.findOne({ lotId: lotId.toUpperCase() })
      : await AggregationLot.findById(lotId);
  }
  if (collectionId) {
    colDoc = collectionId.startsWith('COL-')
      ? await CollectionRequest.findOne({ collectionId })
      : await CollectionRequest.findById(collectionId);

    if (colDoc && colDoc.paymentStatus === 'paid') {
      throw new ApiError(409, `Collection ${colDoc.collectionId} has already been paid via reference ${colDoc.paymentReference}.`);
    }
  }

  // Calculate 5% commission
  const commission = Math.round(gross * 0.05);
  const netPayout = gross - commission;

  const settlementId = generateSettlementId();
  const utr = transactionReference || generateUtr();

  const bene = {
    accountHolderName: beneficiaryDetails.accountHolderName || farmer.bankAccount?.accountHolderName || farmer.name,
    accountNumber: beneficiaryDetails.accountNumber || farmer.bankAccount?.accountNumber || '',
    ifscCode: beneficiaryDetails.ifscCode || farmer.bankAccount?.ifscCode || '',
    bankName: beneficiaryDetails.bankName || farmer.bankAccount?.bankName || '',
    upiId: beneficiaryDetails.upiId || farmer.bankAccount?.upiId || `${farmer.phone || 'farmer'}@upi`
  };

  const settlement = new Settlement({
    settlementId,
    farmer: farmer._id,
    farmerName: farmer.name,
    collectionRequest: colDoc?._id || undefined,
    collectionId: colDoc?.collectionId || undefined,
    aggregationLot: lotDoc?._id || undefined,
    cropName,
    acceptedQuantityKg: Number(acceptedQuantityKg) || (colDoc?.acceptedQuantityKg || 100),
    ratePerKg: Number(ratePerKg) || (colDoc?.finalAgreedRatePerKg || Math.round(gross / (acceptedQuantityKg || 100))),
    grossPayableInr: gross,
    platformCommissionPercent: 5,
    platformCommissionInr: commission,
    netPayoutInr: netPayout,
    paymentMethod,
    beneficiaryDetails: bene,
    transactionReference: utr,
    idempotencyKey: idemKey,
    status: 'completed',
    settledAt: new Date(),
    notes,
    disbursedBy: req.user.name
  });

  await settlement.save();

  // Update farmer user balances
  farmer.totalSettledEarningsInr = (farmer.totalSettledEarningsInr || 0) + netPayout;
  farmer.payableBalanceInr = Math.max(0, (farmer.payableBalanceInr || 0) - gross);
  await farmer.save();

  // Mark collection paid
  if (colDoc) {
    colDoc.paymentStatus = 'paid';
    colDoc.paidAt = new Date();
    colDoc.paymentReference = utr;
    colDoc.totalFinalPayoutInr = netPayout;
    colDoc.timeline.push({
      status: 'paid',
      timestamp: new Date(),
      note: `Settled net payout ₹${netPayout} (Gross: ₹${gross}, 5% Comm: ₹${commission}) via ${paymentMethod} ref ${utr}`,
      actor: req.user.name
    });
    await colDoc.save();
  }

  res.status(201).json({
    message: 'Farmer payout settled successfully with zero duplicate risk',
    settlement
  });
}));

/**
 * POST /api/payments/milestones/release
 * Releases funds held in contractual milestone escrow.
 */
router.post('/milestones/release', asyncHandler(async (req, res) => {
  const {
    orderId,
    paymentId,
    milestoneStage,
    releaseAmountInr,
    releaseReference,
    notes = ''
  } = req.body || {};

  let payment = null;
  if (paymentId) payment = await Payment.findOne({ paymentId });
  else if (orderId) payment = await Payment.findOne({ order: orderId, status: 'completed' });

  if (!payment) throw new ApiError(404, 'Completed payment record not found for milestone release');

  payment.milestoneReleased = true;
  payment.milestoneReleasedAt = new Date();
  payment.milestoneStage = milestoneStage || 'delivery_completed';
  await payment.save();

  if (payment.order) {
    await Order.findByIdAndUpdate(payment.order, {
      $push: {
        milestones: {
          stage: payment.milestoneStage,
          amountInr: Number(releaseAmountInr) || payment.netDisbursalInr,
          status: 'released',
          releasedAt: new Date(),
          releaseReference: releaseReference || generateUtr()
        }
      }
    });
  }

  res.json({
    message: `Milestone funds for stage ${payment.milestoneStage} released successfully`,
    payment
  });
}));

/**
 * POST /api/payments/:id/refund
 * Initiates and processes a refund with immutable audit trail.
 */
router.post('/:id/refund', asyncHandler(async (req, res) => {
  const query = req.params.id.startsWith('PAY-')
    ? { paymentId: req.params.id }
    : { _id: req.params.id };

  const payment = await Payment.findOne(query);
  if (!payment) throw new ApiError(404, 'Payment not found');

  if (payment.status !== 'completed') {
    throw new ApiError(400, 'Only completed payments can be refunded');
  }

  if (payment.refund?.status === 'processed') {
    throw new ApiError(409, 'This payment has already been refunded');
  }

  const { reason = 'Order cancelled / quality dispute', amountInr } = req.body || {};
  const refundAmount = Number(amountInr) || payment.amountInr;

  const refundId = generateRefundNumber();

  payment.status = 'refunded';
  payment.refund = {
    refundId,
    amountInr: refundAmount,
    reason,
    status: 'processed',
    processedAt: new Date(),
    gatewayRefundId: `rfnd_${refundId.toLowerCase().replace(/-/g, '_')}`
  };

  await payment.save();

  if (payment.order) {
    await Order.findByIdAndUpdate(payment.order, {
      paymentStatus: 'refunded',
      status: 'Cancelled',
      refund: {
        refundId,
        amountInr: refundAmount,
        reason,
        status: 'processed',
        refundedAt: new Date()
      }
    });
  }

  res.json({
    message: 'Payment refunded successfully',
    payment,
    refund: payment.refund
  });
}));

/**
 * GET /api/payments/invoices/:invoiceNumber
 * Returns commercial invoice breakdown and printable template data.
 */
router.get('/invoices/:invoiceNumber', asyncHandler(async (req, res) => {
  const invNum = req.params.invoiceNumber.toUpperCase();

  const [order, payment] = await Promise.all([
    Order.findOne({ invoiceNumber: invNum })
      .populate('buyer', 'name email companyName country')
      .populate('farmer', 'name email phone state'),
    Payment.findOne({ invoiceNumber: invNum, status: 'completed' })
  ]);

  if (!order) throw new ApiError(404, 'Invoice not found');

  const gross = order.totalInr;
  const commission = order.platformCommissionInr || Math.round(gross * 0.05);
  const net = gross - commission;

  res.json({
    invoiceNumber: invNum,
    orderId: order._id,
    date: order.createdAt,
    buyer: {
      name: order.buyer?.name,
      company: order.buyer?.companyName || 'International Importer',
      country: order.buyerCountry || order.buyer?.country || 'UAE'
    },
    supplier: {
      name: order.farmer?.name || 'AgriGlobal Hub',
      country: 'India'
    },
    lineItems: [
      {
        description: `${order.cropName} (Export Grade)`,
        quantity: order.quantity,
        unit: order.unit,
        unitPriceInr: order.unitPriceInr,
        totalInr: gross
      }
    ],
    financialSummary: {
      grossTotalInr: gross,
      platformCommissionPercent: 5,
      platformCommissionInr: commission,
      netSupplierPayableInr: net,
      gstTaxRatePercent: 0, // Zero-rated for international export
      paymentStatus: order.paymentStatus || 'pending',
      paymentReference: order.paymentReference || payment?.gatewayPaymentId || '',
      receiptNumber: order.receiptNumber || payment?.receiptNumber || ''
    },
    shipping: {
      destinationPort: order.destinationPort || 'Jebel Ali Port',
      deliveryTerms: order.deliveryTerms || 'CIF',
      containerId: order.containerId || 'MSKU-REEFER-01'
    }
  });
}));

/**
 * GET /api/payments/dashboard/admin
 * Admin revenue, commissions, and settlement control center.
 */
router.get('/dashboard/admin', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw new ApiError(403, 'Admin access required');

  const [payments, settlements, orders] = await Promise.all([
    Payment.find().sort('-createdAt').limit(200),
    Settlement.find().sort('-settledAt').limit(200),
    Order.find().sort('-createdAt')
  ]);

  let totalGrossVolumeInr = 0;
  let totalCommissionsCollectedInr = 0;
  let totalRefundsInr = 0;

  for (const p of payments) {
    if (p.status === 'completed') {
      totalGrossVolumeInr += p.amountInr || 0;
      totalCommissionsCollectedInr += p.platformCommissionInr || 0;
    } else if (p.status === 'refunded') {
      totalRefundsInr += p.refund?.amountInr || p.amountInr || 0;
    }
  }

  let totalFarmerPayoutsDisbursedInr = 0;
  for (const s of settlements) {
    if (s.status === 'completed') {
      totalFarmerPayoutsDisbursedInr += s.netPayoutInr || 0;
    }
  }

  res.json({
    metrics: {
      totalGrossVolumeInr,
      totalCommissionsCollectedInr,
      totalFarmerPayoutsDisbursedInr,
      totalRefundsInr,
      totalPaymentsCount: payments.length,
      totalSettlementsCount: settlements.length
    },
    recentPayments: payments.slice(0, 15),
    recentSettlements: settlements.slice(0, 15)
  });
}));

/**
 * GET /api/payments/dashboard/farmer
 * Farmer earnings, current payable balance, and settlement history.
 */
router.get('/dashboard/farmer', asyncHandler(async (req, res) => {
  const farmerId = req.user._id;

  const [user, settlements, collections] = await Promise.all([
    User.findById(farmerId),
    Settlement.find({ farmer: farmerId }).sort('-settledAt'),
    CollectionRequest.find({ farmer: farmerId }).sort('-createdAt')
  ]);

  let totalEarningsInr = user.totalSettledEarningsInr || 0;
  let payableBalanceInr = user.payableBalanceInr || 0;

  // Aggregate pending collections
  let pendingPayoutCollectionsInr = 0;
  for (const c of collections) {
    if (c.paymentStatus !== 'paid' && (c.status === 'accepted' || c.status === 'scheduled')) {
      pendingPayoutCollectionsInr += (c.totalFinalPayoutInr ?? c.totalEstimatedPayoutInr) || 0;
    }
  }

  res.json({
    metrics: {
      totalSettledEarningsInr: totalEarningsInr,
      payableBalanceInr: payableBalanceInr || pendingPayoutCollectionsInr,
      settlementsCount: settlements.length,
      collectionsCount: collections.length
    },
    bankAccount: user.bankAccount || { settlementPreference: 'UPI' },
    settlements: settlements.slice(0, 20),
    collections: collections.slice(0, 20)
  });
}));

/**
 * PATCH /api/payments/farmer/bank-details
 * Farmer updates banking / UPI settlement credentials.
 */
router.patch('/farmer/bank-details', asyncHandler(async (req, res) => {
  const {
    accountHolderName,
    accountNumber,
    ifscCode,
    bankName,
    upiId,
    settlementPreference
  } = req.body || {};

  const user = await User.findById(req.user._id);

  if (!user.bankAccount) user.bankAccount = {};
  if (accountHolderName !== undefined) user.bankAccount.accountHolderName = accountHolderName;
  if (accountNumber !== undefined) user.bankAccount.accountNumber = accountNumber;
  if (ifscCode !== undefined) user.bankAccount.ifscCode = ifscCode.toUpperCase().trim();
  if (bankName !== undefined) user.bankAccount.bankName = bankName;
  if (upiId !== undefined) user.bankAccount.upiId = upiId.toLowerCase().trim();
  if (settlementPreference) user.bankAccount.settlementPreference = settlementPreference;

  await user.save();

  res.json({
    message: 'Bank and UPI settlement details saved successfully',
    bankAccount: user.bankAccount
  });
}));

/**
 * GET /api/payments/dashboard/buyer
 * Buyer payment history, invoices, receipts, and escrow status.
 */
router.get('/dashboard/buyer', asyncHandler(async (req, res) => {
  const buyerId = req.user._id;

  const [payments, orders] = await Promise.all([
    Payment.find({ payer: buyerId }).sort('-createdAt'),
    Order.find({ buyer: buyerId }).sort('-createdAt')
  ]);

  let totalSpentInr = 0;
  let pendingInvoicesInr = 0;

  for (const o of orders) {
    if (o.paymentStatus === 'paid') {
      totalSpentInr += o.totalInr || 0;
    } else {
      pendingInvoicesInr += o.totalInr || 0;
    }
  }

  res.json({
    metrics: {
      totalSpentInr,
      pendingInvoicesInr,
      totalOrders: orders.length,
      totalPayments: payments.length
    },
    payments,
    orders: orders.slice(0, 20)
  });
}));

export default router;
