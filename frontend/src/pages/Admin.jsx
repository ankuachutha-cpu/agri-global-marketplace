import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../services/api.js';
import { useApi } from '../hooks/useApi.js';
import { useToast } from '../components/Toast.jsx';
import { Spinner, ErrorBox, Empty, PageHeader, Badge, Field } from '../components/ui.jsx';
import { fmtDate } from '../utils/format.js';

const TABS = [
  'Overview',
  'Global Demands',
  'Crop Aggregation Lots',
  'Collections & Hubs',
  'Export & Shipping',
  'Financials & Settlements',
  'Users',
  'Audit Logs',
  'Crops',
  'Orders',
  'Companies',
  'Buying requests',
  'Enquiries',
  'Collection centers',
  'Export guides'
];

// Existing field definitions
const COMPANY_FIELDS = [
  { name: 'type', label: 'Type', type: 'select', options: ['international_importer', 'indian_exporter'], required: true },
  { name: 'name', label: 'Company name', required: true },
  { name: 'country', label: 'Country', required: true },
  { name: 'state', label: 'State' },
  { name: 'city', label: 'City' },
  { name: 'buyerType', label: 'Buyer type', type: 'select', options: ['importer', 'wholesaler', 'distributor', 'retailer', 'processor', 'exporter', 'other'] },
  { name: 'productsHandled', label: 'Products handled (comma separated)', type: 'list' },
  { name: 'productCategories', label: 'Product categories (e.g. vegetables, fruits)', type: 'list' },
  { name: 'businessCategory', label: 'Business category' },
  { name: 'minimumOrderQuantity', label: 'Minimum order quantity (only if published)' },
  { name: 'website', label: 'Official website (https://...)' },
  { name: 'contactPage', label: 'Contact page URL' },
  { name: 'logoUrl', label: 'Logo URL (only where permitted)' },
  { name: 'email', label: 'Public business email' },
  { name: 'phone', label: 'Public business phone' },
  { name: 'whatsapp', label: 'Public business WhatsApp' },
  { name: 'address', label: 'Public address' },
  { name: 'sourceUrl', label: 'Primary source URL (where this was found)', required: true }
];

const REQUEST_FIELDS = [
  { name: 'company', label: 'Company', type: 'ref', optionsUrl: '/companies', required: true },
  { name: 'crop', label: 'Crop requested', required: true },
  { name: 'quantity', label: 'Required quantity', type: 'number' },
  { name: 'unit', label: 'Unit (kg, tonne...)' },
  { name: 'quality', label: 'Quality requirements' },
  { name: 'minimumOrderQuantity', label: 'Minimum order quantity (if published)' },
  { name: 'deliveryDestination', label: 'Delivery destination' },
  { name: 'requestDate', label: 'Request date', type: 'date', required: true },
  { name: 'expiresAt', label: 'Expiration date (if published)', type: 'date' },
  { name: 'sourceUrl', label: 'Official source URL', required: true }
];

const CENTER_FIELDS = [
  { name: 'name', label: 'Name', required: true },
  { name: 'kind', label: 'Kind', type: 'select', options: ['collection_center', 'export_facility', 'cold_storage'] },
  { name: 'address', label: 'Address' },
  { name: 'state', label: 'State' },
  { name: 'city', label: 'City' },
  { name: 'latitude', label: 'Latitude', type: 'number', required: true },
  { name: 'longitude', label: 'Longitude', type: 'number', required: true },
  { name: 'sourceUrl', label: 'Source URL', required: true }
];

const GUIDE_FIELDS = [
  { name: 'topic', label: 'Topic', required: true },
  { name: 'title', label: 'Title', required: true },
  { name: 'content', label: 'Content', type: 'textarea', required: true },
  { name: 'sourceName', label: 'Source name', required: true },
  { name: 'sourceUrl', label: 'Source URL', required: true },
  { name: 'order', label: 'Display order', type: 'number' }
];

const LOT_STATUS_BADGES = {
  forming: { text: 'Forming', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  ready_for_inspection: { text: 'Ready for QC', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  inspected: { text: 'QC Passed', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
  allocated_for_export: { text: 'Export Assigned', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  in_transit: { text: 'In Transit', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  exported: { text: 'Exported', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { text: 'Cancelled', bg: 'bg-stone-100 text-stone-600 border-stone-200' }
};

// ==========================================
// 1. OVERVIEW COMPONENT
// ==========================================

function Overview() {
  const { data, loading, error, reload } = useApi('/admin/overview-metrics');

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const u = data.users || {};
  const agg = data.aggregation || {};
  const col = data.collections || {};
  const fin = data.financials || {};

  return (
    <div className="space-y-6">
      {/* Platform High-Level KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="card text-center p-3 border-t-4 border-t-leaf-600">
          <p className="text-3xl font-extrabold text-stone-900">{u.farmers || 0}</p>
          <p className="text-xs font-semibold text-stone-500 mt-1">Registered Farmers</p>
        </div>
        <div className="card text-center p-3 border-t-4 border-t-blue-600">
          <p className="text-3xl font-extrabold text-stone-900">{u.buyers || 0}</p>
          <p className="text-xs font-semibold text-stone-500 mt-1">Registered Buyers</p>
        </div>
        <div className="card text-center p-3 border-t-4 border-t-emerald-600">
          <p className="text-3xl font-extrabold text-stone-900">{data.crops?.total || 0}</p>
          <p className="text-xs font-semibold text-stone-500 mt-1">Crop Listings</p>
        </div>
        <div className="card text-center p-3 border-t-4 border-t-purple-600">
          <p className="text-3xl font-extrabold text-purple-700">{agg.totalAggregatedMT || 0} MT</p>
          <p className="text-xs font-semibold text-stone-500 mt-1">Total Aggregated</p>
        </div>
        <div className="card text-center p-3 border-t-4 border-t-indigo-600">
          <p className="text-3xl font-extrabold text-indigo-700">{agg.activeLots || 0}</p>
          <p className="text-xs font-semibold text-stone-500 mt-1">Active Bulk Lots</p>
        </div>
        <div className="card text-center p-3 border-t-4 border-t-amber-600">
          <p className="text-3xl font-extrabold text-amber-700">{agg.exportReadyLots || 0}</p>
          <p className="text-xs font-semibold text-stone-500 mt-1">Export-Ready Lots</p>
        </div>
      </div>

      {/* Financials & Settlements Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card bg-emerald-50/50 border border-emerald-200">
          <p className="text-xs font-bold uppercase text-emerald-800">Settled Farmer Payouts</p>
          <p className="mt-1 text-2xl font-black text-emerald-900">₹{(fin.settledFarmerPayoutsInr || 0).toLocaleString()}</p>
          <p className="text-xs text-emerald-700 mt-0.5">Disbursed to farmers via DBT/UPI</p>
        </div>
        <div className="card bg-amber-50/50 border border-amber-200">
          <p className="text-xs font-bold uppercase text-amber-800">Pending Farmer Settlements</p>
          <p className="mt-1 text-2xl font-black text-amber-900">₹{(fin.pendingFarmerPayoutsInr || 0).toLocaleString()}</p>
          <p className="text-xs text-amber-700 mt-0.5">Awaiting QC completion or hub transfer</p>
        </div>
        <div className="card bg-blue-50/50 border border-blue-200">
          <p className="text-xs font-bold uppercase text-blue-800">Gross Export Value</p>
          <p className="mt-1 text-2xl font-black text-blue-900">₹{(fin.grossExportValueInr || 0).toLocaleString()}</p>
          <p className="text-xs text-blue-700 mt-0.5">Export-ready and shipped commercial lots</p>
        </div>
        <div className="card bg-purple-50/50 border border-purple-200">
          <p className="text-xs font-bold uppercase text-purple-800">Platform Facilitation Fee</p>
          <p className="mt-1 text-2xl font-black text-purple-900">₹{(fin.platformCommissionInr || 0).toLocaleString()}</p>
          <p className="text-xs text-purple-700 mt-0.5">5% commercial export fee earned</p>
        </div>
      </div>

      {/* Operations & Logistics Pipeline */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card">
          <h3 className="font-bold text-stone-800 text-sm border-b pb-2 mb-3 flex items-center justify-between">
            <span>🚚 Farm Pickup & Collection Logistics</span>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 font-mono">
              {col.total || 0} total requests
            </span>
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-stone-50 p-3">
              <span className="text-xs text-stone-500 block">Active Pickups</span>
              <span className="text-xl font-bold text-stone-800">{col.activePickups || 0}</span>
            </div>
            <div className="rounded-lg bg-stone-50 p-3">
              <span className="text-xs text-stone-500 block">Scheduled Volume</span>
              <span className="text-xl font-bold text-stone-800">{col.scheduledKg?.toLocaleString() || 0} kg</span>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <span className="text-xs text-emerald-700 block">Verified & Accepted</span>
              <span className="text-xl font-bold text-emerald-800">{col.acceptedKg?.toLocaleString() || 0} kg</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold text-stone-800 text-sm border-b pb-2 mb-3 flex items-center justify-between">
            <span>🏢 International Buyers & Verified Companies</span>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 font-mono">
              {data.companies?.verified || 0} / {data.companies?.total || 0} verified
            </span>
          </h3>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-stone-50 p-3">
              <span className="text-xs text-stone-500 block">Total Companies</span>
              <span className="text-xl font-bold text-stone-800">{data.companies?.total || 0}</span>
            </div>
            <div className="rounded-lg bg-purple-50 p-3">
              <span className="text-xs text-purple-700 block">Verified Importers/Exporters</span>
              <span className="text-xl font-bold text-purple-800">{data.companies?.verified || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 1.5. GLOBAL DEMANDS & SOURCING (PHASE 9)
// ==========================================

function AdminDemands() {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDemand, setSelectedDemand] = useState(null);
  const [inspectContrib, setInspectContrib] = useState(null);
  const [acceptedQty, setAcceptedQty] = useState('');
  const [rejectedQty, setRejectedQty] = useState('');
  const [qcGrade, setQcGrade] = useState('A');
  const [qcNotes, setQcNotes] = useState('Quality meets export standard');
  const [savingQc, setSavingQc] = useState(false);

  const { data: analyticsData } = useApi('/demands/analytics/summary');
  const params = {
    ...(filterStatus && { status: filterStatus }),
    ...(searchTerm && { q: searchTerm }),
    limit: 50
  };
  const { data, loading, error, reload } = useApi('/demands', params);

  const overview = analyticsData?.overview || {};
  const demands = data?.items || [];

  const handleInspectSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDemand || !inspectContrib) return;
    setSavingQc(true);
    try {
      await api.post(`/demands/${selectedDemand._id}/contributions/${inspectContrib.contributionId || inspectContrib._id}/inspection`, {
        acceptedQuantityKg: Number(acceptedQty),
        rejectedQuantityKg: Number(rejectedQty),
        inspectionGrade: qcGrade,
        rejectionReason: Number(rejectedQty) > 0 ? qcNotes : undefined,
        qcInspectorNotes: qcNotes
      });
      toast(`Inspection outcome recorded! Accepted: ${acceptedQty} kg, Rejected: ${rejectedQty} kg.`);
      setInspectContrib(null);
      reload();
      const updated = await api.get(`/demands/${selectedDemand._id}`);
      setSelectedDemand(updated.data.demand);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSavingQc(false);
    }
  };

  const handleCancelDemand = async (demandId) => {
    if (!window.confirm('Cancel this global demand? All committed farmer produce will be safely released back to available inventory.')) return;
    try {
      await api.post(`/demands/${demandId}/cancel`, { reason: 'Cancelled by Admin' });
      toast('Demand cancelled and farmer stock safely restored.');
      reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Overview */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card border-l-4 border-l-leaf-600">
          <p className="text-xs font-bold uppercase text-stone-500">Total Demands</p>
          <p className="text-2xl font-black text-stone-900 mt-1">{overview.totalDemandsCount || demands.length}</p>
          <p className="text-xs text-stone-500">{overview.openDemandsCount || 0} open for sourcing</p>
        </div>
        <div className="card border-l-4 border-l-blue-600">
          <p className="text-xs font-bold uppercase text-stone-500">Requested Volume</p>
          <p className="text-2xl font-black text-blue-900 mt-1">{overview.totalDemandMt || 0} MT</p>
          <p className="text-xs text-stone-500">{(overview.totalDemandKg || 0).toLocaleString()} kg total</p>
        </div>
        <div className="card border-l-4 border-l-indigo-600">
          <p className="text-xs font-bold uppercase text-stone-500">Committed Volume</p>
          <p className="text-2xl font-black text-indigo-900 mt-1">{overview.totalCommittedMt || 0} MT</p>
          <p className="text-xs text-stone-500">{(overview.totalCommittedKg || 0).toLocaleString()} kg committed</p>
        </div>
        <div className="card border-l-4 border-l-emerald-600">
          <p className="text-xs font-bold uppercase text-stone-500">Overall Fulfillment Rate</p>
          <p className="text-2xl font-black text-emerald-800 mt-1">{overview.overallFulfillmentPercent || 0}%</p>
          <p className="text-xs text-stone-500">{overview.fulfilledDemandsCount || 0} demands fulfilled</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <input
            type="text"
            className="input w-64 text-xs"
            placeholder="Search crop, buyer, destination..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="input text-xs"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="partially_committed">Partially Committed</option>
            <option value="fully_committed">Fully Committed</option>
            <option value="in_aggregation">In Aggregation Lot</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <button className="btn-outline text-xs" onClick={reload}>
          🔄 Refresh
        </button>
      </div>

      {/* Demands Table */}
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : demands.length === 0 ? (
        <Empty title="No global demands match your filters" hint="Check back as international buyers submit requirements." />
      ) : (
        <div className="card overflow-x-auto p-0 border border-stone-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b text-stone-600 font-semibold">
              <tr>
                <th className="p-3">Demand ID</th>
                <th className="p-3">Crop / Variety</th>
                <th className="p-3">Buyer / Company</th>
                <th className="p-3">Destination</th>
                <th className="p-3">Target Rate</th>
                <th className="p-3">Volume (Req / Com / Rem)</th>
                <th className="p-3">Fulfillment</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {demands.map((d) => (
                <tr key={d._id} className="hover:bg-stone-50/50">
                  <td className="p-3 font-mono font-bold text-stone-800">#{d.demandId}</td>
                  <td className="p-3">
                    <b>{d.cropName}</b> {d.variety ? `(${d.variety})` : ''}
                    <span className="text-[10px] text-stone-500 block">Grade {d.targetGrade || 'A'}</span>
                  </td>
                  <td className="p-3">
                    <b>{d.buyerCompany || d.buyerName}</b>
                    <span className="text-[10px] text-stone-500 block">{d.buyerEmail}</span>
                  </td>
                  <td className="p-3">
                    {d.destinationPort}, {d.destinationCountry}
                    <span className="text-[10px] text-stone-500 block">{d.incoterms || 'CIF'}</span>
                  </td>
                  <td className="p-3 font-semibold text-leaf-800">₹{d.targetPricePerKg}/kg</td>
                  <td className="p-3">
                    <span>Req: <b>{d.requiredQuantityKg?.toLocaleString()} kg</b></span>
                    <span className="text-stone-500 block text-[11px]">
                      Com: {d.committedQuantityKg?.toLocaleString() || 0} kg · Rem: {d.remainingQuantityKg?.toLocaleString() || 0} kg
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="w-24 bg-stone-200 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${d.fulfillmentPercentage || 0}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-indigo-700 mt-0.5 block">{d.fulfillmentPercentage || 0}%</span>
                  </td>
                  <td className="p-3">
                    <Badge>{d.status}</Badge>
                  </td>
                  <td className="p-3 text-right space-x-1">
                    <button
                      className="btn-outline text-[11px] px-2 py-1"
                      onClick={() => setSelectedDemand(d)}
                    >
                      Inspect ({d.contributions?.length || 0})
                    </button>
                    {d.status !== 'cancelled' && (
                      <button
                        className="btn-outline text-[11px] px-2 py-1 text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleCancelDemand(d._id)}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Contributions Inspection Drawer / Modal */}
      {selectedDemand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <h3 className="text-lg font-bold text-stone-900">
                  Farmer Contributions: Demand #{selectedDemand.demandId} ({selectedDemand.cropName})
                </h3>
                <p className="text-xs text-stone-500">
                  Target: {selectedDemand.requiredQuantityKg?.toLocaleString()} kg · Destination: {selectedDemand.destinationCountry}
                </p>
              </div>
              <button
                className="btn-outline text-xs px-2 py-1"
                onClick={() => setSelectedDemand(null)}
              >
                ✕ Close
              </button>
            </div>

            {!selectedDemand.contributions?.length ? (
              <p className="text-center py-6 text-sm text-stone-500">
                No farmer contributions recorded for this demand yet.
              </p>
            ) : (
              <div className="space-y-3">
                {selectedDemand.contributions.map((c) => (
                  <div key={c.contributionId || c._id} className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-xs space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono font-bold text-stone-600 block text-[11px]">#{c.contributionId}</span>
                        <p className="font-bold text-stone-900 text-sm">{c.farmerName} ({c.farmerLocation || c.farmerState})</p>
                        {c.farmerPhone && <p className="text-[11px] text-stone-500">Contact: {c.farmerPhone}</p>}
                      </div>
                      <Badge>{c.status}</Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-white p-2 rounded border border-stone-100">
                      <div><span className="text-stone-500">Committed:</span> <b>{c.quantityKg} kg</b></div>
                      <div><span className="text-stone-500">Rate:</span> <b>₹{c.offeredPriceInr}/kg</b></div>
                      <div><span className="text-stone-500">Gross Value:</span> <b>₹{c.grossValueInr?.toLocaleString()}</b></div>
                    </div>

                    {c.acceptedQuantityKg > 0 && (
                      <div className="p-1.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
                        ✓ Accepted: <b>{c.acceptedQuantityKg} kg</b> {c.rejectedQuantityKg > 0 && `· Rejected: ${c.rejectedQuantityKg} kg`}
                        {c.inspectionNotes && <p className="text-[11px] text-emerald-700 italic mt-0.5">{c.inspectionNotes}</p>}
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <button
                        className="btn-primary text-xs px-3 py-1"
                        onClick={() => {
                          setInspectContrib(c);
                          setAcceptedQty(c.quantityKg);
                          setRejectedQty(0);
                          setQcGrade(c.grade || selectedDemand.targetGrade || 'A');
                          setQcNotes('QC inspection passed phytosanitary export standards');
                        }}
                      >
                        🔬 Record QC Inspection
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Record Inspection Modal */}
      {inspectContrib && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-stone-900">
                QC Inspection: Contribution #{inspectContrib.contributionId}
              </h3>
              <button className="btn-outline text-xs px-2 py-1" onClick={() => setInspectContrib(null)}>
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleInspectSubmit} className="space-y-3 text-xs">
              <p className="text-stone-600">
                Farmer: <b>{inspectContrib.farmerName}</b> · Total Produce: <b>{inspectContrib.quantityKg} kg</b>
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Accepted Qty (kg) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max={inspectContrib.quantityKg}
                    className="input w-full"
                    value={acceptedQty}
                    onChange={(e) => {
                      const acc = Number(e.target.value);
                      setAcceptedQty(acc);
                      setRejectedQty(Math.max(0, inspectContrib.quantityKg - acc));
                    }}
                  />
                </div>
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Rejected Qty (kg) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max={inspectContrib.quantityKg}
                    className="input w-full"
                    value={rejectedQty}
                    onChange={(e) => {
                      const rej = Number(e.target.value);
                      setRejectedQty(rej);
                      setAcceptedQty(Math.max(0, inspectContrib.quantityKg - rej));
                    }}
                  />
                </div>
              </div>

              {Number(rejectedQty) > 0 && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-900 text-[11px]">
                  ⚠️ <b>Notice:</b> {rejectedQty} kg rejected will be automatically restored to the farmer's free farm inventory.
                </div>
              )}

              <div>
                <label className="block font-medium text-stone-700 mb-1">Assigned Quality Grade</label>
                <select
                  className="input w-full"
                  value={qcGrade}
                  onChange={(e) => setQcGrade(e.target.value)}
                >
                  <option value="A">Grade A (Premium Export Quality)</option>
                  <option value="B">Grade B (Standard Commercial)</option>
                  <option value="C">Grade C (Processing)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">QC Inspector Observations & Notes</label>
                <textarea
                  rows={2}
                  className="input w-full"
                  value={qcNotes}
                  onChange={(e) => setQcNotes(e.target.value)}
                  placeholder="e.g. Moisture within 11.5%, defect rate <2%, phytosanitary standards approved."
                />
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <button
                  type="submit"
                  disabled={savingQc}
                  className="btn-primary flex-1 py-2"
                >
                  {savingQc ? 'Saving QC...' : 'Confirm QC Inspection'}
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setInspectContrib(null)}
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

// ==========================================
// 2. AGGREGATION MANAGEMENT COMPONENT
// ==========================================

function AdminAggregation() {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLot, setActiveLot] = useState(null);
  const [showQcModal, setShowQcModal] = useState(false);
  const [showContainerModal, setShowContainerModal] = useState(false);
  const [showBuyerModal, setShowBuyerModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);

  // Form states
  const [qcInspector, setQcInspector] = useState('Chief QC Officer');
  const [qcPassed, setQcPassed] = useState(true);
  const [qcMoisture, setQcMoisture] = useState('11.5');
  const [qcNotes, setQcNotes] = useState('Meets APEDA export quality standards');

  const [containerType, setContainerType] = useState('40ft High Cube Reefer');
  const [containerId, setContainerId] = useState('');
  const [sealNumber, setSealNumber] = useState('');
  const [tempSetpoint, setTempSetpoint] = useState('+4°C to +6°C');
  const [shippingLine, setShippingLine] = useState('Maersk Line');
  const [portLoading, setPortLoading] = useState('JNPT Mumbai');
  const [portDischarge, setPortDischarge] = useState('Jebel Ali Port, Dubai');

  const [buyerName, setBuyerName] = useState('');
  const [destCountry, setDestCountry] = useState('UAE');
  const [salePriceKg, setSalePriceKg] = useState('');
  const [commPct, setCommPct] = useState('5');

  const [docType, setDocType] = useState('Phytosanitary Certificate');
  const [docNumber, setDocNumber] = useState('');
  const [docIssuer, setDocIssuer] = useState('APEDA / NPPO India');

  const lotsApi = useApi('/admin/aggregation/lots', {
    status: filterStatus || undefined,
    cropName: searchTerm || undefined
  });

  const companiesApi = useApi('/companies', { verified: 'true' });

  const reloadAll = () => {
    lotsApi.reload();
    if (activeLot) {
      api.get(`/admin/aggregation/lots/${activeLot.lotId || activeLot._id}`).then((r) => setActiveLot(r.data.lot));
    }
  };

  const handleUpdateStatus = async (lot, newStatus) => {
    try {
      await api.patch(`/admin/aggregation/lots/${lot.lotId}/status`, { status: newStatus });
      toast(`Lot status updated to ${newStatus}`);
      reloadAll();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const submitQc = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/admin/aggregation/lots/${activeLot.lotId}/inspection`, {
        inspectorName: qcInspector,
        passed: qcPassed,
        gradeAssigned: activeLot.grade,
        moisturePercent: Number(qcMoisture),
        notes: qcNotes
      });
      toast('QC Inspection recorded successfully');
      setShowQcModal(false);
      reloadAll();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const submitContainer = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/admin/aggregation/lots/${activeLot.lotId}/container`, {
        containerType,
        containerId,
        sealNumber,
        temperatureSetpoint: tempSetpoint,
        shippingLine,
        portOfLoading: portLoading,
        portOfDischarge: portDischarge
      });
      toast('Container & shipping details allocated');
      setShowContainerModal(false);
      reloadAll();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const submitBuyer = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/admin/aggregation/lots/${activeLot.lotId}/buyer`, {
        buyerName,
        destinationCountry: destCountry,
        exportSalePricePerKg: Number(salePriceKg),
        platformCommissionPercent: Number(commPct)
      });
      toast('International buyer and export financial allocations set');
      setShowBuyerModal(false);
      reloadAll();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const submitDoc = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/admin/aggregation/lots/${activeLot.lotId}/documents`, {
        docType,
        docNumber,
        issuedBy: docIssuer,
        status: 'verified'
      });
      toast('Export document added to lot');
      setShowDocModal(false);
      reloadAll();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  if (lotsApi.loading) return <Spinner />;
  if (lotsApi.error) return <ErrorBox message={lotsApi.error} onRetry={lotsApi.reload} />;

  const lots = lotsApi.data?.lots || [];

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            placeholder="Search crop name..."
            className="input w-48 text-xs"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="input text-xs w-44"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            {Object.keys(LOT_STATUS_BADGES).map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          {(searchTerm || filterStatus) && (
            <button
              className="btn-outline text-xs px-2 py-1"
              onClick={() => { setSearchTerm(''); setFilterStatus(''); }}
            >
              Reset
            </button>
          )}
        </div>
        <p className="text-xs text-stone-500 font-medium">{lots.length} bulk lots found</p>
      </div>

      {/* Lots Table */}
      {!lots.length ? (
        <Empty title="No aggregation lots found" hint="Try adjusting your filter or trigger automatic aggregation." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b bg-stone-50 text-stone-500">
              <tr>
                <th className="p-3">Lot ID & Crop</th>
                <th>Aggregated / Target</th>
                <th>State & Region</th>
                <th>Avg Rate</th>
                <th>Status</th>
                <th>Container & Buyer</th>
                <th className="text-right p-3">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {lots.map((lot) => {
                const badge = LOT_STATUS_BADGES[lot.status] || { text: lot.status, bg: 'bg-stone-100 text-stone-600' };
                const pct = Math.min(100, Math.round((lot.totalQuantityKg / lot.targetQuantityKg) * 100));
                return (
                  <tr key={lot._id} className="hover:bg-stone-50/50">
                    <td className="p-3">
                      <div className="font-bold text-stone-800">{lot.lotId}</div>
                      <div className="font-medium text-leaf-700">{lot.cropName} (Grade {lot.grade})</div>
                      <div className="text-[11px] text-stone-400">{lot.participatingFarmersCount || lot.contributions?.length || 0} farmers contributing</div>
                    </td>
                    <td>
                      <div className="font-bold text-stone-800">{lot.totalQuantityKg.toLocaleString()} / {lot.targetQuantityKg.toLocaleString()} kg</div>
                      <div className="mt-1 h-1.5 w-32 rounded-full bg-stone-200 overflow-hidden">
                        <div className="h-full bg-leaf-600" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-stone-500">{pct}% filled</span>
                    </td>
                    <td>
                      <div className="font-medium text-stone-800">{lot.state}</div>
                      <div className="text-xs text-stone-500">{lot.region || 'Regional Hub'}</div>
                    </td>
                    <td>
                      <div className="font-semibold text-stone-800">₹{lot.weightedAvgPricePerKg}/kg</div>
                      <div className="text-[11px] text-stone-500">₹{(lot.totalQuantityKg * lot.weightedAvgPricePerKg).toLocaleString()} total</div>
                    </td>
                    <td>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border ${badge.bg}`}>
                        {badge.text}
                      </span>
                    </td>
                    <td>
                      {lot.containerId ? (
                        <div className="text-xs font-mono text-purple-700">📦 {lot.containerId}</div>
                      ) : (
                        <span className="text-xs text-stone-400">No container</span>
                      )}
                      {lot.buyerName && (
                        <div className="text-xs text-stone-600 truncate max-w-xs">🏢 {lot.buyerName} ({lot.destinationCountry})</div>
                      )}
                    </td>
                    <td className="text-right p-3 space-x-1">
                      <button
                        className="btn-outline text-xs px-2 py-1"
                        onClick={() => {
                          api.get(`/admin/aggregation/lots/${lot.lotId}`).then((r) => setActiveLot(r.data.lot));
                        }}
                      >
                        Inspect & Manage
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* DETAIL MODAL */}
      {activeLot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-3xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                  <span>Aggregation Lot: {activeLot.lotId}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${LOT_STATUS_BADGES[activeLot.status]?.bg}`}>
                    {activeLot.status.replace(/_/g, ' ')}
                  </span>
                </h3>
                <p className="text-xs text-stone-500">
                  {activeLot.cropName} · Grade {activeLot.grade} · {activeLot.state} · Weighted Rate: ₹{activeLot.weightedAvgPricePerKg}/kg
                </p>
              </div>
              <button
                className="btn-outline text-xs px-2 py-1"
                onClick={() => setActiveLot(null)}
              >
                ✕ Close
              </button>
            </div>

            {/* Admin Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-1 border-b pb-3">
              <button
                className="btn-primary text-xs"
                onClick={() => setShowQcModal(true)}
              >
                🔬 QC Inspection Report
              </button>
              <button
                className="btn-outline text-xs"
                onClick={() => {
                  setContainerId(activeLot.containerId || `MSKU-${Math.floor(100000 + Math.random() * 900000)}`);
                  setSealNumber(activeLot.sealNumber || `IN-BLR-${Math.floor(10000 + Math.random() * 90000)}`);
                  setShowContainerModal(true);
                }}
              >
                📦 Container Allocation
              </button>
              <button
                className="btn-outline text-xs"
                onClick={() => {
                  setBuyerName(activeLot.buyerName || '');
                  setDestCountry(activeLot.destinationCountry || 'UAE');
                  setSalePriceKg(activeLot.exportSalePricePerKg || activeLot.weightedAvgPricePerKg * 1.3);
                  setShowBuyerModal(true);
                }}
              >
                🌍 Assign Buyer & Finances
              </button>
              <button
                className="btn-outline text-xs"
                onClick={() => setShowDocModal(true)}
              >
                📄 Export Docs
              </button>
              {activeLot.status === 'allocated_for_export' && (
                <button
                  className="btn-primary text-xs bg-cyan-700 hover:bg-cyan-800"
                  onClick={() => handleUpdateStatus(activeLot, 'in_transit')}
                >
                  🚢 Dispatch (In Transit)
                </button>
              )}
              {activeLot.status === 'in_transit' && (
                <button
                  className="btn-primary text-xs bg-emerald-700 hover:bg-emerald-800"
                  onClick={() => handleUpdateStatus(activeLot, 'exported')}
                >
                  ✅ Mark Fully Exported
                </button>
              )}
            </div>

            {/* Participating Farmers Contributions */}
            <div>
              <h4 className="text-sm font-bold text-stone-800 mb-2">
                🌾 Participating Farmers Contributions ({activeLot.contributions?.length || 0})
              </h4>
              <div className="overflow-x-auto max-h-48 border rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-stone-50 border-b">
                    <tr>
                      <th className="p-2">Farmer</th>
                      <th>Location</th>
                      <th>Quantity (kg)</th>
                      <th>Rate</th>
                      <th>Delivery Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {(activeLot.contributions || []).map((c, i) => (
                      <tr key={i}>
                        <td className="p-2 font-semibold text-stone-800">{c.farmerName}</td>
                        <td className="text-stone-500">{c.farmerLocation || c.farmerState || 'Kolar'}</td>
                        <td className="font-bold text-leaf-700">{c.quantityInKg} kg</td>
                        <td>₹{c.pricePerKg}/kg</td>
                        <td>
                          <span className="rounded bg-stone-100 px-1.5 py-0.5 capitalize text-[10px] text-stone-700">
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Container & Export Logistics Breakdown */}
            {activeLot.containerId && (
              <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3 text-xs">
                <h4 className="font-bold text-purple-900 mb-1">📦 Container & Shipping Route</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-stone-700">
                  <div><span className="text-stone-400 block">Container:</span> <b className="font-mono">{activeLot.containerId}</b></div>
                  <div><span className="text-stone-400 block">Seal:</span> <b className="font-mono">{activeLot.sealNumber}</b></div>
                  <div><span className="text-stone-400 block">Temp:</span> {activeLot.temperatureSetpoint}</div>
                  <div><span className="text-stone-400 block">Shipping Line:</span> {activeLot.shippingLine}</div>
                  <div><span className="text-stone-400 block">Port Loading:</span> {activeLot.portOfLoading}</div>
                  <div><span className="text-stone-400 block">Port Discharge:</span> {activeLot.portOfDischarge}</div>
                  <div><span className="text-stone-400 block">Shipment Status:</span> <b className="capitalize text-purple-800">{activeLot.shipmentStatus?.replace(/_/g, ' ')}</b></div>
                </div>
                <div className="mt-2 text-right">
                  <Link to="/logistics" className="text-xs font-bold text-purple-700 hover:underline">
                    Open Reefer Cold Chain & Ocean Tracking ➔
                  </Link>
                </div>
              </div>
            )}

            {/* Export Financials Breakdown */}
            {activeLot.exportSalePricePerKg > 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs">
                <h4 className="font-bold text-emerald-900 mb-1">💰 Export Financial Breakdown</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-stone-700">
                  <div><span className="text-stone-400 block">Export Agreed Rate:</span> <b>₹{activeLot.exportSalePricePerKg}/kg</b></div>
                  <div><span className="text-stone-400 block">Gross Export Value:</span> <b className="text-emerald-800">₹{activeLot.totalExportValueInr?.toLocaleString()}</b></div>
                  <div><span className="text-stone-400 block">Platform Facilitation (5%):</span> <b>₹{activeLot.platformCommissionInr?.toLocaleString()}</b></div>
                  <div><span className="text-stone-400 block">Net Farmer Disbursal:</span> <b className="text-leaf-800">₹{activeLot.netFarmerDisbursalInr?.toLocaleString()}</b></div>
                </div>
              </div>
            )}

            {/* Export Documentation */}
            {activeLot.documents?.length > 0 && (
              <div className="border rounded-lg p-3 text-xs">
                <h4 className="font-bold text-stone-800 mb-2">📜 Export Documentation Checklist</h4>
                <div className="space-y-1">
                  {activeLot.documents.map((d, i) => (
                    <div key={i} className="flex items-center justify-between bg-stone-50 p-1.5 rounded">
                      <span className="font-semibold text-stone-700">{d.docType} ({d.docNumber || 'Verified'})</span>
                      <span className="text-stone-500">{d.issuedBy}</span>
                      <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[10px] font-bold">
                        {d.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QC INSPECTION MODAL */}
      {showQcModal && activeLot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-stone-800">🔬 Record QC Inspection ({activeLot.lotId})</h3>
            <form onSubmit={submitQc} className="mt-3 space-y-3 text-xs">
              <Field label="Inspector Name" id="insName">
                <input className="input" value={qcInspector} onChange={(e) => setQcInspector(e.target.value)} required />
              </Field>
              <Field label="Inspection Outcome" id="qcPass">
                <select className="input" value={qcPassed ? 'true' : 'false'} onChange={(e) => setQcPassed(e.target.value === 'true')}>
                  <option value="true">Passed (Meets Export Quality Standards)</option>
                  <option value="false">Failed (Requires Re-sorting / Downgrade)</option>
                </select>
              </Field>
              <Field label="Moisture Content (%)" id="qcMoist">
                <input type="number" step="0.1" className="input" value={qcMoisture} onChange={(e) => setQcMoisture(e.target.value)} />
              </Field>
              <Field label="Inspection Remarks" id="qcNote">
                <textarea rows="2" className="input" value={qcNotes} onChange={(e) => setQcNotes(e.target.value)} />
              </Field>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" className="btn-outline" onClick={() => setShowQcModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Inspection</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONTAINER ALLOCATION MODAL */}
      {showContainerModal && activeLot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-stone-800">📦 Container & Reefer Allocation ({activeLot.lotId})</h3>
            <form onSubmit={submitContainer} className="mt-3 space-y-3 text-xs">
              <Field label="Container Type" id="cType">
                <select className="input" value={containerType} onChange={(e) => setContainerType(e.target.value)}>
                  <option>40ft High Cube Reefer</option>
                  <option>20ft Standard Reefer</option>
                  <option>40ft Standard Dry Container</option>
                  <option>20ft Standard Dry Container</option>
                  <option>Air Cargo Temperature Controlled ULD</option>
                </select>
              </Field>
              <Field label="Container Number" id="cId">
                <input className="input" placeholder="e.g. MSKU-849201-3" value={containerId} onChange={(e) => setContainerId(e.target.value)} required />
              </Field>
              <Field label="High-Security Seal Number" id="sNum">
                <input className="input" placeholder="e.g. IN-BLR-84921" value={sealNumber} onChange={(e) => setSealNumber(e.target.value)} required />
              </Field>
              <Field label="Temperature Setpoint" id="tSet">
                <input className="input" placeholder="+4°C to +6°C" value={tempSetpoint} onChange={(e) => setTempSetpoint(e.target.value)} />
              </Field>
              <Field label="Shipping Line / Freight Forwarder" id="sLine">
                <input className="input" placeholder="Maersk Line / MSC" value={shippingLine} onChange={(e) => setShippingLine(e.target.value)} />
              </Field>
              <Field label="Port of Loading" id="pLoad">
                <input className="input" placeholder="JNPT Mumbai / Chennai Port" value={portLoading} onChange={(e) => setPortLoading(e.target.value)} />
              </Field>
              <Field label="Port of Discharge" id="pDisc">
                <input className="input" placeholder="Jebel Ali Port, Dubai" value={portDischarge} onChange={(e) => setPortDischarge(e.target.value)} />
              </Field>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" className="btn-outline" onClick={() => setShowContainerModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Allocate Container</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN BUYER MODAL */}
      {showBuyerModal && activeLot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-stone-800">🌍 Assign International Buyer ({activeLot.lotId})</h3>
            <form onSubmit={submitBuyer} className="mt-3 space-y-3 text-xs">
              <Field label="Select from Verified Companies" id="coSelect">
                <select
                  className="input"
                  onChange={(e) => {
                    const found = (companiesApi.data?.items || []).find((c) => c._id === e.target.value);
                    if (found) {
                      setBuyerName(found.name);
                      setDestCountry(found.country);
                    }
                  }}
                >
                  <option value="">-- Choose verified importer --</option>
                  {(companiesApi.data?.items || []).map((c) => (
                    <option key={c._id} value={c._id}>{c.name} ({c.country})</option>
                  ))}
                </select>
              </Field>
              <Field label="Buyer Company Name" id="bName">
                <input className="input" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} required />
              </Field>
              <Field label="Destination Country" id="dCountry">
                <input className="input" value={destCountry} onChange={(e) => setDestCountry(e.target.value)} required />
              </Field>
              <Field label="Agreed Export Sale Price (INR / kg)" id="sPrice">
                <input type="number" step="0.5" className="input" value={salePriceKg} onChange={(e) => setSalePriceKg(e.target.value)} required />
              </Field>
              <Field label="Platform Commission (%)" id="cPct">
                <input type="number" className="input" value={commPct} onChange={(e) => setCommPct(e.target.value)} />
              </Field>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" className="btn-outline" onClick={() => setShowBuyerModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Confirm Allocation</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXPORT DOCUMENT MODAL */}
      {showDocModal && activeLot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-stone-800">📄 Add Export Document ({activeLot.lotId})</h3>
            <form onSubmit={submitDoc} className="mt-3 space-y-3 text-xs">
              <Field label="Document Type" id="dType">
                <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
                  <option>Phytosanitary Certificate</option>
                  <option>Certificate of Origin (CoO)</option>
                  <option>Bill of Lading (B/L)</option>
                  <option>Commercial Invoice & Packing List</option>
                  <option>Quality & Pesticide Residue Lab Report</option>
                  <option>Fumigation Certificate</option>
                </select>
              </Field>
              <Field label="Document / Certificate Number" id="dNum">
                <input className="input" placeholder="e.g. PHYTO-IN-2026-9812" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} required />
              </Field>
              <Field label="Issuing Authority" id="dIss">
                <input className="input" value={docIssuer} onChange={(e) => setDocIssuer(e.target.value)} required />
              </Field>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" className="btn-outline" onClick={() => setShowDocModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add Document</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. COLLECTIONS & HUBS COMPONENT
// ==========================================

function AdminCollections() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedCol, setSelectedCol] = useState(null);
  const [settlingCol, setSettlingCol] = useState(null);
  const [paymentRef, setPaymentRef] = useState('');

  const { data, loading, error, reload } = useApi('/admin/collections', {
    status: statusFilter || undefined
  });

  const handleUpdateStatus = async (col, status, payload = {}) => {
    try {
      await api.patch(`/collections/${col.collectionId || col._id}/status`, {
        status,
        ...payload
      });
      toast(`Collection status updated to ${status}`);
      reload();
      if (selectedCol) setSelectedCol(null);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const handleSettleFarmer = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/admin/financials/settle-farmer/${settlingCol.collectionId || settlingCol._id}`, {
        paymentReference: paymentRef || `UPI-AGRI-${Math.floor(100000 + Math.random() * 900000)}`
      });
      toast('Farmer payment settled successfully');
      setSettlingCol(null);
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const collections = data?.collections || [];

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            className="input text-xs w-48"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Collection Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_transit">In Transit</option>
            <option value="inspected_at_farm">Inspected at Farm</option>
            <option value="delivered_to_hub">Delivered to Hub</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
          {statusFilter && (
            <button className="btn-outline text-xs px-2 py-1" onClick={() => setStatusFilter('')}>Reset</button>
          )}
        </div>
        <p className="text-xs text-stone-500 font-medium">{collections.length} collection pickups recorded</p>
      </div>

      {!collections.length ? (
        <Empty title="No collections found" hint="Farmers have not scheduled any pickups matching this filter." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b bg-stone-50 text-stone-500">
              <tr>
                <th className="p-3">Pickup ID & Crop</th>
                <th>Farmer & Location</th>
                <th>Scheduled Date</th>
                <th>Quantities (Est / Acc)</th>
                <th>Status</th>
                <th>Payment</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {collections.map((c) => (
                <tr key={c._id} className="hover:bg-stone-50/50">
                  <td className="p-3">
                    <div className="font-bold text-stone-800">{c.collectionId}</div>
                    <div className="font-medium text-leaf-700">{c.cropName} (Grade {c.grade})</div>
                    {c.lotId && <div className="text-[10px] text-purple-700 font-semibold">📦 Linked: {c.lotId}</div>}
                  </td>
                  <td>
                    <div className="font-semibold text-stone-800">{c.farmer?.name || 'Farmer'}</div>
                    <div className="text-xs text-stone-500 truncate max-w-xs">{c.pickupAddress}</div>
                    {c.coordinates?.latitude && (
                      <div className="text-[10px] text-emerald-700 font-mono">🛰️ {c.coordinates.latitude}, {c.coordinates.longitude}</div>
                    )}
                  </td>
                  <td>
                    <div>{new Date(c.scheduledDate).toLocaleDateString()}</div>
                    <div className="text-xs text-stone-400">{new Date(c.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td>
                    <div className="font-bold text-stone-800">
                      {c.acceptedQuantityKg !== null ? `${c.acceptedQuantityKg} kg (accepted)` : `${c.estimatedQuantityKg} kg (est)`}
                    </div>
                    {c.rejectedQuantityKg > 0 && <div className="text-xs text-red-600">{c.rejectedQuantityKg} kg rejected</div>}
                    <div className="text-xs text-stone-500">Rate: ₹{c.unitPriceInr}/kg</div>
                  </td>
                  <td>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold capitalize text-stone-700 border">
                      {c.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    <div className="font-bold text-stone-800">₹{(c.totalFinalPayoutInr ?? c.totalEstimatedPayoutInr)?.toLocaleString()}</div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      c.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {c.paymentStatus}
                    </span>
                    {c.paymentReference && <div className="text-[10px] text-stone-500 font-mono mt-0.5">{c.paymentReference}</div>}
                  </td>
                  <td className="text-right p-3 space-x-1">
                    {c.status !== 'accepted' && (
                      <button
                        className="btn-outline text-xs px-2 py-1"
                        onClick={() => setSelectedCol(c)}
                      >
                        Advance Status
                      </button>
                    )}
                    {c.status === 'accepted' && c.paymentStatus !== 'paid' && (
                      <button
                        className="btn-primary text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => {
                          setSettlingCol(c);
                          setPaymentRef(`UPI-AGRI-${Math.floor(100000 + Math.random() * 900000)}`);
                        }}
                      >
                        Settle Payment
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* QUICK STATUS ADVANCE MODAL */}
      {selectedCol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-stone-800">🚚 Advance Collection {selectedCol.collectionId}</h3>
            <p className="text-xs text-stone-500 mt-1">Current status: <b>{selectedCol.status}</b></p>
            <div className="mt-4 flex flex-col gap-2 text-xs">
              {selectedCol.status === 'scheduled' && (
                <button
                  className="btn-outline text-left"
                  onClick={() => handleUpdateStatus(selectedCol, 'in_transit', { note: 'Vehicle dispatched to farm' })}
                >
                  🚚 Mark In Transit (Dispatched)
                </button>
              )}
              {['scheduled', 'in_transit'].includes(selectedCol.status) && (
                <button
                  className="btn-outline text-left"
                  onClick={() => handleUpdateStatus(selectedCol, 'inspected_at_farm', {
                    note: 'On-site farm digital weighing and QC verified',
                    inspection: { inspectorName: 'QC Inspector', gradeAssigned: selectedCol.grade || 'A', passed: true }
                  })}
                >
                  🔬 Complete Farm Gate QC Inspection
                </button>
              )}
              {['in_transit', 'inspected_at_farm'].includes(selectedCol.status) && (
                <button
                  className="btn-outline text-left"
                  onClick={() => handleUpdateStatus(selectedCol, 'delivered_to_hub', {
                    centerName: 'Bangalore Regional Hub',
                    note: 'Produce unloaded at collection hub'
                  })}
                >
                  🏢 Deliver to Regional Hub
                </button>
              )}
              {['inspected_at_farm', 'delivered_to_hub'].includes(selectedCol.status) && (
                <button
                  className="btn-primary text-left"
                  onClick={() => handleUpdateStatus(selectedCol, 'accepted', {
                    acceptedQuantityKg: selectedCol.estimatedQuantityKg,
                    note: 'Full batch accepted into commercial export lot'
                  })}
                >
                  ✅ Accept Produce & Queue Payout
                </button>
              )}
            </div>
            <div className="mt-4 flex justify-end border-t pt-2">
              <button className="btn-outline text-xs" onClick={() => setSelectedCol(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* SETTLE FARMER MODAL */}
      {settlingCol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-stone-800">💰 Settle Farmer Payment</h3>
            <p className="text-xs text-stone-500 mt-1">
              Collection: {settlingCol.collectionId} · {settlingCol.cropName} ({settlingCol.acceptedQuantityKg} kg)
            </p>
            <p className="mt-2 text-lg font-bold text-emerald-800">
              Amount to Disburse: ₹{settlingCol.totalFinalPayoutInr?.toLocaleString()}
            </p>
            <form onSubmit={handleSettleFarmer} className="mt-3 space-y-3 text-xs">
              <Field label="Payment / DBT Reference" id="pRef">
                <input className="input font-mono" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} required />
              </Field>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" className="btn-outline" onClick={() => setSettlingCol(null)}>Cancel</button>
                <button type="submit" className="btn-primary bg-emerald-600 hover:bg-emerald-700">Confirm Settlement</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 4. EXPORT & SHIPPING COMPONENT
// ==========================================

function AdminExportShipping() {
  const { toast } = useToast();
  const { data, loading, error, reload } = useApi('/admin/exports');
  const [selectedLot, setSelectedLot] = useState(null);
  const [shipStatus, setShipStatus] = useState('in_transit_sea');
  const [shipNotes, setShipNotes] = useState('');

  const submitStatus = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/admin/exports/${selectedLot.lotId}/shipment-status`, {
        shipmentStatus: shipStatus,
        notes: shipNotes
      });
      toast(`Shipment status updated to ${shipStatus}`);
      setSelectedLot(null);
      reload();
    } catch (e2) {
      toast(errMsg(e2), 'error');
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const metrics = data?.metrics || {};
  const exportLots = data?.exportLots || [];

  return (
    <div className="space-y-4">
      {/* Container Utilization & Shipping KPI Card */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card text-center p-4 border-l-4 border-l-indigo-600">
          <p className="text-2xl font-black text-indigo-900">{metrics.totalExportLots || 0}</p>
          <p className="text-xs font-semibold text-stone-500 mt-1">Export Shipments</p>
        </div>
        <div className="card text-center p-4 border-l-4 border-l-purple-600">
          <p className="text-2xl font-black text-purple-900">{metrics.totalExportContainers || 0}</p>
          <p className="text-xs font-semibold text-stone-500 mt-1">Containers Allocated</p>
        </div>
        <div className="card text-center p-4 border-l-4 border-l-emerald-600">
          <p className="text-2xl font-black text-emerald-900">{(metrics.totalShippedWeightKg / 1000).toFixed(1)} MT</p>
          <p className="text-xs font-semibold text-stone-500 mt-1">Total Export Weight</p>
        </div>
        <div className="card text-center p-4 border-l-4 border-l-blue-600">
          <p className="text-2xl font-black text-blue-900">{metrics.containerUtilizationRate || 0}%</p>
          <p className="text-xs font-semibold text-stone-500 mt-1">Average Reefer Capacity Utilization</p>
        </div>
      </div>

      {/* Export Shipments Table */}
      {!exportLots.length ? (
        <Empty title="No export lots currently active" hint="Allocate bulk lots for export in the Crop Aggregation Lots tab." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b bg-stone-50 text-stone-500">
              <tr>
                <th className="p-3">Lot ID & Crop</th>
                <th>Volume (MT / kg)</th>
                <th>Buyer & Destination</th>
                <th>Container & Seal</th>
                <th>Shipping Line & Port</th>
                <th>Shipment Lifecycle</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {exportLots.map((lot) => (
                <tr key={lot._id} className="hover:bg-stone-50/50">
                  <td className="p-3">
                    <div className="font-bold text-stone-800">{lot.lotId}</div>
                    <div className="font-medium text-leaf-700">{lot.cropName} (Grade {lot.grade})</div>
                  </td>
                  <td>
                    <div className="font-bold text-stone-800">{(lot.totalQuantityKg / 1000).toFixed(2)} MT</div>
                    <div className="text-xs text-stone-400">{lot.totalQuantityKg.toLocaleString()} kg</div>
                  </td>
                  <td>
                    <div className="font-semibold text-stone-800">{lot.buyerName || 'International Buyer'}</div>
                    <div className="text-xs text-stone-500">{lot.destinationCountry || 'UAE'}</div>
                  </td>
                  <td>
                    {lot.containerId ? (
                      <div>
                        <div className="font-mono text-xs font-bold text-purple-700">📦 {lot.containerId}</div>
                        <div className="font-mono text-[11px] text-stone-500">Seal: {lot.sealNumber}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-amber-700 font-semibold">⚠️ Pending Container</span>
                    )}
                  </td>
                  <td>
                    <div className="font-medium text-stone-800">{lot.shippingLine || 'Maersk'}</div>
                    <div className="text-xs text-stone-500">{lot.portOfLoading} &rarr; {lot.portOfDischarge || 'Jebel Ali'}</div>
                  </td>
                  <td>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-800 capitalize border border-blue-200">
                      {lot.shipmentStatus?.replace(/_/g, ' ') || 'Unallocated'}
                    </span>
                  </td>
                  <td className="text-right p-3">
                    <button
                      className="btn-outline text-xs px-2 py-1"
                      onClick={() => {
                        setSelectedLot(lot);
                        setShipStatus(lot.shipmentStatus || 'in_transit_sea');
                        setShipNotes(lot.notes || '');
                      }}
                    >
                      Update Shipment
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* UPDATE SHIPMENT MODAL */}
      {selectedLot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-stone-800">🚢 Update Shipment Status ({selectedLot.lotId})</h3>
            <form onSubmit={submitStatus} className="mt-3 space-y-3 text-xs">
              <Field label="Shipment Status" id="sStat">
                <select className="input" value={shipStatus} onChange={(e) => setShipStatus(e.target.value)}>
                  <option value="booked">Container Booked</option>
                  <option value="loaded_at_port">Loaded onto Vessel at Port</option>
                  <option value="in_transit_sea">In Transit (Sea/Air Freight)</option>
                  <option value="customs_cleared">Customs Cleared at Destination</option>
                  <option value="delivered_to_importer">Delivered to Importer Warehouse</option>
                </select>
              </Field>
              <Field label="Tracking Notes / Vessel Log" id="sNote">
                <textarea rows="3" className="input" placeholder="e.g. Vessel MSC Isabella departed JNPT on schedule" value={shipNotes} onChange={(e) => setShipNotes(e.target.value)} />
              </Field>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" className="btn-outline" onClick={() => setSelectedLot(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Tracking Status</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 5. FINANCIALS & SETTLEMENTS COMPONENT
// ==========================================

function AdminFinancials() {
  const { data, loading, error, reload } = useApi('/admin/financials/summary');

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const m = data?.metrics || {};
  const settlements = data?.recentSettlements || [];

  const downloadReportCsv = () => {
    let csv = 'Pickup ID,Type,Farmer Name,Crop Name,Quantity Kg,Amount INR,Status,Reference,Date\n';
    settlements.forEach((s) => {
      csv += `"${s.id}","${s.type}","${s.farmerName}","${s.cropName}",${s.quantityKg},${s.amountInr},"${s.status}","${s.reference}","${s.settledAt || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AgriGlobal-Financial-Settlements-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Financials Strip */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card text-center p-4 border-l-4 border-l-emerald-600">
          <p className="text-2xl font-black text-emerald-900">₹{(m.totalPaidFarmerInr || 0).toLocaleString()}</p>
          <p className="text-xs font-semibold text-stone-500 mt-1">Disbursed Farmer Payouts</p>
        </div>
        <div className="card text-center p-4 border-l-4 border-l-amber-600">
          <p className="text-2xl font-black text-amber-900">₹{(m.totalPendingFarmerInr || 0).toLocaleString()}</p>
          <p className="text-xs font-semibold text-stone-500 mt-1">Pending Settlements</p>
        </div>
        <div className="card text-center p-4 border-l-4 border-l-blue-600">
          <p className="text-2xl font-black text-blue-900">₹{(m.totalExportValueInr || 0).toLocaleString()}</p>
          <p className="text-xs font-semibold text-stone-500 mt-1">Total Commercial Export Value</p>
        </div>
        <div className="card text-center p-4 border-l-4 border-l-purple-600">
          <p className="text-2xl font-black text-purple-900">₹{(m.totalCommissionsInr || 0).toLocaleString()}</p>
          <p className="text-xs font-semibold text-stone-500 mt-1">Marketplace Export Commissions (5%)</p>
        </div>
      </div>

      <div className="card flex items-center justify-between">
        <div>
          <h3 className="font-bold text-stone-800 text-sm">Disbursement Audit & Settlement Ledger</h3>
          <p className="text-xs text-stone-500">Detailed record of verified payouts directly deposited into farmer accounts</p>
        </div>
        <button className="btn-primary text-xs" onClick={downloadReportCsv}>
          📥 Download Financial Report (CSV)
        </button>
      </div>

      {!settlements.length ? (
        <Empty title="No settlements recorded yet" hint="Settle farmer payments from the Collections tab once produce is verified." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b bg-stone-50 text-stone-500">
              <tr>
                <th className="p-3">Reference / ID</th>
                <th>Farmer Name</th>
                <th>Produce & Volume</th>
                <th>Amount Disbursed</th>
                <th>Status</th>
                <th>Settlement Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {settlements.map((s, i) => (
                <tr key={i} className="hover:bg-stone-50/50">
                  <td className="p-3">
                    <div className="font-mono text-xs font-bold text-stone-800">{s.id}</div>
                    <div className="font-mono text-[10px] text-emerald-700">{s.reference}</div>
                  </td>
                  <td className="font-medium text-stone-800">{s.farmerName}</td>
                  <td>
                    <div className="font-semibold text-stone-800">{s.cropName}</div>
                    <div className="text-xs text-stone-500">{s.quantityKg} kg verified</div>
                  </td>
                  <td className="font-extrabold text-emerald-700">₹{s.amountInr.toLocaleString()}</td>
                  <td>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-bold">
                      {s.status}
                    </span>
                  </td>
                  <td className="text-xs text-stone-500">{fmtDate(s.settledAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 6. AUDIT LOGS COMPONENT
// ==========================================

function AdminAuditLogs() {
  const [filterAction, setFilterAction] = useState('');
  const { data, loading, error, reload } = useApi('/admin/audit-logs', {
    action: filterAction || undefined
  });

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const logs = data?.logs || [];

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            className="input text-xs w-56"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
          >
            <option value="">All Administrative Actions</option>
            <option value="LOT_STATUS_UPDATED">Lot Status Updated</option>
            <option value="LOT_INSPECTED">QC Inspection Recorded</option>
            <option value="CONTAINER_ALLOCATED">Container Allocated</option>
            <option value="BUYER_ASSIGNED">Buyer Assigned</option>
            <option value="PAYMENT_SETTLED">Payment Settled</option>
            <option value="USER_STATUS_UPDATED">User Account Status</option>
            <option value="SHIPMENT_STATUS_UPDATED">Shipment Tracking</option>
          </select>
          {filterAction && (
            <button className="btn-outline text-xs px-2 py-1" onClick={() => setFilterAction('')}>Reset</button>
          )}
        </div>
        <p className="text-xs text-stone-500 font-medium">{logs.length} audit records</p>
      </div>

      {!logs.length ? (
        <Empty title="No audit logs recorded" hint="Administrative actions will appear here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="border-b bg-stone-50 text-stone-500">
              <tr>
                <th className="p-2">Action</th>
                <th>Admin Actor</th>
                <th>Target</th>
                <th>Description</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {logs.map((l) => (
                <tr key={l._id} className="hover:bg-stone-50/50">
                  <td className="p-2">
                    <span className="rounded bg-purple-100 text-purple-800 px-1.5 py-0.5 font-bold font-mono text-[10px]">
                      {l.action}
                    </span>
                  </td>
                  <td>
                    <span className="font-semibold text-stone-800">{l.actor?.name || 'Admin'}</span>
                    <span className="text-stone-400 block text-[10px]">{l.actor?.email}</span>
                  </td>
                  <td>
                    <span className="font-mono text-stone-700">{l.targetModel}: {l.targetId}</span>
                  </td>
                  <td className="text-stone-700 max-w-sm">{l.description}</td>
                  <td className="text-stone-400 whitespace-nowrap">{fmtDate(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 7. USER MANAGEMENT COMPONENT
// ==========================================

function Users() {
  const [roleFilter, setRoleFilter] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const { data, loading, error, reload } = useApi('/admin/users', {
    role: roleFilter || undefined,
    q: searchQ || undefined
  });
  const { toast } = useToast();

  const toggle = async (u) => {
    if (u.role === 'admin') {
      toast('Cannot modify admin accounts here', 'error');
      return;
    }
    try {
      await api.patch(`/admin/users/${u._id}`, { active: !u.active });
      toast(`User ${u.active ? 'disabled' : 'enabled'}`);
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const users = data.items || [];

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            placeholder="Search name, email, location..."
            className="input text-xs w-52"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
          <select
            className="input text-xs w-36"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles</option>
            <option value="farmer">Farmers</option>
            <option value="buyer">Buyers</option>
            <option value="admin">Admins</option>
          </select>
          {(roleFilter || searchQ) && (
            <button className="btn-outline text-xs px-2 py-1" onClick={() => { setRoleFilter(''); setSearchQ(''); }}>Reset</button>
          )}
        </div>
        <p className="text-xs text-stone-500 font-medium">{users.length} registered users</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[650px] text-left text-sm">
          <thead className="border-b bg-stone-50 text-stone-500">
            <tr>
              <th className="p-3">User</th>
              <th>Role</th>
              <th>Location & Farm Geotag</th>
              <th>Registered</th>
              <th>Status</th>
              <th className="text-right p-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {users.map((u) => (
              <tr key={u._id} className="hover:bg-stone-50/50">
                <td className="p-3">
                  <div className="font-bold text-stone-800">{u.name}</div>
                  <div className="text-xs text-stone-500">{u.email}</div>
                  {u.phone && <div className="text-[11px] text-stone-400 font-mono">{u.phone}</div>}
                </td>
                <td>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    u.role === 'admin' ? 'bg-purple-100 text-purple-800' : u.role === 'farmer' ? 'bg-leaf-100 text-leaf-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td>
                  <div className="text-stone-800">{u.city || u.state ? `${u.city || ''}, ${u.state || ''}` : u.country}</div>
                  {u.farmLocation?.latitude || u.farmLocation?.coordinates?.latitude ? (
                    <div className="text-[11px] text-emerald-700 font-mono">
                      🛰️ {u.farmLocation.latitude ?? u.farmLocation.coordinates.latitude}, {u.farmLocation.longitude ?? u.farmLocation.coordinates.longitude}
                    </div>
                  ) : null}
                </td>
                <td className="text-xs text-stone-500">{fmtDate(u.createdAt)}</td>
                <td>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    u.active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {u.active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="text-right p-3">
                  {u.role !== 'admin' && (
                    <button
                      className={u.active ? 'btn-danger text-xs px-2.5 py-1' : 'btn-primary text-xs px-2.5 py-1'}
                      onClick={() => toggle(u)}
                    >
                      {u.active ? 'Disable' : 'Enable'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// 8. EXISTING RESOURCE COMPONENTS
// ==========================================

function Resource({ base, listUrl, fields, columns, canVerify, evidence, extra }) {
  const { data, loading, error, reload } = useApi(listUrl);
  const { toast } = useToast();
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState({});
  const [refs, setRefs] = useState({});

  useEffect(() => {
    fields.filter((f) => f.optionsUrl).forEach((f) => {
      api.get(f.optionsUrl).then((r) => {
        setRefs((s) => ({
          ...s,
          [f.name]: r.data.items.map((i) => ({ value: i._id, label: `${i.name} (${i.country})` }))
        }));
      }).catch(() => {});
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const initial = (f, item) => {
    const v = item?.[f.name];
    if (f.type === 'list') return (v || []).join(', ');
    if (f.type === 'date') return v ? String(v).slice(0, 10) : '';
    if (f.type === 'ref') return v?._id || v || '';
    return v ?? (f.type === 'select' ? f.options[0] : '');
  };

  const open = (item) => {
    setEditId(item?._id || null);
    setForm(Object.fromEntries(fields.map((f) => [f.name, initial(f, item)])));
    setErrs({});
  };

  const save = async (e) => {
    e.preventDefault();
    const v = {};
    fields.forEach((f) => {
      if (f.required && String(form[f.name]).trim() === '') v[f.name] = 'Required';
    });
    setErrs(v);
    if (Object.keys(v).length) return;

    const body = {};
    fields.forEach((f) => {
      const val = form[f.name];
      if (val === '' && !f.required) return;
      body[f.name] = f.type === 'list'
        ? val.split(',').map((x) => x.trim()).filter(Boolean)
        : f.type === 'number'
          ? Number(val)
          : typeof val === 'string'
            ? val.trim()
            : val;
    });

    setBusy(true);
    try {
      if (editId) await api.put(`${base}/${editId}`, body);
      else await api.post(base, body);
      toast('Saved');
      setForm(null);
      reload();
    } catch (e2) {
      toast(errMsg(e2), 'error');
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn, msg) => {
    try {
      await fn();
      toast(msg);
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const verify = (it) => {
    let payload;
    if (evidence) {
      const ev = window.prompt('Verification evidence: what did you check, and where? (min 10 characters)');
      if (!ev) return;
      payload = { evidence: ev };
    }
    return act(() => api.post(`${base}/${it._id}/verify`, payload), 'Verified');
  };

  const input = (f) => {
    const id = `f-${f.name}`;
    const val = form[f.name];
    const on = (e) => setForm({ ...form, [f.name]: e.target.value });
    if (f.type === 'select') return <select id={id} className="input" value={val} onChange={on}>{f.options.map((o) => <option key={o}>{o}</option>)}</select>;
    if (f.type === 'ref') return <select id={id} className="input" value={val} onChange={on}><option value="">Choose...</option>{(refs[f.name] || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
    if (f.type === 'textarea') return <textarea id={id} rows="4" className="input" value={val} onChange={on} />;
    return <input id={id} type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} step="any" className="input" value={val} onChange={on} />;
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  return (
    <div>
      <button className="btn-primary mb-3" onClick={() => open(null)}>+ Add new</button>
      {form && (
        <form onSubmit={save} noValidate className="card mb-4 grid gap-x-3 sm:grid-cols-2">
          {fields.map((f) => <Field key={f.name} label={f.label} id={`f-${f.name}`} error={errs[f.name]}>{input(f)}</Field>)}
          <div className="flex gap-2 sm:col-span-2">
            <button className="btn-primary" disabled={busy}>Save</button>
            <button type="button" className="btn-outline" onClick={() => setForm(null)}>Cancel</button>
          </div>
          {canVerify && editId && <p className="text-xs text-amber-700 sm:col-span-2">Editing resets verification. Re-verify after checking the source.</p>}
        </form>
      )}
      {!data.items.length ? (
        <Empty title="No records" hint="Add records from official public sources." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <tbody>
              {data.items.map((it) => (
                <tr key={it._id} className="border-b">
                  <td className="p-2">{columns(it)}</td>
                  <td className="space-x-2 whitespace-nowrap text-right">
                    {canVerify && (
                      <button className={it.verificationStatus === 'verified' ? 'btn-outline' : 'btn-primary'} onClick={() => verify(it)}>
                        {it.verificationStatus === 'verified' ? 'Re-verify' : 'Verify'}
                      </button>
                    )}
                    {extra?.(it, act)}
                    <button className="btn-outline" onClick={() => open(it)}>Edit</button>
                    <button className="btn-danger" onClick={() => window.confirm('Delete this record?') && act(() => api.delete(`${base}/${it._id}`), 'Deleted')}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Duplicates() {
  const [groups, setGroups] = useState(null);
  const { toast } = useToast();
  const check = async () => {
    try { setGroups((await api.get('/companies/duplicates')).data.groups); }
    catch (e) { toast(errMsg(e), 'error'); }
  };
  return (
    <div className="mb-4">
      <button className="btn-outline" onClick={check}>Check for duplicate companies</button>
      {groups && (
        groups.length ? (
          <ul className="card mt-2 space-y-2 text-sm">
            {groups.map((g) => (
              <li key={g.key}>
                <b>{g.key.startsWith('host:') ? 'Same website' : 'Similar name'}:</b> {g.items.map((i) => `${i.name} (${i.country})`).join(' / ')}
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-stone-500">No duplicates found.</p>
      )}
    </div>
  );
}

function AdminEnquiries() {
  const { data, loading, error, reload } = useApi('/enquiries/admin/all');
  const { toast } = useToast();
  const set = async (e, status) => {
    const note = window.prompt('Note (e.g. how it was delivered)') ?? '';
    try {
      await api.patch(`/enquiries/admin/${e._id}/status`, { status, note });
      toast('Status updated');
      reload();
    } catch (er) {
      toast(errMsg(er), 'error');
    }
  };
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  return !data.items.length ? (
    <Empty title="No enquiries" />
  ) : (
    <div className="space-y-3">
      {data.items.map((e) => (
        <div key={e._id} className="card text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <p><b>{e.cropName}</b> {e.quantity} {e.unit} → {e.company?.name} ({e.company?.country})</p>
            <Badge>{e.status}</Badge>
          </div>
          <p className="text-xs text-stone-500">
            Farmer: {e.farmer?.name} · {e.farmer?.email}{e.farmer?.phone ? ` · ${e.farmer.phone}` : ''} · prefers {e.contactPreference} · {fmtDate(e.createdAt)}
          </p>
          {e.status !== 'draft' && (
            <div className="mt-2 flex flex-wrap gap-2">
              {['delivery_attempted', 'delivered', 'failed'].map((st) => (
                <button key={st} className="btn-outline text-xs" onClick={() => set(e, st)}>
                  Mark {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AllCrops() {
  const { data, loading, error, reload } = useApi('/admin/crops');
  const { toast } = useToast();
  const del = async (c) => {
    if (!window.confirm(`Delete "${c.name}"?`)) return;
    try {
      await api.delete(`/crops/${c._id}`);
      toast('Deleted');
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  return !data.items.length ? (
    <Empty title="No crops" />
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b bg-stone-50 text-stone-500">
          <tr>
            <th className="p-2">Crop</th>
            <th>Quantity</th>
            <th>Price</th>
            <th>Status</th>
            <th className="text-right p-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {data.items.map((c) => (
            <tr key={c._id}>
              <td className="p-2">{c.name} <span className="text-xs text-stone-500">by {c.farmer?.name}</span></td>
              <td>{c.quantity} {c.unit}</td>
              <td>₹{c.priceInr}</td>
              <td>{c.status}</td>
              <td className="text-right p-2">
                <button className="btn-danger text-xs px-2 py-1" onClick={() => del(c)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AllOrders() {
  const { data, loading, error, reload } = useApi('/admin/orders');
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  return !data.items.length ? (
    <Empty title="No orders" />
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="border-b bg-stone-50 text-stone-500">
          <tr>
            <th className="p-2">Order Produce</th>
            <th>Total Amount</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {data.items.map((o) => (
            <tr key={o._id}>
              <td className="p-2">{o.cropName} × {o.quantity} {o.unit}</td>
              <td>₹{o.totalInr}</td>
              <td><Badge>{o.status}</Badge></td>
              <td className="text-xs text-stone-500">{fmtDate(o.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ==========================================
// MAIN ADMIN DASHBOARD EXPORT
// ==========================================

export default function AdminDashboard() {
  const [tab, setTab] = useState('Overview');

  return (
    <div>
      <PageHeader
        title="Admin Control Center"
        subtitle="National agricultural aggregation, quality grading, container logistics, and international export command center"
      />

      <div className="mb-6 flex flex-wrap gap-1.5 border-b border-stone-200 pb-3" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === t
                ? 'bg-leaf-700 text-white shadow-sm'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <Overview />}
      {tab === 'Global Demands' && <AdminDemands />}
      {tab === 'Crop Aggregation Lots' && <AdminAggregation />}
      {tab === 'Collections & Hubs' && <AdminCollections />}
      {tab === 'Export & Shipping' && <AdminExportShipping />}
      {tab === 'Financials & Settlements' && <AdminFinancials />}
      {tab === 'Users' && <Users />}
      {tab === 'Audit Logs' && <AdminAuditLogs />}
      {tab === 'Crops' && <AllCrops />}
      {tab === 'Orders' && <AllOrders />}
      {tab === 'Companies' && (
        <>
          <Duplicates />
          <Resource
            key="co"
            base="/companies"
            listUrl="/companies"
            fields={COMPANY_FIELDS}
            canVerify
            evidence
            extra={(c, act) => c.verificationStatus !== 'rejected' && (
              <button
                className="btn-outline"
                onClick={() => {
                  const r = window.prompt('Reason for rejecting (min 5 characters)');
                  if (r) act(() => api.post(`/companies/${c._id}/reject`, { reason: r }), 'Rejected');
                }}
              >
                Reject
              </button>
            )}
            columns={(c) => (
              <div>
                <b>{c.name}</b> <Badge>{c.verificationStatus}</Badge>
                <div className="text-xs text-stone-500">
                  {c.type} · {c.buyerType} · {c.country}{c.lastVerifiedAt ? ` · verified ${fmtDate(c.lastVerifiedAt)}` : ''}
                </div>
                {c.verificationEvidence && <div className="text-xs text-stone-500">Evidence: {c.verificationEvidence}</div>}
                {c.rejectionReason && <div className="text-xs text-red-600">Rejected: {c.rejectionReason}</div>}
              </div>
            )}
          />
        </>
      )}
      {tab === 'Buying requests' && (
        <Resource
          key="br"
          base="/buying-requests"
          listUrl="/buying-requests/all"
          fields={REQUEST_FIELDS}
          canVerify
          evidence
          extra={(r, act) => r.status === 'open' && (
            <>
              {r.verificationStatus === 'verified' && (
                <button className="btn-outline" onClick={() => act(() => api.post(`/buying-requests/${r._id}/recheck`), 'Marked re-checked')}>
                  Re-checked today
                </button>
              )}
              <button className="btn-outline" onClick={() => act(() => api.post(`/buying-requests/${r._id}/close`), 'Closed')}>
                Close
              </button>
            </>
          )}
          columns={(r) => (
            <div>
              <b className="capitalize">{r.crop}</b> <Badge>{r.state}</Badge>
              <div className="text-xs text-stone-500">
                {r.company?.name} ({r.company?.country}) · requested {fmtDate(r.requestDate)}{r.expiresAt ? ` · expires ${fmtDate(r.expiresAt)}` : ''}{r.lastCheckedAt ? ` · checked ${fmtDate(r.lastCheckedAt)}` : ''}
              </div>
            </div>
          )}
        />
      )}
      {tab === 'Enquiries' && <AdminEnquiries />}
      {tab === 'Collection centers' && (
        <Resource
          key="ce"
          base="/collection-centers"
          listUrl="/collection-centers/all"
          fields={CENTER_FIELDS}
          canVerify
          columns={(c) => (
            <div>
              <b>{c.name}</b> <Badge>{c.verificationStatus}</Badge>
              <div className="text-xs text-stone-500">{c.city}, {c.state} ({c.latitude}, {c.longitude})</div>
            </div>
          )}
        />
      )}
      {tab === 'Export guides' && (
        <Resource
          key="eg"
          base="/export-guides"
          listUrl="/export-guides"
          fields={GUIDE_FIELDS}
          columns={(g) => (
            <div>
              <b>{g.title}</b>
              <div className="text-xs text-stone-500">{g.topic} · {g.sourceName}</div>
            </div>
          )}
        />
      )}
    </div>
  );
}
