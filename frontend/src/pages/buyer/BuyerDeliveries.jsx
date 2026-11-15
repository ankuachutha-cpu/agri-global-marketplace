import { useState, useEffect } from 'react';
import api, { errMsg } from '../../services/api.js';

export default function BuyerDeliveries() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [activeModalId, setActiveModalId] = useState(null);
  const [receivedKg, setReceivedKg] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const res = await api.get('/buyer/deliveries');
      setDeliveries(res.data.deliveries || []);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const handleConfirm = async (id) => {
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const res = await api.post(`/buyer/requirements/${id}/confirm-delivery`, {
        receivedQuantityKg: Number(receivedKg) || undefined,
        buyerInspectionNotes: notes
      });

      setSuccess(res.data.message || 'Delivery confirmed successfully!');
      setActiveModalId(null);
      setReceivedKg('');
      setNotes('');
      await fetchDeliveries();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📥</span>
          <h1 className="text-2xl font-black text-stone-900">Delivery Receipts & Consignment Confirmation</h1>
        </div>
        <p className="mt-1 text-sm text-stone-600">
          Inspect arrived shipments, log verified dock weight, record inspection feedback, and authorize settlement release.
        </p>
      </div>

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          ✅ {success}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-stone-500">Loading delivery records...</div>
      ) : deliveries.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <span className="text-4xl">🚚</span>
          <h3 className="mt-3 text-lg font-bold text-stone-900">No Dispatched Consignments Yet</h3>
          <p className="mt-1 text-sm text-stone-500">
            When collected produce is dispatched to your facility, delivery receipts will appear here for inspection.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {deliveries.map((item) => {
            const isConfirmed = item.delivery?.confirmedByBuyer || item.status === 'completed';

            return (
              <div
                key={item._id}
                className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4 transition hover:border-stone-300"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{item.cropName === 'Ragi' ? '🌾' : item.cropName === 'Rice' ? '🍚' : '🌽'}</span>
                      <h3 className="text-lg font-bold text-stone-900">
                        {item.cropName} Consignment
                      </h3>
                      <span className="rounded-md bg-stone-100 px-2.5 py-0.5 text-xs font-mono font-bold text-stone-700">
                        {item.requirementId}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      Destination: {item.deliveryDestination}
                    </p>
                  </div>
                  <div>
                    {isConfirmed ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                        ✓ Receipt Confirmed
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                        Awaiting Inspection
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-xl border border-stone-100 bg-stone-50/60 p-4 text-xs">
                  <div>
                    <span className="font-semibold text-stone-500 uppercase">Dispatched Weight</span>
                    <p className="text-sm font-mono font-bold text-stone-900">
                      {(item.delivery?.dispatchedQuantityKg || item.allocatedQuantityKg).toLocaleString()} kg
                    </p>
                  </div>
                  <div>
                    <span className="font-semibold text-stone-500 uppercase">Received Weight</span>
                    <p className="text-sm font-mono font-bold text-emerald-700">
                      {item.delivery?.receivedQuantityKg
                        ? `${item.delivery.receivedQuantityKg.toLocaleString()} kg`
                        : 'Pending Dock Verification'}
                    </p>
                  </div>
                  <div>
                    <span className="font-semibold text-stone-500 uppercase">Carrier Fleet</span>
                    <p className="font-bold text-stone-900">
                      {item.vehicle?.vehicleType || 'Standard Truck'} ({item.vehicle?.registrationNumber || 'KA-Fleet'})
                    </p>
                  </div>
                  <div>
                    <span className="font-semibold text-stone-500 uppercase">Driver Contact</span>
                    <p className="font-bold text-stone-900">{item.vehicle?.driverName || 'Designated Driver'}</p>
                    <p className="text-stone-500">{item.vehicle?.driverPhone || '-'}</p>
                  </div>
                </div>

                {isConfirmed && item.delivery?.buyerInspectionNotes && (
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-700">
                    <strong>Inspection Notes:</strong> {item.delivery.buyerInspectionNotes}
                    {item.delivery.confirmedAt && (
                      <span className="block mt-1 text-stone-500">
                        Recorded on: {new Date(item.delivery.confirmedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}

                {!isConfirmed && (
                  <div className="pt-2">
                    {activeModalId === item._id ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                        <h4 className="text-sm font-bold text-stone-900">Verify Consignment & Log Dock Receipt</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-stone-700 uppercase">Received Weight (kg) *</label>
                            <input
                              type="number"
                              value={receivedKg}
                              onChange={(e) => setReceivedKg(e.target.value)}
                              placeholder={String(item.allocatedQuantityKg)}
                              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-mono text-stone-900"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-stone-700 uppercase">Dock Inspection Notes</label>
                            <input
                              type="text"
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              placeholder="e.g. Weighbridge slip #882, seal intact, moisture 11.2%"
                              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-900"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveModalId(null)}
                            className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleConfirm(item._id)}
                            className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                          >
                            {submitting ? 'Confirming...' : 'Confirm Delivery & Release Settlement'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveModalId(item._id);
                          setReceivedKg(String(item.allocatedQuantityKg));
                        }}
                        className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 transition"
                      >
                        📦 Verify Dock Weight & Confirm Delivery
                      </button>
                    )}
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
