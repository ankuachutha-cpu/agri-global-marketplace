import { Router } from 'express';
import { Company } from '../models/Company.js';
import { User } from '../models/User.js';
import { BuyingRequest, activeFilter, requestState, STALE_DAYS } from '../models/BuyingRequest.js';
import { logAdminAction } from '../models/AuditLog.js';
import { notify } from '../services/notify.js';
import { asyncHandler, ApiError, validate, objectId } from '../middleware/http.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { buyingRequestSchema, evidenceSchema } from '../validators/schemas.js';
import { stem, esc, normCountry } from '../services/matching_extra.js';
import { z } from 'zod';

export const globalBuyers = Router();
export const buyingRequests = Router();
const NOTE = 'Importers listed here publicly handle these products. "Currently Buying" appears only when an admin has verified a recent, unexpired buying request from a cited source.';
globalBuyers.use(authenticate);

const qSchema = z.object({
  crop: z.string().trim().max(60).optional(), country: z.string().trim().max(60).optional(), q: z.string().trim().max(100).optional(),
  state: z.string().trim().max(60).optional(), city: z.string().trim().max(60).optional(),
  buyerType: z.enum(['importer', 'wholesaler', 'distributor', 'retailer', 'processor', 'other']).optional(), category: z.string().trim().max(60).optional(),
  status: z.enum(['currently_buying', 'potential']).optional(),
  tier: z.enum(['all', 'registered', 'verified', 'potential']).default('verified'),
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(12),
});
const reqCropFilter = (crop) => (crop ? { crop: new RegExp(esc(stem(crop))) } : {});

globalBuyers.get('/', validate(qSchema, 'query'), asyncHandler(async (req, res) => {
  const { crop, country, q, state, city, buyerType, category, status, tier, page, limit } = req.query;
  const now = new Date();

  // Summary counts across all 3 tiers
  const [registeredCount, verifiedCount, potentialCount] = await Promise.all([
    User.countDocuments({ role: 'buyer', active: true }),
    Company.countDocuments({ type: 'international_importer', verificationStatus: 'verified' }),
    Company.countDocuments({ type: 'international_importer', verificationStatus: 'unverified' })
  ]);

  // CATEGORY A: REGISTERED BUYERS
  if (tier === 'registered') {
    const userFilter = { role: 'buyer', active: true };
    if (q) userFilter.$or = [{ name: new RegExp(esc(q), 'i') }, { organization: new RegExp(esc(q), 'i') }];
    if (country) userFilter.country = new RegExp(`^${esc(normCountry(country))}$`, 'i');

    const [users, total] = await Promise.all([
      User.find(userFilter).select('name email phone country city state organization currency createdAt verified').sort('-createdAt').skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(userFilter)
    ]);

    const items = users.map((u) => ({
      _id: u._id,
      name: u.organization || u.name,
      contactPerson: u.name,
      country: u.country,
      city: u.city || '',
      state: u.state || '',
      email: u.email,
      phone: u.phone || '',
      buyerType: 'importer',
      productsHandled: ['agricultural commodities', 'fresh produce', 'grains'],
      tier: 'registered',
      tierLabel: 'Registered Platform Buyer',
      isRegistered: true,
      isVerified: true,
      buyingStatus: 'Registered Buyer',
      joinedAt: u.createdAt
    }));

    return res.json({
      items,
      total,
      page,
      pages: Math.ceil(total / limit),
      counts: { registered: registeredCount, verified: verifiedCount, potential: potentialCount },
      note: 'Registered buyers with active verified accounts on AgriGlobal.'
    });
  }

  // CATEGORY C: POTENTIAL BUYERS (EXTERNAL BUSINESS LEADS)
  const isPotential = tier === 'potential';
  const f = {
    type: 'international_importer',
    verificationStatus: isPotential ? 'unverified' : 'verified'
  };

  if (crop) f.productsHandled = new RegExp(esc(stem(crop)));
  if (country) f.country = new RegExp(`^${esc(normCountry(country))}$`, 'i');
  if (state) f.state = new RegExp(`^${esc(state)}$`, 'i');
  if (city) f.city = new RegExp(`^${esc(city)}$`, 'i');
  if (q) f.name = new RegExp(esc(q), 'i');
  if (buyerType) f.buyerType = buyerType;
  if (category) f.productCategories = new RegExp(esc(category.toLowerCase()));
  if (status) {
    const ids = await BuyingRequest.distinct('company', { ...activeFilter(now), ...reqCropFilter(crop) });
    f._id = status === 'currently_buying' ? { $in: ids } : { $nin: ids };
  }

  const [items, total] = await Promise.all([
    Company.find(f).sort('name').skip((page - 1) * limit).limit(limit).lean(),
    Company.countDocuments(f)
  ]);

  const reqs = await BuyingRequest.find({ ...activeFilter(now), company: { $in: items.map((c) => c._id) }, ...reqCropFilter(crop) }).sort('-requestDate').lean();
  const byCompany = {}; for (const r of reqs) (byCompany[r.company] ||= []).push(r);

  const mapped = items.map((c) => ({
    ...c,
    tier: isPotential ? 'potential' : 'verified',
    tierLabel: isPotential ? 'Potential Buyer (Unregistered Lead)' : 'Verified International Importer',
    isRegistered: false,
    isVerified: !isPotential,
    disclaimer: isPotential ? 'External business lead. Unregistered and credentials unverified until formal review.' : undefined,
    activeRequests: byCompany[c._id] || [],
    buyingStatus: byCompany[c._id]?.length ? 'Currently Buying' : (isPotential ? 'Lead / Unverified' : 'Potential Buyer')
  }));

  res.json({
    items: mapped,
    total,
    page,
    pages: Math.ceil(total / limit),
    counts: { registered: registeredCount, verified: verifiedCount, potential: potentialCount },
    note: isPotential
      ? 'Unregistered potential buyer leads from global trade directories. Verification required.'
      : NOTE
  });
}));

/**
 * INVITE POTENTIAL BUYER TO ONBOARD AND REGISTER
 */
globalBuyers.post('/:id/invite', asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) throw new ApiError(404, 'Company lead not found');

  const inviteUrl = `https://agriglobal.example.com/register?role=buyer&companyId=${company._id}&company=${encodeURIComponent(company.name)}`;

  await logAdminAction({
    action: 'INVITE_POTENTIAL_BUYER',
    req,
    targetModel: 'Company',
    targetId: company._id,
    description: `Invited potential buyer "${company.name}" (${company.country}) to onboard and register.`,
    metadata: { companyId: company._id, companyName: company.name, email: company.email, inviteUrl }
  });

  res.json({
    message: `Invitation generated for ${company.name}`,
    inviteUrl,
    recipientEmail: company.email || 'procurement@' + (company.website?.replace(/^https?:\/\//, '') || 'company.com')
  });
}));

/**
 * VERIFY CREDENTIALS OF POTENTIAL BUYER (ADMIN)
 */
globalBuyers.patch('/:id/verify-credentials', requireRole('admin'), validate(evidenceSchema), asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) throw new ApiError(404, 'Company record not found');

  company.verificationStatus = 'verified';
  company.verificationEvidence = req.body.evidence;
  company.lastVerifiedAt = new Date();
  company.lastCheckedAt = new Date();
  await company.save();

  await logAdminAction({
    action: 'VERIFY_BUYER_CREDENTIALS',
    req,
    targetModel: 'Company',
    targetId: company._id,
    description: `Admin verified credentials for company "${company.name}": ${req.body.evidence}`,
    metadata: { companyId: company._id, evidence: req.body.evidence }
  });

  res.json({ message: 'Company credentials verified successfully', company });
}));
globalBuyers.get('/requests', validate(qSchema.pick({ crop: true, country: true, page: true, limit: true }), 'query'), asyncHandler(async (req, res) => {
  const { crop, country, page, limit } = req.query; const now = new Date();
  const companyF = { type: 'international_importer', verificationStatus: 'verified' };
  if (country) companyF.country = new RegExp(`^${esc(normCountry(country))}$`, 'i');
  const companyIds = await Company.distinct('_id', companyF);
  const f = { ...activeFilter(now), company: { $in: companyIds }, ...reqCropFilter(crop) };
  const [items, total] = await Promise.all([BuyingRequest.find(f).populate('company', 'name country city website email phone whatsapp contactPage').sort('-requestDate').skip((page - 1) * limit).limit(limit), BuyingRequest.countDocuments(f)]);
  res.json({ items, total, page, pages: Math.ceil(total / limit), staleAfterDays: STALE_DAYS,
    emptyMessage: total ? undefined : 'No verified active buying requests available.' });
}));
globalBuyers.get('/:id', asyncHandler(async (req, res) => {
  const c = objectId.safeParse(req.params.id).success && await Company.findOne({ _id: req.params.id, type: 'international_importer', verificationStatus: 'verified' }).lean();
  if (!c) throw new ApiError(404, 'Company not found');
  const activeRequests = await BuyingRequest.find({ ...activeFilter(), company: c._id }).sort('-requestDate').lean();
  res.json({ company: { ...c, activeRequests, buyingStatus: activeRequests.length ? 'Currently Buying' : 'Potential Buyer' }, note: NOTE });
}));

// Admin management of buying requests. Verification requires written evidence.
buyingRequests.use(authenticate, requireRole('admin'));
const withState = (r) => ({ ...(r.toObject?.() ?? r), state: requestState(r) });
buyingRequests.get('/all', asyncHandler(async (_req, res) => res.json({ items: (await BuyingRequest.find().populate('company', 'name country').sort('-requestDate').limit(500)).map(withState) })));
buyingRequests.post('/', validate(buyingRequestSchema), asyncHandler(async (req, res) => {
  if (!(await Company.exists({ _id: req.body.company }))) throw new ApiError(404, 'Company not found');
  res.status(201).json({ item: withState(await BuyingRequest.create(req.body)) });
}));
buyingRequests.put('/:id', validate(buyingRequestSchema.partial()), asyncHandler(async (req, res) => {
  if (!objectId.safeParse(req.params.id).success) throw new ApiError(404, 'Not found');
  const r = await BuyingRequest.findByIdAndUpdate(req.params.id, { ...req.body, verificationStatus: 'unverified' }, { new: true, runValidators: true });
  if (!r) throw new ApiError(404, 'Not found'); res.json({ item: withState(r) });
}));
buyingRequests.post('/:id/verify', validate(evidenceSchema), asyncHandler(async (req, res) => {
  const r = objectId.safeParse(req.params.id).success && await BuyingRequest.findByIdAndUpdate(req.params.id, { verificationStatus: 'verified', verificationEvidence: req.body.evidence, lastCheckedAt: new Date() }, { new: true });
  if (!r) throw new ApiError(404, 'Not found'); res.json({ item: withState(r) });
}));
buyingRequests.post('/:id/recheck', asyncHandler(async (req, res) => {
  const r = objectId.safeParse(req.params.id).success && await BuyingRequest.findOneAndUpdate({ _id: req.params.id, verificationStatus: 'verified' }, { lastCheckedAt: new Date() }, { new: true });
  if (!r) throw new ApiError(404, 'Verified request not found'); res.json({ item: withState(r) });
}));
buyingRequests.post('/:id/close', asyncHandler(async (req, res) => {
  const r = objectId.safeParse(req.params.id).success && await BuyingRequest.findByIdAndUpdate(req.params.id, { status: 'closed' }, { new: true });
  if (!r) throw new ApiError(404, 'Not found'); res.json({ item: withState(r) });
}));
buyingRequests.delete('/:id', asyncHandler(async (req, res) => {
  if (!objectId.safeParse(req.params.id).success || !(await BuyingRequest.findByIdAndDelete(req.params.id))) throw new ApiError(404, 'Not found'); res.json({ message: 'Deleted' });
}));
