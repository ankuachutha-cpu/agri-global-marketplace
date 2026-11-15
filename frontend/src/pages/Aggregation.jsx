import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../services/api.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { Spinner, ErrorBox, Empty, PageHeader } from '../components/ui.jsx';

const STATUS_CONFIG = {
  forming: { label: 'Forming Lot', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  ready_for_inspection: { label: 'Ready for QC Inspection', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  inspected: { label: 'Quality Certified (Passed)', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  collected: { label: 'Collected at Hub', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  allocated_for_export: { label: 'Allocated for International Export', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  exported: { label: 'Export Dispatched', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelled & Stock Released', color: 'bg-stone-100 text-stone-600 border-stone-200' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-stone-50 text-stone-600 border-stone-200' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

export default function Aggregation() {
  const { user } = useAuth();
  const { format } = useCurrency();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('lots'); // 'lots' | 'compatible' | 'mine'
  const [filters, setFilters] = useState({ q: '', cropName: '', grade: '', state: '', status: '', exportReady: false });
  const [selectedLot, setSelectedLot] = useState(null);
  const [busy, setBusy] = useState(false);

  // Status update form inside modal
  const [nextStatus, setNextStatus] = useState('');
  const [exportCountry, setExportCountry] = useState('');
  const [exportBuyer, setExportBuyer] = useState('');
  const [inspectorNotes, setInspectorNotes] = useState('');

  // Fetch Lots, Stats, and Opportunities
  const statsQuery = useApi('/aggregation/stats');
  const params = {
    ...(filters.q && { q: filters.q }),
    ...(filters.cropName && { cropName: filters.cropName }),
    ...(filters.grade && { grade: filters.grade }),
    ...(filters.state && { state: filters.state }),
    ...(filters.status && { status: filters.status }),
    ...(filters.exportReady && { exportReady: 'true' }),
    limit: 50
  };
  const lotsQuery = useApi('/aggregation/lots', params);
  const compatibleQuery = useApi('/aggregation/compatible-crops');
  const myContribQuery = useApi(user?.role === 'farmer' ? '/aggregation/farmer/contributions' : null);

  const stats = statsQuery.data?.stats || {
    totalLots: 0,
    totalAggregatedKg: 0,
    exportReadyLots: 0,
    exportedLots: 0
  };

  const runAutoAggregation = async () => {
    if (!window.confirm('Run the crop aggregation engine to group compatible farmer produce into bulk lots?')) return;
    setBusy(true);
    try {
      const res = await api.post('/aggregation/auto-aggregate', { targetLotSize: 1000 });
      toast(res.data.message || 'Auto-aggregation complete!');
      lotsQuery.reload();
      statsQuery.reload();
      compatibleQuery.reload();
      if (myContribQuery.reload) myContribQuery.reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateStatus = async (lotId) => {
    if (!nextStatus) return;
    setBusy(true);
    try {
      const payload = {
        status: nextStatus,
        destinationCountry: exportCountry,
        buyerName: exportBuyer,
        inspection: inspectorNotes ? { passed: true, notes: inspectorNotes, inspectorName: user.name } : undefined
      };
      await api.patch(`/aggregation/lots/${lotId}/status`, payload);
      toast(`Lot status updated to ${nextStatus}`);
      setSelectedLot(null);
      setNextStatus('');
      lotsQuery.reload();
      statsQuery.reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelLot = async (lotId) => {
    if (!window.confirm('Cancel this aggregation lot? All allocated produce will be returned to the individual farmers.')) return;
    setBusy(true);
    try {
      await api.delete(`/aggregation/lots/${lotId}`);
      toast('Aggregation lot cancelled and farmer stocks released');
      setSelectedLot(null);
      lotsQuery.reload();
      statsQuery.reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black text-stone-900 sm:text-3xl">📦 AI Crop Aggregation & Export Lots</h1>
          <p className="mt-1 text-sm text-stone-600">
            Automatically group compatible smallholder harvests into container-ready bulk export volumes.
          </p>
        </div>
        {(user?.role === 'admin' || user?.role === 'farmer') && (
          <button
            onClick={runAutoAggregation}
            disabled={busy}
            className="btn-primary inline-flex items-center gap-2 shadow-sm"
          >
            <span>⚡ Run Auto-Aggregation</span>
          </button>
        )}
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card border-l-4 border-l-leaf-600 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Total Bulk Aggregated</p>
          <p className="mt-1 text-2xl font-extrabold text-leaf-800">
            {(stats.totalAggregatedKg / 1000).toFixed(1)} <span className="text-sm font-normal text-stone-500">Tonnes</span>
          </p>
          <p className="text-xs text-stone-400">{(stats.totalAggregatedKg).toLocaleString()} kg volume</p>
        </div>
        <div className="card border-l-4 border-l-blue-600 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Active Bulk Lots</p>
          <p className="mt-1 text-2xl font-extrabold text-blue-800">{stats.totalLots}</p>
          <p className="text-xs text-stone-400">Across states & grades</p>
        </div>
        <div className="card border-l-4 border-l-purple-600 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Export Ready Lots</p>
          <p className="mt-1 text-2xl font-extrabold text-purple-800">{stats.exportReadyLots}</p>
          <p className="text-xs text-stone-400">Threshold &ge; 1,000 kg reached</p>
        </div>
        <div className="card border-l-4 border-l-emerald-600 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Export Dispatched</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-800">{stats.exportedLots}</p>
          <p className="text-xs text-stone-400">Shipped internationally</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-stone-200">
        <button
          onClick={() => setActiveTab('lots')}
          className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'lots'
              ? 'border-leaf-600 text-leaf-800'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          Aggregated Export Lots ({lotsQuery.data?.total || 0})
        </button>
        <button
          onClick={() => setActiveTab('compatible')}
          className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'compatible'
              ? 'border-leaf-600 text-leaf-800'
              : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          Compatible Crop Groups ({compatibleQuery.data?.groups?.length || 0})
        </button>
        {user?.role === 'farmer' && (
          <button
            onClick={() => setActiveTab('mine')}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === 'mine'
                ? 'border-leaf-600 text-leaf-800'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            My Lot Contributions ({myContribQuery.data?.lots?.length || 0})
          </button>
        )}
      </div>

      {/* TAB 1: LOTS */}
      {activeTab === 'lots' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
            <input
              placeholder="Search lot ID or crop..."
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              className="input lg:col-span-2"
            />
            <select
              value={filters.grade}
              onChange={(e) => setFilters({ ...filters, grade: e.target.value })}
              className="input"
            >
              <option value="">All Grades</option>
              <option value="A">Grade A (Premium)</option>
              <option value="B">Grade B (Standard)</option>
              <option value="C">Grade C (Processing)</option>
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="input"
            >
              <option value="">All Statuses</option>
              {Object.keys(STATUS_CONFIG).map((s) => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
            <input
              placeholder="State (e.g. Karnataka)"
              value={filters.state}
              onChange={(e) => setFilters({ ...filters, state: e.target.value })}
              className="input"
            />
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-stone-700">
                <input
                  type="checkbox"
                  checked={filters.exportReady}
                  onChange={(e) => setFilters({ ...filters, exportReady: e.target.checked })}
                  className="rounded border-stone-300 text-leaf-600"
                />
                Export Ready
              </label>
              <button
                onClick={() => setFilters({ q: '', cropName: '', grade: '', state: '', status: '', exportReady: false })}
                className="btn-outline ml-auto text-xs py-1"
              >
                Reset
              </button>
            </div>
          </div>

          {lotsQuery.loading ? (
            <Spinner />
          ) : lotsQuery.error ? (
            <ErrorBox message={lotsQuery.error} onRetry={lotsQuery.reload} />
          ) : !lotsQuery.data?.items?.length ? (
            <Empty
              title="No aggregation lots found"
              hint="Click 'Run Auto-Aggregation' above to automatically cluster compatible farmer harvests into lots."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lotsQuery.data.items.map((lot) => {
                const percent = Math.min(100, Math.round((lot.totalQuantityKg / lot.targetQuantityKg) * 100));
                const price = format(lot.weightedAvgPricePerKg);
                return (
                  <div
                    key={lot._id}
                    className="card flex flex-col justify-between border border-stone-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-xs font-bold tracking-tight text-leaf-800 bg-leaf-50 px-2 py-0.5 rounded">
                            {lot.lotId}
                          </span>
                          <h3 className="mt-1 text-lg font-bold text-stone-900">
                            {lot.cropName} <span className="text-sm font-medium text-stone-500">(Grade {lot.grade})</span>
                          </h3>
                        </div>
                        <StatusBadge status={lot.status} />
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
                        <span>📍 {lot.state}{lot.region ? ` (${lot.region})` : ''}</span>
                        <span>👨‍🌾 {lot.participatingFarmersCount} Farmer{lot.participatingFarmersCount === 1 ? '' : 's'}</span>
                      </div>

                      {/* Progress Bar towards export container target */}
                      <div className="mt-4">
                        <div className="flex justify-between text-xs font-semibold text-stone-700">
                          <span>Aggregated: {lot.totalQuantityKg.toLocaleString()} kg</span>
                          <span>Target: {lot.targetQuantityKg.toLocaleString()} kg ({percent}%)</span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                          <div
                            className={`h-full rounded-full transition-all ${
                              percent >= 100 ? 'bg-emerald-600' : 'bg-leaf-600'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Financials & Destination */}
                      <div className="mt-4 rounded-lg bg-stone-50 p-2.5 text-xs text-stone-600 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-stone-500">Weighted Avg Price:</span>
                          <span className="font-bold text-stone-900">{price.text} / kg</span>
                        </div>
                        {lot.destinationCountry && (
                          <div className="flex justify-between text-purple-700 font-medium">
                            <span>Export Destination:</span>
                            <span>✈️ {lot.destinationCountry}</span>
                          </div>
                        )}
                        {lot.buyerName && (
                          <div className="flex justify-between text-stone-600">
                            <span>Assigned Buyer:</span>
                            <span className="truncate max-w-[160px]">{lot.buyerName}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                      <button
                        onClick={() => setSelectedLot(lot)}
                        className="btn-outline text-xs font-semibold w-full"
                      >
                        Inspect Lot & Farmers ({lot.contributions?.length || 0})
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COMPATIBLE CROPS */}
      {activeTab === 'compatible' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-leaf-200 bg-leaf-50/50 p-4 text-xs text-leaf-800">
            <strong>💡 Crop Compatibility Engine:</strong> The system automatically groups unallocated produce from multiple farmers sharing identical crop names, quality grades, and regional locations to reach export scale.
          </div>

          {compatibleQuery.loading ? (
            <Spinner />
          ) : compatibleQuery.error ? (
            <ErrorBox message={compatibleQuery.error} onRetry={compatibleQuery.reload} />
          ) : !compatibleQuery.data?.groups?.length ? (
            <Empty title="All compatible crops are currently aggregated into lots." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {compatibleQuery.data.groups.map((group) => (
                <div key={group.key} className="card p-4 shadow-sm border border-stone-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-base text-stone-900">{group.cropName}</h3>
                      <p className="text-xs text-stone-500">{group.category} · Grade {group.grade} · {group.state}</p>
                    </div>
                    <span className="rounded bg-leaf-100 px-2 py-0.5 text-xs font-bold text-leaf-800">
                      Grade {group.grade}
                    </span>
                  </div>

                  <div className="mt-3 flex justify-between text-xs font-medium">
                    <span className="text-stone-500">Available Volume:</span>
                    <span className="font-extrabold text-leaf-700">{group.totalAvailableKg.toLocaleString()} kg</span>
                  </div>
                  <div className="flex justify-between text-xs text-stone-500 mt-1">
                    <span>Contributing Farmers:</span>
                    <span>{group.farmersCount} farmer{group.farmersCount === 1 ? '' : 's'}</span>
                  </div>

                  <div className="mt-3 border-t border-stone-100 pt-2 space-y-1.5 max-h-36 overflow-y-auto">
                    {group.crops.map((c) => (
                      <div key={c._id} className="flex justify-between text-xs text-stone-600 bg-stone-50 rounded p-1.5">
                        <span className="truncate max-w-[140px] font-medium">{c.farmerName}</span>
                        <span>{c.unallocatedUnits} {c.unit} (₹{c.priceInr}/{c.unit})</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MY CONTRIBUTIONS (FARMER ONLY) */}
      {activeTab === 'mine' && (
        <div className="space-y-4">
          {myContribQuery.loading ? (
            <Spinner />
          ) : myContribQuery.error ? (
            <ErrorBox message={myContribQuery.error} onRetry={myContribQuery.reload} />
          ) : !myContribQuery.data?.lots?.length ? (
            <Empty
              title="You haven't contributed to any aggregation lots yet."
              hint="List your available crops or trigger auto-aggregation to join a bulk export lot."
            />
          ) : (
            <div className="overflow-x-auto card p-0">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b bg-stone-50 text-stone-600">
                  <tr>
                    <th className="p-3">Lot ID</th>
                    <th className="p-3">Crop & Grade</th>
                    <th className="p-3">My Contribution</th>
                    <th className="p-3">Lot Total</th>
                    <th className="p-3">Lot Status</th>
                    <th className="p-3">Export Destination</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {myContribQuery.data.lots.map((item) => (
                    <tr key={item._id} className="hover:bg-stone-50/50">
                      <td className="p-3 font-mono font-bold text-leaf-800">{item.lotId}</td>
                      <td className="p-3 font-medium text-stone-900">{item.cropName} (Grade {item.grade})</td>
                      <td className="p-3 font-bold text-leaf-700">{item.myTotalKg.toLocaleString()} kg</td>
                      <td className="p-3 text-stone-600">{item.lotTotalQuantityKg.toLocaleString()} kg</td>
                      <td className="p-3"><StatusBadge status={item.lotStatus} /></td>
                      <td className="p-3 text-purple-700 font-medium">{item.destinationCountry || 'Pending Assignment'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DETAIL & INSPECTION MODAL */}
      {selectedLot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <button
              onClick={() => setSelectedLot(null)}
              className="absolute right-4 top-4 rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              ✕
            </button>

            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-extrabold text-leaf-800 bg-leaf-100 px-3 py-1 rounded">
                {selectedLot.lotId}
              </span>
              <StatusBadge status={selectedLot.status} />
            </div>

            <h2 className="mt-2 text-2xl font-black text-stone-900">
              {selectedLot.cropName} — Bulk Export Lot
            </h2>
            <p className="text-sm text-stone-500">
              {selectedLot.category} · Quality Grade {selectedLot.grade} · {selectedLot.state}{selectedLot.region ? ` (${selectedLot.region})` : ''}
            </p>

            {/* Metrics */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl bg-stone-50 p-3 text-xs">
              <div>
                <span className="text-stone-500">Total Volume:</span>
                <p className="font-bold text-stone-900 text-sm">{selectedLot.totalQuantityKg.toLocaleString()} kg</p>
              </div>
              <div>
                <span className="text-stone-500">Target Threshold:</span>
                <p className="font-bold text-stone-900 text-sm">{selectedLot.targetQuantityKg.toLocaleString()} kg</p>
              </div>
              <div>
                <span className="text-stone-500">Weighted Avg Price:</span>
                <p className="font-bold text-leaf-700 text-sm">₹{selectedLot.weightedAvgPricePerKg} / kg</p>
              </div>
              <div>
                <span className="text-stone-500">Farmers:</span>
                <p className="font-bold text-stone-900 text-sm">{selectedLot.participatingFarmersCount} Contributing</p>
              </div>
            </div>

            {/* Quality Inspection Report Section */}
            {selectedLot.inspectionReport && selectedLot.inspectionReport.inspectedAt && (
              <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50/50 p-3 text-xs">
                <p className="font-bold text-teal-800">✅ Quality Inspection Certificate</p>
                <p className="text-stone-600 mt-1">Inspector: {selectedLot.inspectionReport.inspectorName || 'Government Quality Officer'}</p>
                {selectedLot.inspectionReport.notes && (
                  <p className="text-stone-700 italic mt-0.5">&ldquo;{selectedLot.inspectionReport.notes}&rdquo;</p>
                )}
              </div>
            )}

            {/* Contributing Farmers Table */}
            <div className="mt-5">
              <h4 className="text-sm font-bold text-stone-900 mb-2">Farmer Contributions Breakdown</h4>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-stone-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 text-stone-500 border-b">
                    <tr>
                      <th className="p-2.5">Farmer</th>
                      <th className="p-2.5">Location</th>
                      <th className="p-2.5">Quantity (kg)</th>
                      <th className="p-2.5">Price / kg</th>
                      <th className="p-2.5">Farmer Total</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {selectedLot.contributions?.map((c, i) => (
                      <tr key={i} className="hover:bg-stone-50/50">
                        <td className="p-2.5 font-medium text-stone-900">{c.farmerName}</td>
                        <td className="p-2.5 text-stone-500">{c.farmerLocation || c.farmerState}</td>
                        <td className="p-2.5 font-bold text-leaf-700">{c.quantityInKg.toLocaleString()} kg</td>
                        <td className="p-2.5 text-stone-600">₹{c.pricePerKg}</td>
                        <td className="p-2.5 font-bold text-stone-900">₹{(c.quantityInKg * c.pricePerKg).toLocaleString()}</td>
                        <td className="p-2.5">
                          <span className="rounded bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-700 capitalize">
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Admin Management / Lifecycle Transition */}
            {user?.role === 'admin' && (
              <div className="mt-6 border-t border-stone-200 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                  Admin Lifecycle Management
                </h4>
                <div className="grid gap-2 sm:grid-cols-2 text-xs">
                  <div>
                    <label className="block text-stone-600 font-medium mb-1">Set Lot Status</label>
                    <select
                      value={nextStatus}
                      onChange={(e) => setNextStatus(e.target.value)}
                      className="input text-xs"
                    >
                      <option value="">-- Choose Status --</option>
                      <option value="ready_for_inspection">Ready for QC Inspection</option>
                      <option value="inspected">Quality Certified (Inspected)</option>
                      <option value="collected">Collected at Regional Center</option>
                      <option value="allocated_for_export">Allocated for International Export</option>
                      <option value="exported">Export Dispatched (Final)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-stone-600 font-medium mb-1">Destination Country</label>
                    <input
                      placeholder="e.g. United Arab Emirates, UK, Singapore"
                      value={exportCountry}
                      onChange={(e) => setExportCountry(e.target.value)}
                      className="input text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-stone-600 font-medium mb-1">Assigned Buyer Name</label>
                    <input
                      placeholder="e.g. Al Turab Foodstuff Trading LLC"
                      value={exportBuyer}
                      onChange={(e) => setExportBuyer(e.target.value)}
                      className="input text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-stone-600 font-medium mb-1">Inspection Certificate / QC Notes</label>
                    <input
                      placeholder="e.g. Quality certified Grade A. Meets phytosanitary standards."
                      value={inspectorNotes}
                      onChange={(e) => setInspectorNotes(e.target.value)}
                      className="input text-xs"
                    />
                  </div>
                </div>

                <div className="mt-3 flex gap-2 justify-between">
                  <button
                    onClick={() => handleUpdateStatus(selectedLot._id)}
                    disabled={!nextStatus || busy}
                    className="btn-primary text-xs"
                  >
                    Update Lot Status
                  </button>
                  <button
                    onClick={() => handleCancelLot(selectedLot._id)}
                    disabled={busy}
                    className="btn-danger text-xs"
                  >
                    Cancel Lot & Release Stock
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
