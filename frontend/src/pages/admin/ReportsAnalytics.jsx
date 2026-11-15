import { useState, useEffect } from 'react';
import api, { errMsg } from '../../services/api.js';

export default function ReportsAnalytics() {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin-portal/reports');
      setReports(res.data);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const volumeByCrop = reports?.volumeByCrop || {
    Ragi: { totalUploadedKg: 0, allocatedKg: 0, collectedKg: 0, deliveredKg: 0 },
    Rice: { totalUploadedKg: 0, allocatedKg: 0, collectedKg: 0, deliveredKg: 0 },
    Jowar: { totalUploadedKg: 0, allocatedKg: 0, collectedKg: 0, deliveredKg: 0 }
  };

  const fin = reports?.financialSummary || {
    totalGrossFarmerPayoutInr: 0,
    totalCompletedPayoutInr: 0,
    totalPendingPayoutInr: 0,
    estimatedPlatformFeeInr: 0
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📊</span>
            <h1 className="text-2xl font-black text-stone-900">Procurement & Financial Reports</h1>
          </div>
          <p className="mt-1 text-sm text-stone-600">
            High-level platform throughput analytics for Ragi, Rice, and Jowar aggregation across Karnataka.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-stone-500">Generating analytics reports...</div>
      ) : (
        <>
          {/* Financial KPI Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <span className="text-xs font-bold uppercase text-stone-500">Gross Farmer Value</span>
              <div className="mt-2 text-2xl font-black text-stone-900 font-mono">
                ₹{fin.totalGrossFarmerPayoutInr.toLocaleString()}
              </div>
              <p className="mt-1 text-xs text-stone-500">Total produce procured</p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
              <span className="text-xs font-bold uppercase text-emerald-800">Settled Payouts</span>
              <div className="mt-2 text-2xl font-black text-emerald-950 font-mono">
                ₹{fin.totalCompletedPayoutInr.toLocaleString()}
              </div>
              <p className="mt-1 text-xs text-emerald-700">Directly disbursed</p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
              <span className="text-xs font-bold uppercase text-amber-800">Pending Settlements</span>
              <div className="mt-2 text-2xl font-black text-amber-950 font-mono">
                ₹{fin.totalPendingPayoutInr.toLocaleString()}
              </div>
              <p className="mt-1 text-xs text-amber-700">Awaiting confirmation</p>
            </div>

            <div className="rounded-2xl border border-leaf-200 bg-leaf-50/60 p-5 shadow-sm">
              <span className="text-xs font-bold uppercase text-leaf-800">Platform Commission (5%)</span>
              <div className="mt-2 text-2xl font-black text-leaf-950 font-mono">
                ₹{fin.estimatedPlatformFeeInr.toLocaleString()}
              </div>
              <p className="mt-1 text-xs text-leaf-700">Platform operational revenue</p>
            </div>
          </div>

          {/* Crop-wise Volume Throughput Cards */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <span>🌾</span> Throughput Volume by Crop Produce (MT)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { name: 'Ragi', emoji: '🌾', data: volumeByCrop.Ragi },
                { name: 'Rice', emoji: '🍚', data: volumeByCrop.Rice },
                { name: 'Jowar', emoji: '🌽', data: volumeByCrop.Jowar }
              ].map((c) => {
                const totalUploadedMT = (c.data.totalUploadedKg / 1000).toFixed(1);
                const allocatedMT = (c.data.allocatedKg / 1000).toFixed(1);
                const collectedMT = (c.data.collectedKg / 1000).toFixed(1);
                const deliveredMT = (c.data.deliveredKg / 1000).toFixed(1);

                return (
                  <div key={c.name} className="rounded-xl border border-stone-200 bg-stone-50/70 p-5 space-y-3">
                    <div className="flex items-center justify-between font-bold text-stone-900 text-base">
                      <span className="flex items-center gap-2">
                        <span>{c.emoji}</span> {c.name}
                      </span>
                      <span className="font-mono text-sm">{totalUploadedMT} MT Listed</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between font-semibold text-stone-600 mb-1">
                          <span>Allocated to Buyers:</span>
                          <span className="font-mono text-stone-900">{allocatedMT} MT</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-stone-200 overflow-hidden">
                          <div
                            className="h-full bg-amber-500"
                            style={{ width: `${Math.min(100, (c.data.allocatedKg / (c.data.totalUploadedKg || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between font-semibold text-stone-600 mb-1">
                          <span>Collected from Farms:</span>
                          <span className="font-mono text-stone-900">{collectedMT} MT</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-stone-200 overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${Math.min(100, (c.data.collectedKg / (c.data.totalUploadedKg || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between font-semibold text-stone-600 mb-1">
                          <span>Delivered to Buyers:</span>
                          <span className="font-mono text-emerald-700">{deliveredMT} MT</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-stone-200 overflow-hidden">
                          <div
                            className="h-full bg-emerald-600"
                            style={{ width: `${Math.min(100, (c.data.deliveredKg / (c.data.totalUploadedKg || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
