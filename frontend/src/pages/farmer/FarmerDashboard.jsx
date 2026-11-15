import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../services/api.js';

export default function FarmerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/farmer/dashboard');
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
    totalUploadedKg: 0,
    availableKg: 0,
    allocatedKg: 0,
    collectedKg: 0,
    totalEarningsInr: 0,
    pendingPaymentsInr: 0,
    completedPaymentsCount: 0,
    activeCollectionsCount: 0
  };

  const cropBreakdown = data?.cropBreakdown || {
    Ragi: { totalKg: 0, availableKg: 0, allocatedKg: 0, collectedKg: 0 },
    Rice: { totalKg: 0, availableKg: 0, allocatedKg: 0, collectedKg: 0 },
    Jowar: { totalKg: 0, availableKg: 0, allocatedKg: 0, collectedKg: 0 }
  };

  const activeCollections = data?.activeCollections || [];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-leaf-200 bg-gradient-to-r from-leaf-100 via-stone-50 to-white p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌾</span>
            <h1 className="text-2xl font-black text-stone-900">Farmer Procurement Hub</h1>
          </div>
          <p className="mt-1 text-sm text-stone-600">
            Welcome back, <strong>{data?.farmerName || 'Farmer'}</strong>. Track your produce, automatic bulk buyer allocations, and vehicle collections across Karnataka.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/farmer/add-crop"
            className="rounded-xl bg-leaf-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-leaf-800 transition"
          >
            ➕ Add Available Crop
          </Link>
          <Link
            to="/farmer/inventory"
            className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-bold text-stone-800 shadow-sm hover:bg-stone-50 transition"
          >
            📦 My Produce
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-stone-500">Total Produce</span>
          <div className="mt-2 text-2xl font-black text-stone-900 font-mono">
            {metrics.totalUploadedKg.toLocaleString()} <span className="text-xs font-normal text-stone-500">kg</span>
          </div>
          <p className="mt-1 text-xs text-stone-500">{(metrics.totalUploadedKg / 100).toFixed(1)} quintals</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-emerald-800">Available Free Stock</span>
          <div className="mt-2 text-2xl font-black text-emerald-950 font-mono">
            {metrics.availableKg.toLocaleString()} <span className="text-xs font-normal text-emerald-700">kg</span>
          </div>
          <p className="mt-1 text-xs text-emerald-700">Ready for procurement</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-amber-800">Allocated to Buyers</span>
          <div className="mt-2 text-2xl font-black text-amber-950 font-mono">
            {metrics.allocatedKg.toLocaleString()} <span className="text-xs font-normal text-amber-700">kg</span>
          </div>
          <p className="mt-1 text-xs text-amber-700">Auto-reserved by platform</p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-blue-800">Collected Produce</span>
          <div className="mt-2 text-2xl font-black text-blue-950 font-mono">
            {metrics.collectedKg.toLocaleString()} <span className="text-xs font-normal text-blue-700">kg</span>
          </div>
          <p className="mt-1 text-xs text-blue-700">Weighed & verified</p>
        </div>

        <div className="rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-100 to-white p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-emerald-900">Settled Earnings</span>
          <div className="mt-2 text-2xl font-black text-emerald-950 font-mono">
            ₹{metrics.totalEarningsInr.toLocaleString()}
          </div>
          <p className="mt-1 text-xs text-emerald-800">{metrics.completedPaymentsCount} payout(s) settled</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-stone-500">Pending Payouts</span>
          <div className="mt-2 text-2xl font-black text-stone-900 font-mono">
            ₹{metrics.pendingPaymentsInr.toLocaleString()}
          </div>
          <p className="mt-1 text-xs text-stone-500">In collection / delivery</p>
        </div>
      </div>

      {/* Crop-wise Real-Time Breakdown: Ragi, Rice, Jowar */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
          <span>📊</span> Crop Produce Breakdown (Ragi, Rice, Jowar)
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { name: 'Ragi', emoji: '🌾', data: cropBreakdown.Ragi },
            { name: 'Rice', emoji: '🍚', data: cropBreakdown.Rice },
            { name: 'Jowar', emoji: '🌽', data: cropBreakdown.Jowar }
          ].map((crop) => (
            <div
              key={crop.name}
              className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 transition hover:bg-stone-50"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-base font-bold text-stone-900">
                  <span>{crop.emoji}</span> {crop.name}
                </span>
                <span className="text-xs font-mono font-bold text-stone-600">
                  Total: {crop.data.totalKg.toLocaleString()} kg
                </span>
              </div>
              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-500">Available Free Stock:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {crop.data.availableKg.toLocaleString()} kg
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Allocated to Buyers:</span>
                  <span className="font-mono font-bold text-amber-700">
                    {crop.data.allocatedKg.toLocaleString()} kg
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Collected & QC Passed:</span>
                  <span className="font-mono font-bold text-blue-700">
                    {crop.data.collectedKg.toLocaleString()} kg
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Vehicle Collection Tracking */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <span>🚛</span> Active Collection Dispatches ({activeCollections.length})
          </h2>
          <Link
            to="/farmer/collections"
            className="text-xs font-bold text-leaf-700 hover:text-leaf-800 hover:underline"
          >
            View Full Tracking &rarr;
          </Link>
        </div>

        {activeCollections.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-stone-200 p-6 text-center text-xs text-stone-500">
            No active vehicle collections right now. Scheduled pickups will automatically appear here with driver details and real-time status.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {activeCollections.map((col) => (
              <div
                key={col.requirementId}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-stone-200 p-4 transition hover:bg-stone-50"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900 text-sm">
                      {col.cropName} ({col.allocatedQuantityKg.toLocaleString()} kg)
                    </span>
                    <span className="rounded-full bg-leaf-100 px-2.5 py-0.5 text-xs font-bold text-leaf-800">
                      Lot #{col.requirementId}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-stone-600">
                    Vehicle: <strong>{col.vehicleType}</strong> ({col.registrationNumber}) | Driver: {col.driverName} ({col.driverPhone})
                  </p>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 uppercase">
                    Status: {col.vehicleStatus?.replace(/_/g, ' ')}
                  </span>
                  <p className="mt-1 text-xs text-stone-500">
                    Pickup: {col.scheduledPickupDate ? new Date(col.scheduledPickupDate).toLocaleDateString() : 'Scheduled'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Link
          to="/farmer/add-crop"
          className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm hover:border-leaf-300 hover:shadow-md transition text-center"
        >
          <span className="text-3xl">🌾</span>
          <h3 className="mt-2 font-bold text-stone-900 text-sm">Add Crop Produce</h3>
          <p className="mt-1 text-xs text-stone-500">List Ragi, Rice, or Jowar with GPS</p>
        </Link>

        <Link
          to="/farmer/inventory"
          className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm hover:border-leaf-300 hover:shadow-md transition text-center"
        >
          <span className="text-3xl">📦</span>
          <h3 className="mt-2 font-bold text-stone-900 text-sm">My Produce</h3>
          <p className="mt-1 text-xs text-stone-500">Check total, available & allocated kg</p>
        </Link>

        <Link
          to="/farmer/collections"
          className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm hover:border-leaf-300 hover:shadow-md transition text-center"
        >
          <span className="text-3xl">🚛</span>
          <h3 className="mt-2 font-bold text-stone-900 text-sm">Collection Tracking</h3>
          <p className="mt-1 text-xs text-stone-500">Truck arrivals & QC scale results</p>
        </Link>

        <Link
          to="/farmer/payments"
          className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm hover:border-leaf-300 hover:shadow-md transition text-center"
        >
          <span className="text-3xl">💰</span>
          <h3 className="mt-2 font-bold text-stone-900 text-sm">Payment History</h3>
          <p className="mt-1 text-xs text-stone-500">Transparent UPI & NEFT payouts</p>
        </Link>
      </div>
    </div>
  );
}
