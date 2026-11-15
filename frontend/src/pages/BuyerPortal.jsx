import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../services/api.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { Spinner, ErrorBox, Empty, PageHeader, Field, Badge } from '../components/ui.jsx';
import { fmtDate } from '../utils/format.js';

export default function BuyerPortal() {
  const { user, refreshUser } = useAuth();
  const { format } = useCurrency();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('RFQs');

  // Dashboard & RFQs data
  const dashApi = useApi('/buyer/dashboard');
  const rfqsApi = useApi('/rfqs');
  const watchlistApi = useApi('/buyer/watchlist');
  const invoicesApi = useApi('/buyer/invoices');
  const demandsApi = useApi('/demands/mine');

  // Modals state
  const [showRfqModal, setShowRfqModal] = useState(false);
  const [showDemandModal, setShowDemandModal] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState(null);
  const [activeQuoteModal, setActiveQuoteModal] = useState(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // New Demand Form State (Phase 9)
  const [dmdCrop, setDmdCrop] = useState('');
  const [dmdCategory, setDmdCategory] = useState('Vegetables');
  const [dmdVariety, setDmdVariety] = useState('');
  const [dmdQty, setDmdQty] = useState('');
  const [dmdUnit, setDmdUnit] = useState('kg');
  const [dmdGrade, setDmdGrade] = useState('A');
  const [dmdTargetPrice, setDmdTargetPrice] = useState('');
  const [dmdDestCountry, setDmdDestCountry] = useState(user?.country || 'UAE');
  const [dmdDestPort, setDmdDestPort] = useState('Jebel Ali Port, Dubai');
  const [dmdIncoterms, setDmdIncoterms] = useState('CIF');
  const [dmdDeadline, setDmdDeadline] = useState(new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10));
  const [dmdPackaging, setDmdPackaging] = useState('Corrugated Cartons (10kg reefer pack)');
  const [dmdNotes, setDmdNotes] = useState('');

  // New RFQ Form State
  const [rfqCrop, setRfqCrop] = useState('');
  const [rfqCategory, setRfqCategory] = useState('Vegetables');
  const [rfqQty, setRfqQty] = useState('');
  const [rfqUnit, setRfqUnit] = useState('kg');
  const [rfqGrade, setRfqGrade] = useState('A');
  const [rfqTargetPrice, setRfqTargetPrice] = useState('');
  const [rfqCurrency, setRfqCurrency] = useState(user?.currency || 'USD');
  const [rfqDestination, setRfqDestination] = useState('Jebel Ali Port, Dubai, UAE');
  const [rfqTerms, setRfqTerms] = useState('CIF');
  const [rfqDate, setRfqDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [rfqPackaging, setRfqPackaging] = useState('Standard Export Reefer Packaging / Crates');
  const [rfqSpecs, setRfqSpecs] = useState('');

  // Company verification state
  const [compName, setCompName] = useState(user?.companyName || user?.organization || '');
  const [buyerType, setBuyerType] = useState(user?.buyerType || 'importer');
  const [regNum, setRegNum] = useState(user?.businessRegistrationNumber || '');
  const [impLicense, setImpLicense] = useState(user?.importLicenseNumber || '');
  const [verifEvidence, setVerifEvidence] = useState(user?.verificationEvidence || '');
  const [savingComp, setSavingComp] = useState(false);

  const reloadAll = () => {
    dashApi.reload();
    rfqsApi.reload();
    watchlistApi.reload();
    invoicesApi.reload();
    demandsApi.reload();
  };

  const handlePostDemand = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/demands', {
        cropName: dmdCrop,
        category: dmdCategory,
        variety: dmdVariety,
        requiredQuantity: Number(dmdQty),
        unit: dmdUnit,
        targetGrade: dmdGrade,
        targetPricePerKg: Number(dmdTargetPrice),
        destinationCountry: dmdDestCountry,
        destinationPort: dmdDestPort,
        incoterms: dmdIncoterms,
        packaging: dmdPackaging,
        deliveryDeadline: new Date(dmdDeadline).toISOString(),
        notes: dmdNotes
      });
      toast('Global crop purchase demand published! Matching farmers notified.');
      setShowDemandModal(false);
      reloadAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelDemand = async (demandId) => {
    if (!window.confirm('Are you sure you want to cancel this demand? All committed farmer produce will be safely released back to their inventories.')) {
      return;
    }
    try {
      await api.post(`/demands/${demandId}/cancel`, { reason: 'Cancelled by international buyer' });
      toast('Demand requirement cancelled and allocated farmer stock safely released.');
      reloadAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handlePostRfq = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/rfqs', {
        cropName: rfqCrop,
        category: rfqCategory,
        quantity: Number(rfqQty),
        unit: rfqUnit,
        grade: rfqGrade,
        targetPriceInr: rfqTargetPrice ? Number(rfqTargetPrice) : undefined,
        currency: rfqCurrency,
        deliveryDestination: rfqDestination,
        deliveryTerms: rfqTerms,
        requiredByDate: new Date(rfqDate).toISOString(),
        packagingRequirements: rfqPackaging,
        qualitySpecifications: rfqSpecs
      });
      toast('Request for Quotation (RFQ) published to Indian exporters & hubs');
      setShowRfqModal(false);
      reloadAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuoteAction = async (rfqId, quoteId, action, counterVal = null) => {
    try {
      await api.patch(`/rfqs/${rfqId}/quotes/${quoteId}`, {
        action,
        counterPriceInr: counterVal ? Number(counterVal) : undefined
      });
      toast(`Quotation marked as ${action}ed`);
      reloadAll();
      if (selectedRfq) {
        const updated = await api.get(`/rfqs/${selectedRfq.rfqNumber || selectedRfq._id}`);
        setSelectedRfq(updated.data.rfq);
      }
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleConvertToOrder = async (rfq) => {
    try {
      const res = await api.post(`/rfqs/${rfq.rfqNumber || rfq._id}/convert-to-order`);
      toast(`Commercial Purchase Order & Invoice ${res.data.invoiceNumber} created!`);
      reloadAll();
      setSelectedRfq(null);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleSaveCompanyVerification = async (e) => {
    e.preventDefault();
    setSavingComp(true);
    try {
      await api.post('/buyer/verify-company', {
        companyName: compName,
        buyerType,
        businessRegistrationNumber: regNum,
        importLicenseNumber: impLicense,
        verificationEvidence: verifEvidence
      });
      toast('Company credentials verified successfully');
      if (refreshUser) refreshUser();
      reloadAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSavingComp(false);
    }
  };

  const removeFromWatchlist = async (itemId) => {
    try {
      await api.delete(`/buyer/watchlist/${itemId}`);
      toast('Removed from watchlist');
      watchlistApi.reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  if (dashApi.loading) return <Spinner />;

  const m = dashApi.data?.metrics || {};
  const comp = dashApi.data?.companyProfile || {};
  const rfqs = rfqsApi.data?.rfqs || [];
  const watchlist = watchlistApi.data?.items || [];
  const invoices = invoicesApi.data?.invoices || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="International Buyer B2B Portal"
          subtitle="Direct commodity procurement, quotation negotiation, container pooling, and export order management"
        />
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => setShowDemandModal(true)}>
            📢 Post Crop Demand
          </button>
          <button className="btn-outline" onClick={() => setShowRfqModal(true)}>
            📝 Post RFQ
          </button>
          <Link to="/aggregation" className="btn-outline">
            📦 Browse Bulk Lots
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="card border-l-4 border-l-blue-600">
          <p className="text-xs font-bold uppercase text-stone-500">Active RFQs</p>
          <p className="mt-1 text-2xl font-black text-blue-900">{m.activeRfqs || 0}</p>
          <p className="text-xs text-stone-500">{m.totalRfqs || 0} total requests</p>
        </div>
        <div className="card border-l-4 border-l-purple-600">
          <p className="text-xs font-bold uppercase text-stone-500">Quotes Received</p>
          <p className="mt-1 text-2xl font-black text-purple-900">{m.totalQuotesReceived || 0}</p>
          <p className="text-xs text-stone-500">From Indian exporters & hubs</p>
        </div>
        <div className="card border-l-4 border-l-emerald-600">
          <p className="text-xs font-bold uppercase text-stone-500">Purchase Orders</p>
          <p className="mt-1 text-2xl font-black text-emerald-900">{m.totalOrders || 0}</p>
          <p className="text-xs text-stone-500">₹{(m.totalPurchaseOrdersValueInr || 0).toLocaleString()} volume</p>
        </div>
        <div className="card border-l-4 border-l-amber-600">
          <p className="text-xs font-bold uppercase text-stone-500">Active Shipments</p>
          <p className="mt-1 text-2xl font-black text-amber-900">{m.activeShipments || 0}</p>
          <p className="text-xs text-stone-500">In transit / container booked</p>
        </div>
        <div className="card border-l-4 border-l-leaf-600">
          <p className="text-xs font-bold uppercase text-stone-500">Watchlist Produce</p>
          <p className="mt-1 text-2xl font-black text-leaf-800">{m.watchlistCount || 0}</p>
          <p className="text-xs text-stone-500">Tracked commodities</p>
        </div>
      </div>

      {/* Company Verification Banner */}
      <div className="card bg-stone-50 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-stone-800 text-sm">
              🏢 {comp.name || 'International Importer Company'}
            </h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              comp.verificationStatus === 'verified'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {comp.verificationStatus === 'verified' ? '✅ Verified Importer' : '⚠️ Unverified Profile'}
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Country: <b>{comp.country || user?.country}</b> · Currency: <b>{comp.currency || user?.currency}</b>
            {comp.businessRegistrationNumber ? ` · Tax/VAT: ${comp.businessRegistrationNumber}` : ''}
          </p>
        </div>
        <button
          className="btn-outline text-xs"
          onClick={() => setActiveTab('Verification')}
        >
          {comp.verificationStatus === 'verified' ? 'View Business Credentials' : 'Submit Company Verification'}
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-2">
        {['Purchase Demands', 'RFQs', 'Watchlist', 'Invoices & Orders', 'Verification'].map((t) => (
          <button
            key={t}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
              activeTab === t
                ? 'bg-leaf-700 text-white shadow-sm'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* TAB 0: PURCHASE DEMANDS (PHASE 9) */}
      {activeTab === 'Purchase Demands' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-stone-800 text-sm">Active Export Crop Demands</h3>
              <p className="text-xs text-stone-500">Live demand board entries where Indian farmers aggregate produce to fulfill your order</p>
            </div>
            <button className="btn-primary text-xs" onClick={() => setShowDemandModal(true)}>
              + Publish New Demand
            </button>
          </div>

          {!demandsApi.data?.items?.length ? (
            <Empty
              title="No crop purchase demands published yet"
              hint="Publish an export requirement specifying volume, target grade, target price, and destination port. Indian farmers will contribute produce toward your quota with live aggregation."
            >
              <button className="btn-primary text-xs mt-3" onClick={() => setShowDemandModal(true)}>
                Publish Your First Crop Demand
              </button>
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {demandsApi.data.items.map((d) => (
                <div key={d._id} className="card border-stone-200 space-y-3">
                  <div className="flex justify-between items-start border-b pb-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-stone-500 block">#{d.demandId}</span>
                      <h4 className="font-bold text-stone-900 text-base">{d.cropName} {d.variety ? `(${d.variety})` : ''}</h4>
                    </div>
                    <Badge>{d.status}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-stone-50 p-2 rounded">
                    <div>
                      <span className="text-stone-500">Destination:</span>{' '}
                      <b>{d.destinationPort}, {d.destinationCountry}</b>
                    </div>
                    <div>
                      <span className="text-stone-500">Target Grade:</span>{' '}
                      <b>Grade {d.targetGrade || 'A'}</b>
                    </div>
                    <div>
                      <span className="text-stone-500">Target Price:</span>{' '}
                      <b className="text-leaf-800">₹{d.targetPricePerKg}/kg (${d.targetPriceUsd}/kg)</b>
                    </div>
                    <div>
                      <span className="text-stone-500">Total Volume:</span>{' '}
                      <b>{d.requiredQuantityKg?.toLocaleString()} kg ({Math.round(d.requiredQuantityKg / 1000)} MT)</b>
                    </div>
                  </div>

                  {/* Fulfillment Meter */}
                  <div className="space-y-1 bg-stone-50 p-2 rounded border border-stone-100 text-xs">
                    <div className="flex justify-between font-medium">
                      <span>Fulfillment Status:</span>
                      <span className="font-bold text-indigo-700">{d.fulfillmentPercentage || 0}% Complete</span>
                    </div>
                    <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${d.fulfillmentPercentage || 0}%` }} />
                    </div>
                    <div className="flex justify-between text-[11px] text-stone-600 pt-0.5">
                      <span>Committed: <b>{d.committedQuantityKg?.toLocaleString() || 0} kg</b></span>
                      <span>Remaining: <b className="text-amber-700">{d.remainingQuantityKg?.toLocaleString() || 0} kg</b></span>
                    </div>
                  </div>

                  {/* Contributions breakdown */}
                  {d.contributions?.length > 0 && (
                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-stone-700">Contributing Farm Lots ({d.contributions.length}):</p>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {d.contributions.map((c, idx) => (
                          <div key={idx} className="flex justify-between text-[11px] bg-white p-1 rounded border border-stone-100">
                            <span>👨‍🌾 {c.farmerName || `Farmer (${c.farmerState})`} · {c.quantityKg} kg</span>
                            <span className="font-bold capitalize">{c.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex justify-between items-center pt-2 border-t">
                    <Link to="/farmer/demand-board" className="text-xs text-leaf-700 font-semibold underline">
                      View on Live Demand Board →
                    </Link>
                    {d.status !== 'cancelled' && d.status !== 'fulfilled' && (
                      <button
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => handleCancelDemand(d._id)}
                      >
                        Cancel Demand
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 1: RFQs & QUOTATIONS */}
      {activeTab === 'RFQs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-800 text-sm">My Requests for Quotation (RFQs)</h3>
            <button className="btn-primary text-xs" onClick={() => setShowRfqModal(true)}>
              + Publish New RFQ
            </button>
          </div>

          {!rfqs.length ? (
            <Empty
              title="No RFQs posted yet"
              hint="Post an international RFQ to receive competitive quotations from verified Indian exporters and aggregation hubs."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="border-b bg-stone-50 text-stone-500">
                  <tr>
                    <th className="p-3">RFQ Number & Crop</th>
                    <th>Required Volume</th>
                    <th>Destination & Terms</th>
                    <th>Target Date</th>
                    <th>Status</th>
                    <th>Quotes Received</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {rfqs.map((r) => (
                    <tr key={r._id} className="hover:bg-stone-50/50">
                      <td className="p-3">
                        <div className="font-bold text-stone-800">{r.rfqNumber}</div>
                        <div className="font-medium text-leaf-700">{r.cropName} (Grade {r.grade})</div>
                        {r.matchingLotId && (
                          <div className="text-[10px] text-purple-700 font-semibold">
                            📦 Matched Bulk Lot: {r.matchingLotId}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="font-bold text-stone-800">{r.quantity.toLocaleString()} {r.unit}</div>
                        {r.targetPriceInr && (
                          <div className="text-xs text-stone-500">Target: ₹{r.targetPriceInr}/{r.unit}</div>
                        )}
                      </td>
                      <td>
                        <div className="font-semibold text-stone-800">{r.deliveryDestination}</div>
                        <div className="text-xs text-stone-500 font-mono">Incoterms: {r.deliveryTerms}</div>
                      </td>
                      <td>
                        <div className="text-xs text-stone-800">{new Date(r.requiredByDate).toLocaleDateString()}</div>
                      </td>
                      <td>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize border ${
                          r.status === 'open' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          r.status === 'quoted' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          r.status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          r.status === 'fulfilled' ? 'bg-leaf-50 text-leaf-800 border-leaf-200' :
                          'bg-stone-100 text-stone-600'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td>
                        <span className="font-bold text-stone-800">{r.quotes?.length || 0} quote{r.quotes?.length === 1 ? '' : 's'}</span>
                      </td>
                      <td className="text-right p-3">
                        <button
                          className="btn-outline text-xs px-2.5 py-1"
                          onClick={() => setSelectedRfq(r)}
                        >
                          Review Quotes ({r.quotes?.length || 0})
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WATCHLIST */}
      {activeTab === 'Watchlist' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-800 text-sm">My Tracked Commodities & Bulk Lots</h3>
            <Link to="/marketplace" className="text-xs text-leaf-700 font-semibold hover:underline">
              + Browse Marketplace to Track More
            </Link>
          </div>

          {!watchlist.length ? (
            <Empty
              title="Your watchlist is empty"
              hint="Save crops or export lots from the Marketplace or Crop Lots page to monitor real-time availability and prices."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {watchlist.map((w) => {
                const item = w.crop || w.lot;
                if (!item) return null;
                const isLot = !!w.lot;
                return (
                  <div key={w._id} className="card flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-stone-800">{item.name || item.cropName}</h4>
                        <span className="rounded bg-leaf-100 text-leaf-800 px-2 py-0.5 text-[11px] font-bold">
                          {isLot ? '📦 Bulk Lot' : '🌱 Crop Listing'}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 mt-1">
                        Grade {item.grade || 'A'} · {item.state || item.location}
                      </p>
                      <p className="text-lg font-black text-leaf-700 mt-2">
                        ₹{item.priceInr || item.weightedAvgPricePerKg} / kg
                      </p>
                      <p className="text-xs text-stone-600">
                        Available: <b>{item.quantity || item.totalQuantityKg} {item.unit || 'kg'}</b>
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between pt-2 border-t text-xs">
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => removeFromWatchlist(w._id)}
                      >
                        Remove
                      </button>
                      <button
                        className="btn-primary text-xs px-2.5 py-1"
                        onClick={() => {
                          setRfqCrop(item.name || item.cropName);
                          setRfqCategory(item.category || 'Vegetables');
                          setRfqGrade(item.grade || 'A');
                          setShowRfqModal(true);
                        }}
                      >
                        Request RFQ
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: INVOICES & ORDERS */}
      {activeTab === 'Invoices & Orders' && (
        <div className="space-y-4">
          <h3 className="font-bold text-stone-800 text-sm">Commercial Export Invoices & Purchase Orders</h3>
          {!invoices.length ? (
            <Empty
              title="No commercial invoices yet"
              hint="When you accept an exporter's quotation, an official Purchase Order and Invoice with container tracking will be issued here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="border-b bg-stone-50 text-stone-500">
                  <tr>
                    <th className="p-3">Invoice & PO Number</th>
                    <th>Commodity & Quantity</th>
                    <th>Destination Port</th>
                    <th>Total Value</th>
                    <th>Payment Status</th>
                    <th>Shipment Tracking</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {invoices.map((inv) => (
                    <tr key={inv._id} className="hover:bg-stone-50/50">
                      <td className="p-3">
                        <div className="font-mono font-bold text-stone-800">{inv.invoiceNumber}</div>
                        {inv.rfqNumber && (
                          <div className="text-[10px] text-purple-700 font-mono">Linked: {inv.rfqNumber}</div>
                        )}
                        <div className="text-xs text-stone-400">{fmtDate(inv.createdAt)}</div>
                      </td>
                      <td>
                        <div className="font-bold text-stone-800">{inv.cropName}</div>
                        <div className="text-xs text-stone-500">{inv.quantity} {inv.unit}</div>
                      </td>
                      <td>
                        <div className="font-medium text-stone-800">{inv.destinationPort || 'Jebel Ali'}</div>
                        <div className="text-xs text-stone-400 font-mono">Terms: {inv.deliveryTerms || 'CIF'}</div>
                      </td>
                      <td>
                        <div className="font-extrabold text-emerald-800">₹{inv.totalInr?.toLocaleString()}</div>
                      </td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold capitalize ${
                          inv.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {inv.paymentStatus || 'Pending'}
                        </span>
                        <Link to="/finance" className="block text-[11px] text-leaf-700 font-semibold hover:underline mt-1">
                          {inv.paymentStatus === 'paid' ? 'Receipt & Invoices ➔' : 'Pay via Razorpay ➔'}
                        </Link>
                      </td>
                      <td>
                        <div className="font-semibold text-blue-800 capitalize text-xs">
                          🚢 {inv.shipmentTracking?.status?.replace(/_/g, ' ') || 'Booked'}
                        </div>
                        {inv.shipmentTracking?.carrier && (
                          <div className="text-[10px] text-stone-500">{inv.shipmentTracking.carrier}</div>
                        )}
                        <Link to="/logistics" className="inline-block mt-1 text-[11px] font-bold text-leaf-700 hover:underline">
                          Track Reefer & Cold Chain ➔
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: COMPANY VERIFICATION */}
      {activeTab === 'Verification' && (
        <div className="card max-w-2xl bg-white space-y-4">
          <h3 className="font-bold text-stone-800 text-base">
            🏢 International Importer Business Credentials
          </h3>
          <p className="text-xs text-stone-500">
            Verified companies gain priority matching with export aggregation lots, access to direct CIF shipping quotes, and commercial credit facility eligibility.
          </p>

          <form onSubmit={handleSaveCompanyVerification} className="space-y-3 text-xs">
            <Field label="Registered Company Name" id="cName">
              <input
                className="input"
                placeholder="e.g. Al-Khaleej Food Distribution LLC"
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                required
              />
            </Field>

            <Field label="Business Type" id="bType">
              <select className="input" value={buyerType} onChange={(e) => setBuyerType(e.target.value)}>
                <option value="importer">International Importer</option>
                <option value="wholesaler">Wholesale Food Distributor</option>
                <option value="retailer">Supermarket / Retail Chain</option>
                <option value="processor">Food Processing Manufacturer</option>
                <option value="exporter">Trading & Export Re-exporter</option>
              </select>
            </Field>

            <Field label="Tax Registration / VAT Number" id="trn">
              <input
                className="input"
                placeholder="e.g. TRN-1002938471"
                value={regNum}
                onChange={(e) => setRegNum(e.target.value)}
                required
              />
            </Field>

            <Field label="Customs Import License / Code" id="impCode">
              <input
                className="input"
                placeholder="e.g. DXB-IMP-84920"
                value={impLicense}
                onChange={(e) => setImpLicense(e.target.value)}
                required
              />
            </Field>

            <Field label="Chamber of Commerce / License Evidence" id="evid">
              <textarea
                rows="2"
                className="input"
                placeholder="e.g. Registered with Dubai Chamber of Commerce, License #849201"
                value={verifEvidence}
                onChange={(e) => setVerifEvidence(e.target.value)}
              />
            </Field>

            <div className="pt-2 flex justify-end">
              <button type="submit" className="btn-primary" disabled={savingComp}>
                {savingComp ? 'Saving...' : 'Update & Verify Company'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* POST RFQ MODAL */}
      {showRfqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-stone-800">📝 Post Request for Quotation (RFQ)</h3>
            <p className="mt-1 text-xs text-stone-500">
              Broadcast your commercial commodity requirements to Indian farmers, regional aggregation hubs, and certified exporters.
            </p>

            <form onSubmit={handlePostRfq} className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Commodity / Crop" id="cropName">
                  <input
                    className="input"
                    placeholder="e.g. Tomatoes, Mango, Grapes"
                    value={rfqCrop}
                    onChange={(e) => setRfqCrop(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Category" id="cat">
                  <select className="input" value={rfqCategory} onChange={(e) => setRfqCategory(e.target.value)}>
                    <option>Vegetables</option>
                    <option>Fruits</option>
                    <option>Grains</option>
                    <option>Pulses</option>
                    <option>Spices</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Field label="Quantity" id="qty">
                  <input
                    type="number"
                    min="1"
                    className="input"
                    placeholder="5000"
                    value={rfqQty}
                    onChange={(e) => setRfqQty(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Unit" id="unit">
                  <select className="input" value={rfqUnit} onChange={(e) => setRfqUnit(e.target.value)}>
                    <option>kg</option>
                    <option>quintal</option>
                    <option>tonne</option>
                  </select>
                </Field>
                <Field label="Desired Grade" id="grade">
                  <select className="input" value={rfqGrade} onChange={(e) => setRfqGrade(e.target.value)}>
                    <option>A</option>
                    <option>B</option>
                    <option>Any</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Destination Port & City" id="dest">
                  <input
                    className="input"
                    placeholder="e.g. Jebel Ali Port, Dubai, UAE"
                    value={rfqDestination}
                    onChange={(e) => setRfqDestination(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Delivery Terms (Incoterms)" id="terms">
                  <select className="input" value={rfqTerms} onChange={(e) => setRfqTerms(e.target.value)}>
                    <option>CIF (Cost, Insurance & Freight)</option>
                    <option>FOB (Free on Board - JNPT/Chennai)</option>
                    <option>CFR (Cost & Freight)</option>
                    <option>EXW (Ex-Works Aggregation Hub)</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Target Price (INR / kg)" id="tPrice">
                  <input
                    type="number"
                    step="0.5"
                    className="input"
                    placeholder="Optional target budget"
                    value={rfqTargetPrice}
                    onChange={(e) => setRfqTargetPrice(e.target.value)}
                  />
                </Field>
                <Field label="Required Delivery Date" id="rDate">
                  <input
                    type="date"
                    className="input"
                    min={new Date().toISOString().slice(0, 10)}
                    value={rfqDate}
                    onChange={(e) => setRfqDate(e.target.value)}
                    required
                  />
                </Field>
              </div>

              <Field label="Packaging Specifications" id="pack">
                <input
                  className="input"
                  value={rfqPackaging}
                  onChange={(e) => setRfqPackaging(e.target.value)}
                />
              </Field>

              <Field label="Quality & Size Specifications" id="specs">
                <textarea
                  rows="2"
                  className="input"
                  placeholder="e.g. Fruit caliber 55-65mm, deep red color, moisture <12%, zero pesticide residue"
                  value={rfqSpecs}
                  onChange={(e) => setRfqSpecs(e.target.value)}
                />
              </Field>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" className="btn-outline" onClick={() => setShowRfqModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Publishing...' : 'Publish RFQ to Exporters'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVIEW QUOTES MODAL */}
      {selectedRfq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-800">
                  Quotations for {selectedRfq.rfqNumber} ({selectedRfq.cropName})
                </h3>
                <p className="text-xs text-stone-500">
                  Required: {selectedRfq.quantity} {selectedRfq.unit} · {selectedRfq.deliveryDestination} ({selectedRfq.deliveryTerms})
                </p>
              </div>
              <button className="btn-outline text-xs px-2 py-1" onClick={() => setSelectedRfq(null)}>
                ✕ Close
              </button>
            </div>

            {selectedRfq.status === 'accepted' && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-emerald-900 text-xs block">
                    ✅ Quotation Accepted!
                  </span>
                  <span className="text-[11px] text-emerald-700">
                    Quote #{selectedRfq.acceptedQuoteId} is locked for procurement. Convert to Purchase Order to issue formal invoice.
                  </span>
                </div>
                {!selectedRfq.order && (
                  <button
                    className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleConvertToOrder(selectedRfq)}
                  >
                    Generate PO & Invoice
                  </button>
                )}
              </div>
            )}

            {!selectedRfq.quotes?.length ? (
              <Empty
                title="No quotes received yet"
                hint="Indian exporters and aggregation hubs have been notified and will submit formal CIF/FOB quotes shortly."
              />
            ) : (
              <div className="space-y-3">
                {selectedRfq.quotes.map((q) => (
                  <div key={q.quoteId} className="border rounded-lg p-3 text-xs space-y-2 bg-stone-50/50">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-stone-800">{q.supplierName}</span>
                        <span className="text-stone-400 block text-[10px]">Quote ID: {q.quoteId} · {fmtDate(q.createdAt)}</span>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                        q.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' :
                        q.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        q.status === 'countered' ? 'bg-amber-100 text-amber-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {q.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-stone-700">
                      <div><span className="text-stone-400 block">Offered Qty:</span> <b>{q.offeredQuantityKg} kg</b></div>
                      <div><span className="text-stone-400 block">Base Rate:</span> <b>₹{q.unitPriceInr}/kg</b></div>
                      <div><span className="text-stone-400 block">Total CIF Value:</span> <b className="text-leaf-800">₹{q.totalPriceInr.toLocaleString()}</b></div>
                    </div>

                    {q.notes && (
                      <p className="text-stone-600 italic bg-white p-1.5 rounded border border-stone-100">
                        "{q.notes}"
                      </p>
                    )}

                    {selectedRfq.status !== 'accepted' && selectedRfq.status !== 'fulfilled' && q.status === 'pending' && (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t">
                        <button
                          className="btn-outline text-xs px-2 py-1 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleQuoteAction(selectedRfq.rfqNumber, q.quoteId, 'reject')}
                        >
                          Decline
                        </button>
                        <button
                          className="btn-outline text-xs px-2 py-1 text-amber-700 border-amber-200 hover:bg-amber-50"
                          onClick={() => {
                            const val = window.prompt(`Enter your counter price in INR / kg (current: ₹${q.unitPriceInr}):`);
                            if (val) handleQuoteAction(selectedRfq.rfqNumber, q.quoteId, 'counter', val);
                          }}
                        >
                          Counter-Offer
                        </button>
                        <button
                          className="btn-primary text-xs px-3 py-1"
                          onClick={() => handleQuoteAction(selectedRfq.rfqNumber, q.quoteId, 'accept')}
                        >
                          Accept Quotation
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* POST CROP PURCHASE DEMAND MODAL (PHASE 9) */}
      {showDemandModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <h3 className="text-lg font-bold text-stone-900">Post Global Crop Purchase Demand</h3>
                <p className="text-xs text-stone-500">Publish a binding international demand. Farmers will aggregate produce to meet your quota.</p>
              </div>
              <button
                className="btn-outline text-xs px-2 py-1"
                onClick={() => setShowDemandModal(false)}
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handlePostDemand} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Crop Name *</label>
                  <input
                    type="text"
                    required
                    className="input w-full"
                    placeholder="e.g. Tomato, Mango, Basmati Rice"
                    value={dmdCrop}
                    onChange={(e) => setDmdCrop(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Category</label>
                  <select
                    className="input w-full"
                    value={dmdCategory}
                    onChange={(e) => setDmdCategory(e.target.value)}
                  >
                    {['Vegetables', 'Fruits', 'Grains', 'Pulses', 'Spices', 'Other crops'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Variety</label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="e.g. Roma, Alphonso"
                    value={dmdVariety}
                    onChange={(e) => setDmdVariety(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Required Quantity *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    className="input w-full"
                    placeholder="e.g. 20000"
                    value={dmdQty}
                    onChange={(e) => setDmdQty(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Unit</label>
                  <select
                    className="input w-full"
                    value={dmdUnit}
                    onChange={(e) => setDmdUnit(e.target.value)}
                  >
                    <option value="kg">kg</option>
                    <option value="quintal">quintal</option>
                    <option value="tonne">tonne (MT)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Target Quality Grade</label>
                  <select
                    className="input w-full"
                    value={dmdGrade}
                    onChange={(e) => setDmdGrade(e.target.value)}
                  >
                    <option value="A">Grade A (Premium Export Quality)</option>
                    <option value="B">Grade B (Standard Commercial)</option>
                    <option value="C">Grade C (Processing)</option>
                    <option value="Any">Any Exportable Grade</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Target Price (INR per kg) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    className="input w-full"
                    placeholder="e.g. 48"
                    value={dmdTargetPrice}
                    onChange={(e) => setDmdTargetPrice(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Destination Country *</label>
                  <input
                    type="text"
                    required
                    className="input w-full"
                    placeholder="e.g. UAE, Saudi Arabia, UK"
                    value={dmdDestCountry}
                    onChange={(e) => setDmdDestCountry(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Port of Discharge *</label>
                  <input
                    type="text"
                    required
                    className="input w-full"
                    placeholder="e.g. Jebel Ali Port, Dubai"
                    value={dmdDestPort}
                    onChange={(e) => setDmdDestPort(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Incoterms</label>
                  <select
                    className="input w-full"
                    value={dmdIncoterms}
                    onChange={(e) => setDmdIncoterms(e.target.value)}
                  >
                    <option value="CIF">CIF (Cost, Insurance & Freight)</option>
                    <option value="FOB">FOB (Free On Board)</option>
                    <option value="CFR">CFR (Cost & Freight)</option>
                    <option value="EXW">EXW (Ex Works)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Packaging Specifications</label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="e.g. 10kg Corrugated Boxes"
                    value={dmdPackaging}
                    onChange={(e) => setDmdPackaging(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Delivery Deadline Date *</label>
                  <input
                    type="date"
                    required
                    className="input w-full"
                    value={dmdDeadline}
                    onChange={(e) => setDmdDeadline(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Quality Specifications & Special Requirements</label>
                <textarea
                  rows={2}
                  className="input w-full"
                  placeholder="e.g. Firm texture, max 10% moisture, Phytosanitary & APEDA certified."
                  value={dmdNotes}
                  onChange={(e) => setDmdNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary flex-1 py-2"
                >
                  {submitting ? 'Publishing Demand...' : 'Publish Purchase Demand to Live Board'}
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setShowDemandModal(false)}
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
