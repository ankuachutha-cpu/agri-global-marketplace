import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../services/api.js';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin-portal/dashboard');
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
    totalFarmers: 0,
    totalBuyers: 0,
    totalInventoryKg: 0,
    totalAvailableKg: 0,
    totalAllocatedKg: 0,
    totalCollectedKg: 0,
    activeRequirementsCount: 0,
    completedRequirementsCount: 0,
    vehiclesDeployedCount: 0,
    lotsCount: 0,
    totalPaymentVolumeInr: 0,
    pendingPaymentsInr: 0,
    completedPaymentsInr: 0
  };

  const cropBreakdown = data?.cropBreakdown || {
    Ragi: { totalKg: 0, availableKg: 0, allocatedKg: 0, collectedKg: 0 },
    Rice: { totalKg: 0, availableKg: 0, allocatedKg: 0, collectedKg: 0 },
    Jowar: { totalKg: 0, availableKg: 0, allocatedKg: 0, collectedKg: 0 }
  };

  const recentRequirements = data?.recentRequirements || [];
  const recentPayments = data?.recentPayments || [];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-800 bg-gradient-to-r from-stone-900 via-stone-800 to-leaf-950 p-6 text-white shadow-sm">
        <div>
          <span className="rounded-md bg-leaf-500/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-leaf-300">
            Platform Operations Center
          </span>
          <h1 className="mt-1 text-2xl font-black">🏛️ Admin Control Hub</h1>
          <p className="mt-1 text-sm text-stone-300">
            Automated Agricultural Procurement, Multi-Farm Aggregation & Logistics Orchestration.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/procurement"
            className="rounded-xl bg-leaf-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-leaf-500 transition"
          >
            🌾 Procurement Orders
          </Link>
          <Link
            to="/admin/vehicles"
            className="rounded-xl border border-stone-600 bg-stone-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-stone-700 transition"
          >
            🚚 Vehicle Fleet
          </Link>
          <Link
            to="/admin/payments"
            className="rounded-xl border border-stone-600 bg-stone-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-stone-700 transition"
          >
            💰 Payments
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">
          Loading live platform metrics from MongoDB...
        </div>
      ) : (
        <>
          {/* Main 6 KPI Cards Grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <span className="text-xs font-bold uppercase text-stone-500">Registered Farmers</span>
              <div className="mt-2 text-2xl font-black text-stone-900 font-mono">
                {metrics.totalFarmers}
              </div>
              <p className="mt-1 text-xs text-stone-500">Karnataka producers</p>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <span className="text-xs font-bold uppercase text-stone-500">Registered Buyers</span>
              <div className="mt-2 text-2xl font-black text-stone-900 font-mono">
                {metrics.totalBuyers}
              </div>
              <p className="mt-1 text-xs text-stone-500">Bulk & B2B enterprises</p>
            </div>

            <div className="rounded-2xl border border-leaf-200 bg-leaf-50/50 p-4 shadow-sm">
              <span className="text-xs font-bold uppercase text-leaf-800">Total Crop Stock</span>
              <div className="mt-2 text-2xl font-black text-leaf-950 font-mono">
                {(metrics.totalInventoryKg / 1000).toFixed(1)} <span className="text-xs font-normal text-leaf-700">MT</span>
              </div>
              <p className="mt-1 text-xs text-leaf-700">{(metrics.totalAvailableKg / 1000).toFixed(1)} MT free available</p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
              <span className="text-xs font-bold uppercase text-amber-800">Active Procurement</span>
              <div className="mt-2 text-2xl font-black text-amber-950 font-mono">
                {metrics.activeRequirementsCount}
              </div>
              <p className="mt-1 text-xs text-amber-700">Orders in fulfillment</p>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
              <span className="text-xs font-bold uppercase text-blue-800">Fleet Deployed</span>
              <div className="mt-2 text-2xl font-black text-blue-950 font-mono">
                {metrics.vehiclesDeployedCount}
              </div>
              <p className="mt-1 text-xs text-blue-700">Active pickup & transit</p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
              <span className="text-xs font-bold uppercase text-emerald-800">Payment Volume</span>
              <div className="mt-2 text-2xl font-black text-emerald-950 font-mono">
                ₹{(metrics.totalPaymentVolumeInr / 100000).toFixed(2)}L
              </div>
              <p className="mt-1 text-xs text-emerald-700">₹{(metrics.completedPaymentsInr / 100000).toFixed(2)}L settled</p>
            </div>
          </div>

          {/* Real-Time Stock Breakdown by Crop (Ragi, Rice, Jowar) */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <span>🌾</span> Real-Time Crop Stock Aggregation (Strictly Ragi, Rice, Jowar)
              </h2>
              <Link to="/admin/inventory" className="text-xs font-bold text-leaf-700 hover:underline">
                View Detailed Inventory &rarr;
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { name: 'Ragi', emoji: '🌾', data: cropBreakdown.Ragi },
                { name: 'Rice', emoji: '🍚', data: cropBreakdown.Rice },
                { name: 'Jowar', emoji: '🌽', data: cropBreakdown.Jowar }
              ].map((c) => (
                <div key={c.name} className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-2">
                  <div className="flex items-center justify-between font-bold text-stone-900">
                    <span className="flex items-center gap-1.5">
                      <span>{c.emoji}</span> {c.name}
                    </span>
                    <span className="font-mono text-sm">{(c.data.totalKg / 1000).toFixed(1)} MT</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Free Available:</span>
                      <span className="font-mono font-bold text-emerald-700">{c.data.availableKg.toLocaleString()} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Allocated / Reserved:</span>
                      <span className="font-mono font-bold text-amber-700">{c.data.allocatedKg.toLocaleString()} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Collected & QC Passed:</span>
                      <span className="font-mono font-bold text-blue-700">{c.data.collectedKg.toLocaleString()} kg</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Requirements and Payment Ledger */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Recent Requirements */}
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                  <span>📋</span> Live Procurement Demands
                </h3>
                <Link to="/admin/procurement" className="text-xs font-bold text-leaf-700 hover:underline">
                  All &rarr;
                </Link>
              </div>

              {recentRequirements.length === 0 ? (
                <p className="text-xs text-stone-500">No active requirements.</p>
              ) : (
                <div className="space-y-3">
                  {recentRequirements.map((r) => (
                    <div
                      key={r._id}
                      className="flex items-center justify-between rounded-xl border border-stone-200 p-3 text-xs"
                    >
                      <div>
                        <span className="font-bold text-stone-900">{r.cropName} ({r.requiredGrade})</span>
                        <span className="ml-2 font-mono text-stone-500">#{r.requirementId}</span>
                        <p className="text-stone-500 mt-0.5">Buyer: {r.buyerCompany || r.buyerName}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-stone-900">
                          {(r.allocatedQuantityKg / 1000).toFixed(1)} / {(r.requiredQuantityKg / 1000).toFixed(1)} MT
                        </span>
                        <span className="block text-[11px] font-semibold text-leaf-700 capitalize">
                          {r.status?.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Payments */}
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                  <span>💰</span> Recent Farmer Payout Records
                </h3>
                <Link to="/admin/payments" className="text-xs font-bold text-leaf-700 hover:underline">
                  All &rarr;
                </Link>
              </div>

              {recentPayments.length === 0 ? (
                <p className="text-xs text-stone-500">No payment records yet.</p>
              ) : (
                <div className="space-y-3">
                  {recentPayments.map((p) => (
                    <div
                      key={p._id}
                      className="flex items-center justify-between rounded-xl border border-stone-200 p-3 text-xs"
                    >
                      <div>
                        <span className="font-bold text-stone-900">{p.farmerName}</span>
                        <span className="ml-2 text-stone-500 font-mono">({p.cropName} - {p.collectedQuantityKg} kg)</span>
                        <p className="text-stone-400 text-[11px] font-mono mt-0.5">{p.paymentId}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-emerald-700 text-sm">
                          ₹{p.finalPayableAmountInr?.toLocaleString()}
                        </span>
                        <span className={`block text-[11px] font-bold uppercase ${
                          p.status === 'completed' ? 'text-emerald-700' : 'text-amber-700'
                        }`}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Admin Navigation Shortcuts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-center text-xs">
            {[
              { to: '/admin/farmers', label: '👨‍🌾 Farmers', sub: 'Directory' },
              { to: '/admin/buyers', label: '🏢 Buyers', sub: 'Demands' },
              { to: '/admin/inventory', label: '📦 Inventory', sub: 'All Produce' },
              { to: '/admin/procurement', label: '🌾 Sourcing', sub: 'Allocations' },
              { to: '/admin/vehicles', label: '🚚 Fleet', sub: 'Dispatches' },
              { to: '/admin/quality-control', label: '⚖️ QC Tests', sub: 'Weighing' },
              { to: '/admin/payments', label: '💳 Payouts', sub: 'Authorizations' },
              { to: '/admin/settings', label: '⚙️ Settings', sub: 'Reference Rates' }
            ].map((navItem) => (
              <Link
                key={navItem.to}
                to={navItem.to}
                className="rounded-xl border border-stone-200 bg-white p-3 shadow-xs hover:border-leaf-300 hover:shadow-sm transition"
              >
                <div className="font-bold text-stone-900">{navItem.label}</div>
                <div className="text-[11px] text-stone-500">{navItem.sub}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
