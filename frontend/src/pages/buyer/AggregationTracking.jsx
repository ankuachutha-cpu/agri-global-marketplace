import { useState, useEffect } from 'react';
import api, { errMsg } from '../../services/api.js';

export default function AggregationTracking() {
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLots = async () => {
    try {
      setLoading(true);
      const res = await api.get('/buyer/aggregation');
      setLots(res.data.aggregationLots || []);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLots();
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚛</span>
          <h1 className="text-2xl font-black text-stone-900">Live Aggregation & Fleet Route Tracking</h1>
        </div>
        <p className="mt-1 text-sm text-stone-600">
          Real-time visibility into multi-farm produce consolidation, container allocation, and transit to your destination facility.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-stone-500">Loading aggregation lots...</div>
      ) : lots.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <span className="text-4xl">🚚</span>
          <h3 className="mt-3 text-lg font-bold text-stone-900">No Active Aggregation Lots</h3>
          <p className="mt-1 text-sm text-stone-500">
            Active procurement orders will appear here with live multi-farm consolidation details.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {lots.map((lot) => {
            const allocPct = lot.requiredQuantityKg > 0
              ? Math.min(100, Math.round((lot.allocatedQuantityKg / lot.requiredQuantityKg) * 100))
              : 0;

            return (
              <div
                key={lot.requirementId}
                className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 bg-stone-50/70 p-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{lot.cropName === 'Ragi' ? '🌾' : lot.cropName === 'Rice' ? '🍚' : '🌽'}</span>
                      <h2 className="text-lg font-black text-stone-900">
                        {lot.cropName} Consignment ({lot.lotId})
                      </h2>
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      Destination: <strong>{lot.deliveryDestination}</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase text-blue-900">
                      Vehicle: {lot.vehicleStatus.replace(/_/g, ' ')}
                    </span>
                    <div className="mt-1 text-xs font-mono font-bold text-stone-900">
                      {lot.allocatedQuantityKg.toLocaleString()} / {lot.requiredQuantityKg.toLocaleString()} kg ({allocPct}%)
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Vehicle Fleet Card */}
                  {lot.vehicleType && (
                    <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4 text-xs space-y-1">
                      <div className="flex justify-between font-bold text-stone-900 text-sm">
                        <span>Vehicle Fleet: {lot.vehicleType}</span>
                        <span>Driver: {lot.driverName}</span>
                      </div>
                      {lot.route && lot.route.length > 0 && (
                        <div className="pt-2">
                          <span className="font-semibold text-stone-600 uppercase text-[11px]">Consolidation Waypoints:</span>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {lot.route.map((stop, idx) => (
                              <span key={idx} className="flex items-center gap-1 rounded bg-white px-2 py-1 border border-stone-200 text-stone-800">
                                <span className="font-bold text-emerald-700">{idx + 1}.</span> {stop}
                                {idx < lot.route.length - 1 && <span className="text-stone-400 ml-1">&rarr;</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Contributing Farmers Table */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                      Contributing Farm Contributions
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-stone-200">
                      <table className="w-full text-left text-xs text-stone-700">
                        <thead className="bg-stone-50 font-bold uppercase text-stone-600 border-b border-stone-200">
                          <tr>
                            <th className="px-4 py-2.5">Farmer & Origin</th>
                            <th className="px-4 py-2.5">Allocated Weight</th>
                            <th className="px-4 py-2.5">Actual Weighed</th>
                            <th className="px-4 py-2.5">QC Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 bg-white">
                          {lot.allocations.map((a, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2.5 font-bold text-stone-900">
                                {a.farmerName}
                                <span className="block text-[11px] font-normal text-stone-500">{a.location}</span>
                              </td>
                              <td className="px-4 py-2.5 font-mono font-bold text-stone-800">
                                {a.allocatedQuantityKg.toLocaleString()} kg
                              </td>
                              <td className="px-4 py-2.5 font-mono font-bold text-emerald-700">
                                {a.actualWeighedKg ? `${a.actualWeighedKg.toLocaleString()} kg` : 'En route to scale'}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="rounded bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-800">
                                  {a.collectionStatus === 'collected' ? '✓ Accepted' : a.collectionStatus}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
