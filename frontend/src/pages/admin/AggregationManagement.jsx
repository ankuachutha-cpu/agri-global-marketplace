import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../services/api.js';

export default function AggregationManagement() {
  const [requirements, setRequirements] = useState([]);
  const [selectedCrop, setSelectedCrop] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRequirements = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCrop) params.cropName = selectedCrop;
      if (selectedStatus) params.status = selectedStatus;

      const res = await api.get('/requirements', { params });
      setRequirements(res.data.requirements || []);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequirements();
  }, [selectedCrop, selectedStatus]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Completed & Delivered</span>;
      case 'delivered':
        return <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800">Delivered at Destination</span>;
      case 'in_transit':
        return <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">In Transit by Fleet</span>;
      case 'vehicle_assigned':
        return <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">Vehicle Dispatched</span>;
      case 'confirmed':
        return <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800">All Farmers Confirmed</span>;
      case 'fully_allocated':
        return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Fully Allocated (Pending Acceptance)</span>;
      default:
        return <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">{status}</span>;
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-stone-900">🌾 Aggregation & Matching Management</h1>
          <p className="mt-1 text-sm text-stone-600">
            Monitor bulk buyer lots, automated farmer matching, acceptance/rejection workflows, and re-matching status.
          </p>
        </div>
        <Link
          to="/admin/vehicles"
          className="rounded-xl bg-leaf-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-leaf-800"
        >
          🚚 Manage Vehicles & Pickups →
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm text-xs">
        <span className="font-bold text-stone-700">Filter Lots:</span>
        <select
          value={selectedCrop}
          onChange={(e) => setSelectedCrop(e.target.value)}
          className="rounded-lg border border-stone-300 p-2 font-medium"
        >
          <option value="">All Crops (Ragi, Rice, Jowar)</option>
          <option value="Ragi">Ragi</option>
          <option value="Rice">Rice</option>
          <option value="Jowar">Jowar</option>
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="rounded-lg border border-stone-300 p-2 font-medium"
        >
          <option value="">All Workflow Statuses</option>
          <option value="fully_allocated">Fully Allocated</option>
          <option value="confirmed">Confirmed by Farmers</option>
          <option value="vehicle_assigned">Vehicle Assigned</option>
          <option value="in_transit">In Transit</option>
          <option value="completed">Completed</option>
        </select>

        {(selectedCrop || selectedStatus) && (
          <button
            type="button"
            onClick={() => { setSelectedCrop(''); setSelectedStatus(''); }}
            className="text-stone-500 underline hover:text-stone-800"
          >
            Clear Filters
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">
          Loading aggregation lots...
        </div>
      ) : requirements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
          <span className="text-4xl">📦</span>
          <p className="mt-3 text-base font-bold text-stone-800">No Aggregation Lots Found</p>
          <p className="mt-1 text-sm text-stone-500">When buyers submit requirements, aggregation lots will be created here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {requirements.map((req) => {
            const reqKg = req.requiredQuantityKg || 1;
            const allocKg = req.allocatedQuantityKg || 0;
            const acceptedKg = req.acceptedQuantityKg || 0;
            const collectedKg = req.physicallyCollectedKg || 0;
            const confirmedContributions = (req.contributions || []).filter((c) => c.status === 'accepted' || c.status === 'collected' || c.status === 'delivered');
            const rejectedContributions = (req.contributions || []).filter((c) => c.status === 'rejected');

            return (
              <div key={req._id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
                  <div>
                    <span className="text-xs font-mono font-bold text-stone-400">Lot #{req.requirementId}</span>
                    <h2 className="text-xl font-black text-stone-900">
                      {req.cropName} Aggregation Lot — {req.requiredQuantityKg.toLocaleString()} kg
                    </h2>
                    <p className="mt-0.5 text-xs text-stone-500">
                      Buyer: <strong className="text-stone-800">{req.buyerName}</strong> ({req.buyerCompany}) | Destination: <strong>{req.deliveryDestination}</strong>
                    </p>
                  </div>
                  <div>{getStatusBadge(req.status)}</div>
                </div>

                {/* Aggregation Metrics Strip */}
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
                  <div className="rounded-xl bg-stone-50 p-3">
                    <span className="block text-stone-400">Target Volume</span>
                    <strong className="text-stone-900">{req.requiredQuantityKg.toLocaleString()} kg</strong>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3 text-amber-900">
                    <span className="block text-amber-700">Allocated</span>
                    <strong className="font-bold">{allocKg.toLocaleString()} kg</strong>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-3 text-blue-900">
                    <span className="block text-blue-700">Confirmed (Accepted)</span>
                    <strong className="font-bold">{acceptedKg.toLocaleString()} kg</strong>
                  </div>
                  <div className="rounded-xl bg-purple-50 p-3 text-purple-900">
                    <span className="block text-purple-700">Physically Collected</span>
                    <strong className="font-bold">{collectedKg.toLocaleString()} kg</strong>
                  </div>
                  <div className="rounded-xl bg-stone-50 p-3">
                    <span className="block text-stone-400">Remaining</span>
                    <strong className="text-stone-700">{req.remainingQuantityKg?.toLocaleString()} kg</strong>
                  </div>
                </div>

                {/* Farmer Contributions Table */}
                <div className="mt-4">
                  <h3 className="text-xs font-bold uppercase text-stone-500">Farmer Contributions & Real-time Matching Status:</h3>
                  <div className="mt-2 overflow-x-auto rounded-xl border border-stone-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-50 text-stone-600 font-semibold">
                        <tr>
                          <th className="p-3">Farmer</th>
                          <th className="p-3">Location & Coordinates</th>
                          <th className="p-3">Proposed Contribution</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Collection Stage</th>
                          <th className="p-3">Weighed (kg)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {req.contributions?.map((c, i) => (
                          <tr key={i} className={c.status === 'rejected' ? 'bg-stone-50/50 opacity-60' : ''}>
                            <td className="p-3">
                              <strong className="text-stone-800">{c.farmerName}</strong>
                              {c.farmerPhone && <div className="text-[11px] text-stone-400">📞 {c.farmerPhone}</div>}
                            </td>
                            <td className="p-3 text-stone-600">
                              <div>{c.farmerVillage || c.farmerLocation}</div>
                              {c.farmerCoordinates?.latitude && (
                                <div className="text-[10px] text-stone-400">
                                  {c.farmerCoordinates.latitude.toFixed(4)}, {c.farmerCoordinates.longitude.toFixed(4)}
                                </div>
                              )}
                            </td>
                            <td className="p-3 font-bold text-stone-900">
                              {c.proposedQuantityKg.toLocaleString()} kg
                            </td>
                            <td className="p-3">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                                  c.status === 'accepted'
                                    ? 'bg-blue-100 text-blue-800'
                                    : c.status === 'collected'
                                    ? 'bg-purple-100 text-purple-800'
                                    : c.status === 'delivered'
                                    ? 'bg-green-100 text-green-800'
                                    : c.status === 'rejected'
                                    ? 'bg-red-100 text-red-800 line-through'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {c.status === 'proposed' ? 'Pending Acceptance' : c.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="p-3 text-stone-600 capitalize">
                              {c.collectionStatus?.replace(/_/g, ' ') || 'Pending'}
                            </td>
                            <td className="p-3 font-semibold text-stone-800">
                              {c.actualWeighedKg ? `${c.actualWeighedKg} kg` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {rejectedContributions.length > 0 && (
                    <p className="mt-2 text-[11px] text-amber-700">
                      ℹ️ Note: {rejectedContributions.length} farmer(s) declined; the system automatically re-allocated the remaining volume to subsequent compatible farmers with stock.
                    </p>
                  )}
                </div>

                {/* Action button if ready for vehicle */}
                {confirmedContributions.length > 0 && (!req.vehicle || !req.vehicle.vehicleType || req.vehicle.currentStatus === 'none') && (
                  <div className="mt-4 flex justify-end border-t border-stone-100 pt-3">
                    <Link
                      to="/admin/vehicles"
                      className="rounded-xl bg-leaf-700 px-5 py-2 text-xs font-bold text-white hover:bg-leaf-800 shadow-sm"
                    >
                      Assign Collection Vehicle for this Lot →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
