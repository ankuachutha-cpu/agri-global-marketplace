import { useState, useEffect } from 'react';
import api, { errMsg } from '../../services/api.js';

export default function ProcurementAggregation() {
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const fetchRequirements = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin-portal/procurement');
      setRequirements(res.data.requirements || []);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequirements();
  }, []);

  const handleReallocate = async (id) => {
    setError('');
    setMessage('');
    try {
      const res = await api.post(`/admin-portal/procurement/${id}/reallocate`);
      setMessage(res.data.message || 'Automated matching engine re-run successfully.');
      await fetchRequirements();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌾</span>
            <h1 className="text-2xl font-black text-stone-900">Procurement & Aggregation Management</h1>
          </div>
          <p className="mt-1 text-sm text-stone-600">
            Monitor bulk buyer purchase requirements and platform-driven automated multi-farmer allocations (strictly Ragi, Rice, Jowar).
          </p>
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          ✅ {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-stone-500">Loading procurement requirements...</div>
      ) : requirements.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">
          No procurement requirements found.
        </div>
      ) : (
        <div className="space-y-6">
          {requirements.map((r) => {
            const allocPct = r.requiredQuantityKg > 0 ? Math.min(100, Math.round((r.allocatedQuantityKg / r.requiredQuantityKg) * 100)) : 0;

            return (
              <div
                key={r._id}
                className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4"
              >
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{r.cropName === 'Ragi' ? '🌾' : r.cropName === 'Rice' ? '🍚' : '🌽'}</span>
                      <h2 className="text-lg font-bold text-stone-900">
                        {r.cropName} ({r.requiredGrade})
                      </h2>
                      <span className="rounded-md bg-stone-100 px-2.5 py-0.5 text-xs font-mono font-bold text-stone-700">
                        #{r.requirementId}
                      </span>
                      {r.aggregationLot && (
                        <span className="rounded-md bg-leaf-100 px-2.5 py-0.5 text-xs font-bold text-leaf-800">
                          Lot: {r.aggregationLot.lotId || 'Linked'}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      Buyer: <strong>{r.buyer?.companyName || r.buyerCompany || r.buyerName}</strong> ({r.buyerEmail}) | Destination: {r.deliveryDestination}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold uppercase text-stone-800">
                      {r.status?.replace(/_/g, ' ')}
                    </span>
                    <button
                      onClick={() => handleReallocate(r._id)}
                      className="rounded-xl border border-leaf-300 bg-leaf-50 px-3 py-1 text-xs font-bold text-leaf-800 hover:bg-leaf-100 transition"
                    >
                      ⚡ Re-Run Sourcing Match
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-stone-700">
                      Procurement Fulfillment: <strong className="font-mono text-stone-900">{r.allocatedQuantityKg.toLocaleString()} / {r.requiredQuantityKg.toLocaleString()} kg</strong> ({allocPct}%)
                    </span>
                    <span className="text-stone-500">
                      Target Budget: ₹{r.targetBudgetPricePerKg || 'Open'}/kg
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full bg-leaf-600 transition-all duration-300"
                      style={{ width: `${allocPct}%` }}
                    />
                  </div>
                </div>

                {/* Contributing Farmers List */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                    Automated Farmer Contributions ({r.allocations?.length || 0})
                  </h3>
                  {(!r.allocations || r.allocations.length === 0) ? (
                    <p className="text-xs text-stone-400 italic">No farmers allocated yet. Click Re-Run Sourcing Match above.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {r.allocations.map((a, idx) => (
                        <div key={idx} className="rounded-xl border border-stone-200 bg-stone-50/60 p-3 text-xs space-y-1">
                          <div className="flex justify-between font-bold text-stone-900">
                            <span>{a.farmerName}</span>
                            <span className="font-mono text-emerald-700">{a.allocatedQuantityKg.toLocaleString()} kg</span>
                          </div>
                          <div className="text-stone-500 truncate">{a.farmerVillage || a.farmerLocation || 'Karnataka'}</div>
                          <div className="flex justify-between pt-1 border-t border-stone-200/50">
                            <span className="text-stone-600">Rate: ₹{a.procurementPricePerKg}/kg</span>
                            <span className="font-semibold text-stone-700 uppercase text-[10px]">
                              {a.collectionStatus}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
