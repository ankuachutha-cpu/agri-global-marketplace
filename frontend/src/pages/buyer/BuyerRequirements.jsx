import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../services/api.js';

export default function BuyerRequirements() {
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);
  const [receivedKg, setReceivedKg] = useState('');
  const [buyerInspectionNotes, setBuyerInspectionNotes] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedReq, setSelectedReq] = useState(null);

  const fetchRequirements = async () => {
    try {
      setLoading(true);
      const res = await api.get('/buyer/requirements');
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

  const handleConfirmDelivery = async (reqId) => {
    setError('');
    setMessage('');
    try {
      const res = await api.post(`/buyer/requirements/${reqId}/confirm-delivery`, {
        receivedQuantityKg: Number(receivedKg) || undefined,
        buyerInspectionNotes
      });
      setMessage(res.data.message);
      setConfirmingId(null);
      setReceivedKg('');
      setBuyerInspectionNotes('');
      await fetchRequirements();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Delivered & Completed</span>;
      case 'delivered':
        return <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800">Arrived at Destination</span>;
      case 'in_transit':
        return <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">Vehicle in Transit</span>;
      case 'collecting':
        return <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">Collection in Progress</span>;
      case 'allocated':
        return <span className="rounded-full bg-leaf-100 px-3 py-1 text-xs font-bold text-leaf-800">Fully Allocated (100%)</span>;
      case 'partially_allocated':
        return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Partially Allocated</span>;
      default:
        return <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">Open for Matching</span>;
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📦</span>
            <h1 className="text-2xl font-black text-stone-900">My Procurement Requirements</h1>
          </div>
          <p className="mt-1 text-sm text-stone-600">
            Track automated multi-farm allocations, consolidation progress, vehicle dispatch, and delivery receipt confirmations.
          </p>
        </div>
        <Link
          to="/buyer/create-requirement"
          className="rounded-xl bg-leaf-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-leaf-800 transition"
        >
          ➕ Post New Requirement
        </Link>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          ✅ {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">
          Loading your procurement requirements...
        </div>
      ) : requirements.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <span className="text-4xl">🌾</span>
          <h3 className="mt-3 text-lg font-bold text-stone-900">No Requirements Found</h3>
          <p className="mt-1 text-sm text-stone-500">
            Post your first bulk requirement for Ragi, Rice, or Jowar. The platform will automatically reserve matching farmer inventory.
          </p>
          <Link
            to="/buyer/create-requirement"
            className="mt-4 inline-flex items-center rounded-xl bg-leaf-700 px-4 py-2 text-sm font-bold text-white hover:bg-leaf-800"
          >
            Post Bulk Requirement
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {requirements.map((r) => {
            const allocPct = r.allocationPercentage ?? (r.requiredQuantityKg > 0 ? Math.min(100, Math.round((r.allocatedQuantityKg / r.requiredQuantityKg) * 100)) : 0);
            const v = r.vehicle || {};
            const isConfirmed = r.delivery?.confirmedByBuyer || r.status === 'completed';

            return (
              <div
                key={r._id}
                className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4 transition hover:border-stone-300"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{r.cropName === 'Ragi' ? '🌾' : r.cropName === 'Rice' ? '🍚' : '🌽'}</span>
                      <h3 className="text-lg font-bold text-stone-900">
                        {r.cropName} ({r.requiredGrade})
                      </h3>
                      <span className="rounded-md bg-stone-100 px-2.5 py-0.5 text-xs font-mono font-bold text-stone-700">
                        {r.requirementId}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      Destination: <strong>{r.deliveryDestination}</strong> | Target Date: {r.requiredDeliveryDate ? new Date(r.requiredDeliveryDate).toLocaleDateString() : '-'}
                    </p>
                  </div>
                  <div>{getStatusBadge(r.status)}</div>
                </div>

                {/* Progress Bar & Allocation Metrics */}
                <div className="rounded-xl border border-stone-100 bg-stone-50/70 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between text-xs font-semibold">
                    <span className="text-stone-600">
                      Sourced: <strong className="text-stone-900 font-mono">{(r.allocatedQuantityKg / 1000).toFixed(1)} MT</strong> of {(r.requiredQuantityKg / 1000).toFixed(1)} MT ({allocPct}%)
                    </span>
                    <span className="text-stone-600">
                      Contributing Farms: <strong className="text-stone-900">{r.allocations?.length || 0}</strong>
                    </span>
                  </div>

                  <div className="h-3 w-full rounded-full bg-stone-200 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        allocPct >= 100 ? 'bg-emerald-600' : 'bg-leaf-600'
                      }`}
                      style={{ width: `${allocPct}%` }}
                    />
                  </div>

                  {/* Contributing Farmers Details */}
                  {r.allocations && r.allocations.length > 0 && (
                    <div className="mt-2 space-y-2 border-t border-stone-200/60 pt-2 text-xs">
                      <span className="font-bold uppercase tracking-wider text-stone-500">
                        Contributing Farm Sources:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {r.allocations.map((a, idx) => (
                          <div
                            key={a.allocationId || idx}
                            className="rounded-lg border border-stone-200 bg-white p-2.5"
                          >
                            <div className="flex justify-between font-bold text-stone-900">
                              <span>{a.farmerName}</span>
                              <span className="font-mono text-emerald-700">
                                {a.allocatedQuantityKg.toLocaleString()} kg
                              </span>
                            </div>
                            <div className="text-[11px] text-stone-500 truncate">
                              {a.farmerVillage || a.farmerLocation || 'Karnataka Farm'}
                            </div>
                            <div className="mt-1 flex justify-between text-[11px]">
                              <span className="text-stone-500">Rate: ₹{a.procurementPricePerKg}/kg</span>
                              <span className="font-semibold text-stone-700">
                                {a.collectionStatus === 'collected' ? '✓ Weighed' : a.collectionStatus}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Vehicle & Delivery Info */}
                {v.currentStatus && v.currentStatus !== 'none' && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-blue-900">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <strong>Assigned Fleet:</strong> {v.vehicleType} ({v.registrationNumber}) | Driver: {v.driverName} ({v.driverPhone})
                      </div>
                      <span className="rounded-full bg-blue-200 px-2.5 py-0.5 font-bold uppercase text-blue-950">
                        {v.currentStatus.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {v.trackingNotes && (
                      <p className="mt-1 text-blue-800">
                        <strong>Logistics Update:</strong> {v.trackingNotes}
                      </p>
                    )}
                  </div>
                )}

                {/* Delivery Confirmation Action */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-stone-500">
                    {isConfirmed ? (
                      <span className="font-bold text-emerald-700 flex items-center gap-1">
                        <span>✓</span> Delivery Confirmed on {new Date(r.delivery?.confirmedAt || r.updatedAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span>Awaiting consignment arrival at destination dock</span>
                    )}
                  </div>

                  {!isConfirmed && (
                    <div>
                      {confirmingId === r._id ? (
                        <div className="space-y-3 rounded-xl border border-stone-300 bg-stone-50 p-4">
                          <h4 className="text-sm font-bold text-stone-900">Confirm Consignment Receipt</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-stone-600">Actual Received Quantity (kg)</label>
                              <input
                                type="number"
                                placeholder={String(r.allocatedQuantityKg)}
                                value={receivedKg}
                                onChange={(e) => setReceivedKg(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-mono text-stone-900"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-stone-600">Buyer Inspection Notes</label>
                              <input
                                type="text"
                                placeholder="e.g. Seal verified intact, bags weighed"
                                value={buyerInspectionNotes}
                                onChange={(e) => setBuyerInspectionNotes(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-900"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmingId(null)}
                              className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-100"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmDelivery(r._id)}
                              className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
                            >
                              Confirm Receipt & Finalize
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmingId(r._id);
                            setReceivedKg(String(r.allocatedQuantityKg));
                          }}
                          className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 transition"
                        >
                          📦 Confirm Delivery Receipt
                        </button>
                      )}
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
