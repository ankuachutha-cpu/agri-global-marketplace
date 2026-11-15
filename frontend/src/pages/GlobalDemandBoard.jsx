import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi.js';
import api, { errMsg } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { Spinner, ErrorBox, Empty, PageHeader, Badge, Notice } from '../components/ui.jsx';
import { GLOBAL_COUNTRIES, flag } from '../utils/format.js';

export default function GlobalDemandBoard() {
  const { user } = useAuth();
  const { fmt } = useCurrency();

  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [status, setStatus] = useState('');
  const [grade, setGrade] = useState('');

  // Contribution modal state
  const [contributeDemand, setContributeDemand] = useState(null);
  const [selectedCropId, setSelectedCropId] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [offeredPriceInr, setOfferedPriceInr] = useState('');
  const [packagingNotes, setPackagingNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalSuccess, setModalSuccess] = useState('');
  const [modalError, setModalError] = useState('');

  // Cancellation modal state
  const [cancellingContrib, setCancellingContrib] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Demands list
  const params = {
    ...(search && { q: search }),
    ...(country && { country }),
    ...(status && { status }),
    ...(grade && { grade }),
    limit: 30
  };
  const { data, loading, error, reload } = useApi('/demands', params);

  // Demand Analytics Summary
  const { data: analyticsData } = useApi('/demands/analytics/summary');

  // AI Matching recommendations for farmers
  const { data: aiMatchesData } = useApi(user?.role === 'farmer' ? '/demands/match/farmer-crops' : null);

  // Farmer's crops to contribute from
  const { data: farmerCropsData } = useApi(user?.role === 'farmer' ? '/crops/mine' : null);

  const demandsList = data?.items || [];
  const overview = analyticsData?.overview || {};

  const handleOpenContributeModal = (demand) => {
    setContributeDemand(demand);
    setModalSuccess('');
    setModalError('');
    setQuantityKg('');
    setPackagingNotes('');

    // Pre-select matching farmer crop if available
    const matchingCrops = farmerCropsData?.items?.filter((c) => {
      const free = c.quantity - (c.allocatedQuantity || 0);
      return free > 0 && c.name.toLowerCase().includes(demand.cropName.toLowerCase());
    }) || [];

    if (matchingCrops.length > 0) {
      setSelectedCropId(matchingCrops[0]._id);
      setOfferedPriceInr(demand.targetPricePerKg || matchingCrops[0].priceInr || 40);
      setQuantityKg(Math.min(matchingCrops[0].quantity - (matchingCrops[0].allocatedQuantity || 0), demand.remainingQuantityKg));
    } else {
      setSelectedCropId('');
      setOfferedPriceInr(demand.targetPricePerKg || 40);
    }
  };

  const handleContributeSubmit = async (e) => {
    e.preventDefault();
    if (!contributeDemand || !selectedCropId) return;

    setSubmitting(true);
    setModalError('');
    setModalSuccess('');

    try {
      const res = await api.post(`/demands/${contributeDemand._id}/contribute`, {
        cropId: selectedCropId,
        quantityKg: Number(quantityKg),
        offeredPriceInr: Number(offeredPriceInr),
        notes: packagingNotes
      });

      setModalSuccess(`Produce successfully committed! Contribution ID: ${res.data?.contribution?.contributionId || 'Confirmed'}. Free stock reserved for export lot.`);
      setTimeout(() => {
        setContributeDemand(null);
        reload();
      }, 1600);
    } catch (err) {
      setModalError(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelContribution = async (demandId, contributionId) => {
    if (!window.confirm('Are you sure you want to cancel this contribution? Your allocated stock will be released back to your available farm inventory.')) {
      return;
    }

    try {
      await api.post(`/demands/${demandId}/contributions/${contributionId}/cancel`, {
        reason: cancelReason || 'Cancelled by farmer'
      });
      alert('Contribution cancelled and stock released back to your inventory.');
      reload();
    } catch (err) {
      alert(errMsg(err));
    }
  };

  const selectedCropObj = farmerCropsData?.items?.find((c) => c._id === selectedCropId);
  const selectedCropFreeStock = selectedCropObj
    ? Math.max(0, selectedCropObj.quantity - (selectedCropObj.allocatedQuantity || 0))
    : 0;

  const grossRealization = (Number(quantityKg) || 0) * (Number(offeredPriceInr) || 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Global Agricultural Demand Board"
        subtitle="International buyers publish binding crop purchase requirements. Indian farmers contribute produce; the system automatically aggregates contributions and tracks fulfillment."
      >
        <div className="flex flex-wrap gap-2">
          <Link to="/farmer/sell-marketplace" className="btn-outline">
            🌾 Global Crop Catalogue
          </Link>
          {user?.role === 'buyer' && (
            <Link to="/buyer/portal" className="btn-primary">
              ➕ Post New Requirement
            </Link>
          )}
        </div>
      </PageHeader>

      {/* KPI Overview Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card border-l-4 border-l-leaf-600">
          <p className="text-xs font-semibold text-stone-500 uppercase">Active Global Demands</p>
          <p className="text-2xl font-bold text-stone-800">
            {overview.openDemandsCount || demandsList.length} <span className="text-xs font-normal text-stone-500">active</span>
          </p>
          <p className="text-xs text-stone-500 mt-1">Verified buyer requirements</p>
        </div>
        <div className="card border-l-4 border-l-blue-600">
          <p className="text-xs font-semibold text-stone-500 uppercase">Total Demand Volume</p>
          <p className="text-2xl font-bold text-blue-700">
            {overview.totalDemandMt || 0} <span className="text-sm font-normal text-stone-600">MT</span>
          </p>
          <p className="text-xs text-stone-500 mt-1">{(overview.totalDemandKg || 0).toLocaleString()} kg requested</p>
        </div>
        <div className="card border-l-4 border-l-indigo-600">
          <p className="text-xs font-semibold text-stone-500 uppercase">Committed Produce</p>
          <p className="text-2xl font-bold text-indigo-700">
            {overview.totalCommittedMt || 0} <span className="text-sm font-normal text-stone-600">MT</span>
          </p>
          <p className="text-xs text-stone-500 mt-1">{(overview.totalCommittedKg || 0).toLocaleString()} kg committed</p>
        </div>
        <div className="card border-l-4 border-l-emerald-600">
          <p className="text-xs font-semibold text-stone-500 uppercase">Overall Fulfillment Rate</p>
          <p className="text-2xl font-bold text-emerald-700">
            {overview.overallFulfillmentPercent || 0}%
          </p>
          <p className="text-xs text-stone-500 mt-1">Aggregated & ready for export</p>
        </div>
      </div>

      {/* AI Smart Matching Banner for Farmers */}
      {user?.role === 'farmer' && aiMatchesData?.recommendations?.length > 0 && (
        <div className="rounded-xl border border-leaf-300 bg-leaf-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-leaf-900 flex items-center gap-2">
              ✨ AI Smart Matching Opportunities ({aiMatchesData.totalMatchingOpportunities} Match{aiMatchesData.totalMatchingOpportunities === 1 ? '' : 'es'})
            </h3>
            <span className="text-xs bg-leaf-200 text-leaf-800 px-2 py-0.5 rounded-full font-semibold">
              94% Match Confidence
            </span>
          </div>
          <p className="text-xs text-leaf-800">
            Our recommendation engine analyzed your current crop inventory and found guaranteed purchase requirements with instant export aggregation:
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {aiMatchesData.recommendations.slice(0, 3).map((rec) => (
              <div key={rec.demandNumber + rec.cropId} className="bg-white p-3 rounded-lg border border-leaf-200 text-xs space-y-1.5 shadow-sm">
                <div className="flex justify-between font-bold text-stone-900">
                  <span>{rec.cropName}</span>
                  <span className="text-leaf-700">{fmt(rec.targetPricePerKg)}/kg</span>
                </div>
                <p className="text-stone-600">
                  {flag(rec.buyerCountry)} <b>{rec.buyerCountry}</b> · {rec.destinationPort}
                </p>
                <div className="flex justify-between text-stone-500 text-[11px]">
                  <span>Your Free Stock: <b>{rec.freeStockKg.toLocaleString()} kg</b></span>
                  <span>Remaining: <b>{rec.remainingDemandKg.toLocaleString()} kg</b></span>
                </div>
                <p className="text-emerald-700 font-semibold text-[11px]">
                  Gross Realization: {fmt(rec.grossRealizationInr)}
                </p>
                <button
                  type="button"
                  className="btn-primary w-full text-xs py-1 mt-1"
                  onClick={() => {
                    const matchDmd = demandsList.find((d) => d._id === rec.demandId);
                    if (matchDmd) handleOpenContributeModal(matchDmd);
                  }}
                >
                  ⚡ Contribute Produce Now
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-5" role="search">
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-stone-600">Search Requirement</label>
          <input
            type="text"
            className="input w-full"
            placeholder="Search crop, destination port, country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Destination Country</label>
          <select
            className="input w-full"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="">All Destinations</option>
            {GLOBAL_COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Status</label>
          <select
            className="input w-full"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="open">Open (Awaiting produce)</option>
            <option value="partially_committed">Partially Committed</option>
            <option value="fully_committed">Fully Committed</option>
            <option value="in_aggregation">In Aggregation Lot</option>
            <option value="fulfilled">Fulfilled</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            className="btn-outline w-full"
            onClick={() => { setSearch(''); setCountry(''); setStatus(''); setGrade(''); }}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Demands Cards Grid */}
      {loading ? (
        <Spinner label="Loading live buyer purchase requirements..." />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : demandsList.length === 0 ? (
        <Empty
          title="No purchase demands match your search criteria"
          hint="Try resetting filters or check back shortly as international buyers post requirements daily."
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {demandsList.map((demand) => {
            const isFulfilled = demand.status === 'fully_committed' || demand.status === 'in_aggregation' || demand.status === 'fulfilled';
            const remainingKg = Math.max(0, demand.remainingQuantityKg || (demand.requiredQuantityKg - demand.committedQuantityKg));
            const myContributions = demand.contributions?.filter(
              (c) => user && String(c.farmer) === String(user._id)
            ) || [];

            return (
              <article
                key={demand._id}
                className="card flex flex-col justify-between border-stone-200 hover:shadow-md transition-shadow space-y-3"
              >
                <div>
                  {/* Top Bar: Demand ID & Badges */}
                  <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-2">
                    <div>
                      <span className="text-[11px] font-mono text-stone-500 font-bold block">
                        #{demand.demandId}
                      </span>
                      <h3 className="text-lg font-bold text-stone-900 capitalize">
                        {demand.cropName} {demand.variety ? `(${demand.variety})` : ''}
                      </h3>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge>{demand.status}</Badge>
                      <span className="px-1.5 py-0.5 rounded bg-stone-100 text-[10px] font-bold text-stone-700">
                        Target Grade: {demand.targetGrade || 'A'}
                      </span>
                    </div>
                  </div>

                  {/* Destination & Buyer */}
                  <div className="space-y-1 text-xs text-stone-600 mt-2 bg-stone-50 p-2.5 rounded-lg border border-stone-100">
                    <p className="font-semibold text-stone-800 flex items-center gap-1.5">
                      <span>{flag(demand.destinationCountry)}</span>
                      <span>{demand.destinationPort}, {demand.destinationCountry}</span>
                      <span className="text-[10px] bg-stone-200 px-1 py-0.2 rounded font-normal">
                        {demand.incoterms || 'CIF'}
                      </span>
                    </p>
                    <p className="text-[11px] text-stone-500">
                      Buyer: <b>{demand.buyerCompany || demand.buyerName || 'Verified International Importer'}</b>
                    </p>
                  </div>

                  {/* Pricing & Volume Target */}
                  <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                    <div className="p-2 rounded bg-leaf-50 border border-leaf-100">
                      <p className="text-stone-500 text-[11px]">Target Price</p>
                      <p className="text-sm font-bold text-leaf-900 mt-0.5">
                        {fmt(demand.targetPricePerKg)} / kg
                      </p>
                      <p className="text-[10px] text-stone-500">
                        (${demand.targetPriceUsd || (Math.round((demand.targetPricePerKg / 83.5) * 100) / 100)} USD)
                      </p>
                    </div>
                    <div className="p-2 rounded bg-blue-50 border border-blue-100">
                      <p className="text-stone-500 text-[11px]">Total Required</p>
                      <p className="text-sm font-bold text-blue-900 mt-0.5">
                        {demand.requiredQuantityKg?.toLocaleString()} kg
                      </p>
                      <p className="text-[10px] text-stone-500">
                        {Math.round(demand.requiredQuantityKg / 1000)} MT Target
                      </p>
                    </div>
                  </div>

                  {/* Live Fulfillment Progress Meter */}
                  <div className="space-y-1.5 mt-3 bg-stone-50 p-2.5 rounded-lg border border-stone-100">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-stone-700">Fulfillment Progress:</span>
                      <span className="font-bold text-indigo-700">
                        {demand.fulfillmentPercentage || 0}%
                      </span>
                    </div>
                    <div className="w-full bg-stone-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${demand.fulfillmentPercentage || 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-stone-600 pt-0.5">
                      <span>Committed: <b>{demand.committedQuantityKg?.toLocaleString() || 0} kg</b></span>
                      <span>Remaining: <b className="text-amber-700">{remainingKg.toLocaleString()} kg</b></span>
                    </div>
                  </div>

                  {/* Specs, Certifications & Deadline */}
                  <div className="space-y-1 text-xs text-stone-600 mt-3">
                    <p>
                      <b>Packaging:</b> {demand.packaging || 'Standard export boxes'}
                    </p>
                    <p>
                      <b>Delivery Deadline:</b>{' '}
                      {demand.deliveryDeadline
                        ? new Date(demand.deliveryDeadline).toLocaleDateString()
                        : 'Within 30 days'}
                    </p>
                    {demand.certifications?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {demand.certifications.map((cert) => (
                          <span
                            key={cert}
                            className="text-[10px] bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded border border-stone-200 font-medium"
                          >
                            ✓ {cert}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Participating Farmers Anonymized List */}
                  {demand.contributions?.length > 0 && (
                    <div className="mt-3 border-t border-stone-100 pt-2 text-[11px]">
                      <p className="font-semibold text-stone-700 mb-1">
                        Contributing Farmers ({demand.participatingFarmersCount || demand.contributions.length}):
                      </p>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {demand.contributions.map((c, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between text-stone-600 bg-white p-1 rounded border border-stone-100"
                          >
                            <span>
                              👨‍🌾 {c.farmerName || `Farmer (${c.farmerState || 'IN'})`} · {c.quantityKg.toLocaleString()} kg
                            </span>
                            <span className="font-medium capitalize text-stone-800">
                              {c.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Farmer's Own Active Contributions */}
                  {myContributions.length > 0 && (
                    <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1">
                      <p className="font-bold text-emerald-900">Your Active Contribution:</p>
                      {myContributions.map((mc) => (
                        <div key={mc.contributionId} className="flex justify-between items-center text-emerald-800">
                          <span>
                            #{mc.contributionId}: {mc.quantityKg} kg @ ₹{mc.offeredPriceInr}/kg
                          </span>
                          {mc.status === 'committed' && (
                            <button
                              type="button"
                              className="text-red-600 underline font-semibold text-[11px]"
                              onClick={() => handleCancelContribution(demand._id, mc.contributionId)}
                            >
                              Cancel &amp; Release
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="border-t border-stone-100 pt-3">
                  {user?.role === 'farmer' && !isFulfilled && remainingKg > 0 && (
                    <button
                      type="button"
                      className="btn-primary w-full py-2 text-xs"
                      onClick={() => handleOpenContributeModal(demand)}
                    >
                      📦 Contribute Produce Towards Demand
                    </button>
                  )}
                  {isFulfilled && (
                    <div className="p-2 bg-teal-50 border border-teal-200 text-teal-800 rounded text-center text-xs font-semibold">
                      ✓ Target Met · Linked to Export Aggregation Lot
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Interactive Produce Contribution Modal */}
      {contributeDemand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <h3 className="text-lg font-bold text-stone-900">
                  Contribute Produce: {contributeDemand.cropName}
                </h3>
                <p className="text-xs text-stone-500">
                  Demand #{contributeDemand.demandId} · {flag(contributeDemand.destinationCountry)} {contributeDemand.destinationCountry}
                </p>
              </div>
              <button
                className="btn-outline text-xs px-2 py-1"
                onClick={() => setContributeDemand(null)}
              >
                ✕ Close
              </button>
            </div>

            {modalSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
                ✓ {modalSuccess}
              </div>
            )}
            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
                ⚠ {modalError}
              </div>
            )}

            {/* Demand Summary Pill */}
            <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-xs grid grid-cols-2 gap-2">
              <div>
                <span className="text-stone-500">Buyer Target Grade:</span>{' '}
                <b>Grade {contributeDemand.targetGrade || 'A'}</b>
              </div>
              <div>
                <span className="text-stone-500">Remaining Demand:</span>{' '}
                <b className="text-indigo-700">{contributeDemand.remainingQuantityKg?.toLocaleString()} kg</b>
              </div>
              <div>
                <span className="text-stone-500">Target Price:</span>{' '}
                <b className="text-leaf-800">{fmt(contributeDemand.targetPricePerKg)} / kg</b>
              </div>
              <div>
                <span className="text-stone-500">Destination:</span>{' '}
                <b>{contributeDemand.destinationPort}</b>
              </div>
            </div>

            <form onSubmit={handleContributeSubmit} className="space-y-3">
              {/* Select Farmer's Crop */}
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Select Produce from Your Farm Listings *
                </label>
                <select
                  required
                  className="input w-full"
                  value={selectedCropId}
                  onChange={(e) => {
                    setSelectedCropId(e.target.value);
                    const sel = farmerCropsData?.items?.find((c) => c._id === e.target.value);
                    if (sel) {
                      const free = Math.max(0, sel.quantity - (sel.allocatedQuantity || 0));
                      setQuantityKg(Math.min(free, contributeDemand.remainingQuantityKg));
                    }
                  }}
                >
                  <option value="">-- Choose matching farm listing --</option>
                  {farmerCropsData?.items?.map((c) => {
                    const free = Math.max(0, c.quantity - (c.allocatedQuantity || 0));
                    return (
                      <option key={c._id} value={c._id} disabled={free <= 0}>
                        {c.name} {c.variety ? `(${c.variety})` : ''} - Grade {c.grade || 'Ungraded'} · Free: {free.toLocaleString()} kg {free <= 0 ? '(Out of stock)' : ''}
                      </option>
                    );
                  })}
                </select>
                {selectedCropObj && (
                  <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                    ✓ Available Free Stock: {selectedCropFreeStock.toLocaleString()} kg
                  </p>
                )}
              </div>

              {/* Quantity to Contribute */}
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Quantity to Contribute (kg) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={Math.min(selectedCropFreeStock || 999999, contributeDemand.remainingQuantityKg)}
                  className="input w-full"
                  value={quantityKg}
                  onChange={(e) => setQuantityKg(e.target.value)}
                  placeholder={`Max available: ${Math.min(selectedCropFreeStock, contributeDemand.remainingQuantityKg)} kg`}
                />
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Cannot exceed your free stock ({selectedCropFreeStock} kg) or remaining demand ({contributeDemand.remainingQuantityKg} kg).
                </p>
              </div>

              {/* Price Offered */}
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Offered Price per kg (₹ INR)
                </label>
                <input
                  type="number"
                  min="1"
                  className="input w-full"
                  value={offeredPriceInr}
                  onChange={(e) => setOfferedPriceInr(e.target.value)}
                  placeholder="Defaults to buyer target price"
                />
              </div>

              {/* Packaging Notes */}
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Packaging / Reefer Notes
                </label>
                <input
                  type="text"
                  className="input w-full"
                  value={packagingNotes}
                  onChange={(e) => setPackagingNotes(e.target.value)}
                  placeholder="e.g. Standard 10kg export cartons, ready for cold storage"
                />
              </div>

              {/* Real-Time Gross Calculator */}
              <div className="p-3 bg-leaf-50 rounded-lg border border-leaf-200 text-xs space-y-1">
                <div className="flex justify-between font-bold text-leaf-900 text-sm">
                  <span>Gross Realization:</span>
                  <span>{fmt(grossRealization)}</span>
                </div>
                <p className="text-[11px] text-stone-600">
                  {Number(quantityKg).toLocaleString()} kg × {fmt(offeredPriceInr || 0)}/kg. Payment settled via escrow upon destination inspection.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting || !selectedCropId || Number(quantityKg) <= 0}
                  className="btn-primary flex-1"
                >
                  {submitting ? 'Reserving Produce...' : 'Confirm & Reserve Produce'}
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setContributeDemand(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
