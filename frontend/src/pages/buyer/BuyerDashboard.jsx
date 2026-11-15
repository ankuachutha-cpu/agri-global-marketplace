import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../services/api.js';

export default function BuyerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/buyer/dashboard');
      setData(res.data);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const metrics = data?.metrics || {
    totalRequestedKg: 0,
    totalAllocatedKg: 0,
    totalCollectedKg: 0,
    totalDeliveredKg: 0,
    activeRequirementsCount: 0,
    completedRequirementsCount: 0,
    totalEstimatedSpendInr: 0
  };

  const recentRequirements = data?.recentRequirements || [];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Delivered & Completed</span>;
      case 'in_transit':
        return <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">In Transit to Buyer</span>;
      case 'collecting':
        return <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">Farm Collection En Route</span>;
      case 'allocated':
        return <span className="rounded-full bg-leaf-100 px-3 py-1 text-xs font-bold text-leaf-800">Fully Allocated (100%)</span>;
      default:
        return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Matching Farmers</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏢</span>
            <h1 className="text-2xl font-black text-stone-900">Buyer Procurement Control Center</h1>
          </div>
          <p className="mt-1 text-sm text-stone-600">
            Welcome, <strong>{data?.companyName || 'Bulk Buyer'}</strong>. Monitor your bulk purchase demands, multi-farm aggregation lots, and live delivery status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/buyer/create-requirement"
            className="rounded-xl bg-leaf-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-leaf-800 transition"
          >
            ➕ Post New Requirement
          </Link>
          <Link
            to="/buyer/aggregation"
            className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-bold text-stone-800 shadow-sm hover:bg-stone-50 transition"
          >
            🔍 Live Aggregation
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-stone-500">Demanded Produce</span>
          <div className="mt-2 text-2xl font-black text-stone-900 font-mono">
            {(metrics.totalRequestedKg / 1000).toFixed(1)} <span className="text-xs font-normal text-stone-500">MT</span>
          </div>
          <p className="mt-1 text-xs text-stone-500">{metrics.totalRequestedKg.toLocaleString()} kg</p>
        </div>

        <div className="rounded-2xl border border-leaf-200 bg-leaf-50/50 p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-leaf-800">Procured / Allocated</span>
          <div className="mt-2 text-2xl font-black text-leaf-950 font-mono">
            {(metrics.totalAllocatedKg / 1000).toFixed(1)} <span className="text-xs font-normal text-leaf-700">MT</span>
          </div>
          <p className="mt-1 text-xs text-leaf-700">Reserved from farms</p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-blue-800">Weighed & Collected</span>
          <div className="mt-2 text-2xl font-black text-blue-950 font-mono">
            {(metrics.totalCollectedKg / 1000).toFixed(1)} <span className="text-xs font-normal text-blue-700">MT</span>
          </div>
          <p className="mt-1 text-xs text-blue-700">Farm QC verified</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-emerald-800">Delivered Volume</span>
          <div className="mt-2 text-2xl font-black text-emerald-950 font-mono">
            {(metrics.totalDeliveredKg / 1000).toFixed(1)} <span className="text-xs font-normal text-emerald-700">MT</span>
          </div>
          <p className="mt-1 text-xs text-emerald-700">Confirmed receipts</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-stone-500">Active Demands</span>
          <div className="mt-2 text-2xl font-black text-stone-900 font-mono">
            {metrics.activeRequirementsCount}
          </div>
          <p className="mt-1 text-xs text-stone-500">{metrics.completedRequirementsCount} completed</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-stone-500">Estimated Value</span>
          <div className="mt-2 text-2xl font-black text-stone-900 font-mono">
            ₹{(metrics.totalEstimatedSpendInr / 100000).toFixed(2)}L
          </div>
          <p className="mt-1 text-xs text-stone-500">Total procurement spend</p>
        </div>
      </div>

      {/* Recent Requirements Table */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <span>📋</span> Active Bulk Procurement Requirements
          </h2>
          <Link
            to="/buyer/requirements"
            className="text-xs font-bold text-leaf-700 hover:text-leaf-800 hover:underline"
          >
            View All ({recentRequirements.length}) &rarr;
          </Link>
        </div>

        {recentRequirements.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-sm text-stone-500">
            No procurement requirements created yet. Click "Post New Requirement" above to initiate automated multi-farm sourcing.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-stone-700">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs font-bold uppercase text-stone-600">
                <tr>
                  <th className="px-4 py-3">Requirement ID</th>
                  <th className="px-4 py-3">Crop Produce</th>
                  <th className="px-4 py-3">Target Volume</th>
                  <th className="px-4 py-3">Allocation Progress</th>
                  <th className="px-4 py-3">Farmers Matched</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {recentRequirements.map((r) => {
                  const allocPct = r.requiredQuantityKg > 0 ? Math.min(100, Math.round((r.allocatedQuantityKg / r.requiredQuantityKg) * 100)) : 0;

                  return (
                    <tr key={r._id} className="hover:bg-stone-50/70 transition">
                      <td className="px-4 py-3 font-mono font-bold text-stone-900">
                        {r.requirementId}
                      </td>
                      <td className="px-4 py-3 font-bold text-stone-900">
                        {r.cropName} ({r.requiredGrade})
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-stone-900">
                        {(r.requiredQuantityKg / 1000).toFixed(1)} MT
                        <span className="block text-xs font-normal text-stone-500">{r.requiredQuantityKg.toLocaleString()} kg</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-36">
                          <div className="flex justify-between text-xs font-semibold mb-1">
                            <span>{allocPct}%</span>
                            <span className="text-stone-500">{(r.allocatedQuantityKg / 1000).toFixed(1)} MT</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                            <div
                              className="h-full bg-leaf-600 transition-all duration-300"
                              style={{ width: `${allocPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-stone-800">
                        {r.allocations?.length || 0} farmer(s)
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-600 max-w-[200px] truncate">
                        {r.deliveryDestination}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(r.status)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Direct Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Link
          to="/buyer/create-requirement"
          className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm hover:border-leaf-300 hover:shadow-md transition text-center"
        >
          <span className="text-3xl">📦</span>
          <h3 className="mt-2 font-bold text-stone-900 text-sm">Post Requirement</h3>
          <p className="mt-1 text-xs text-stone-500">Automated sourcing for Ragi, Rice, Jowar</p>
        </Link>

        <Link
          to="/buyer/requirements"
          className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm hover:border-leaf-300 hover:shadow-md transition text-center"
        >
          <span className="text-3xl">📋</span>
          <h3 className="mt-2 font-bold text-stone-900 text-sm">My Requirements</h3>
          <p className="mt-1 text-xs text-stone-500">Track allocations and target volumes</p>
        </Link>

        <Link
          to="/buyer/aggregation"
          className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm hover:border-leaf-300 hover:shadow-md transition text-center"
        >
          <span className="text-3xl">🚚</span>
          <h3 className="mt-2 font-bold text-stone-900 text-sm">Live Aggregation</h3>
          <p className="mt-1 text-xs text-stone-500">Multi-farm fleet collection route</p>
        </Link>

        <Link
          to="/buyer/deliveries"
          className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm hover:border-leaf-300 hover:shadow-md transition text-center"
        >
          <span className="text-3xl">📥</span>
          <h3 className="mt-2 font-bold text-stone-900 text-sm">Delivery History</h3>
          <p className="mt-1 text-xs text-stone-500">Inspect & confirm consignment receipts</p>
        </Link>
      </div>
    </div>
  );
}
