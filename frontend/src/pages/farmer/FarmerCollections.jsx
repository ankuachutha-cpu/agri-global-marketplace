import { useState, useEffect } from 'react';
import api, { errMsg } from '../../services/api.js';

export default function FarmerCollections() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const res = await api.get('/farmer/collections');
      setCollections(res.data.collections || []);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  const getStepProgress = (status) => {
    const steps = [
      'vehicle_assigned',
      'on_the_way',
      'arrived',
      'produce_weighed',
      'qc_completed',
      'collection_completed',
      'dispatched_to_buyer',
      'delivered'
    ];
    const idx = steps.indexOf(status);
    return idx >= 0 ? idx : 0;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚛</span>
          <h1 className="text-2xl font-black text-stone-900">Vehicle Collection Tracking</h1>
        </div>
        <p className="mt-1 text-sm text-stone-600">
          Track scheduled farm pickups, driver details, real-time vehicle dispatch, electronic weighing, and on-farm QC verification.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-stone-500">Loading collection schedules...</div>
      ) : collections.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <span className="text-4xl">🚚</span>
          <h3 className="mt-3 text-lg font-bold text-stone-900">No Scheduled Collections</h3>
          <p className="mt-1 text-sm text-stone-500">
            Once a bulk buyer requirement allocates your listed produce, vehicle pickup schedules and driver details will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {collections.map((item) => {
            const v = item.vehicle || {};
            const currentStepIdx = getStepProgress(v.currentStatus || 'vehicle_assigned');

            return (
              <div
                key={item.allocationId}
                className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
              >
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 bg-stone-50/70 p-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{item.cropName === 'Ragi' ? '🌾' : item.cropName === 'Rice' ? '🍚' : '🌽'}</span>
                      <h3 className="text-lg font-bold text-stone-900">
                        {item.cropName} ({item.grade})
                      </h3>
                      <span className="rounded-md bg-stone-200 px-2 py-0.5 text-xs font-mono font-bold text-stone-800">
                        Lot #{item.requirementId}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      Destination Facility: {item.deliveryDestination}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-stone-900">
                      Allocated: {item.allocatedQuantityKg.toLocaleString()} kg
                    </div>
                    <div className="text-xs font-semibold text-emerald-700">
                      Agreed Rate: ₹{item.procurementPricePerKg} / kg (Gross: ₹{item.farmerGrossPayable.toLocaleString()})
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Vehicle & Driver Card */}
                  <div className="grid grid-cols-1 gap-4 rounded-xl border border-stone-100 bg-stone-50/50 p-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                    <div>
                      <span className="text-xs text-stone-500 font-semibold uppercase">Vehicle Model</span>
                      <p className="font-bold text-stone-900">{v.vehicleType || 'Transport Carrier'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500 font-semibold uppercase">Registration No</span>
                      <p className="font-mono font-bold text-stone-900">{v.registrationNumber || 'Assigned soon'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500 font-semibold uppercase">Driver Contact</span>
                      <p className="font-bold text-stone-900">{v.driverName || 'Designated Driver'}</p>
                      <p className="text-xs text-stone-600">{v.driverPhone || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500 font-semibold uppercase">Scheduled Pickup</span>
                      <p className="font-bold text-stone-900">
                        {v.scheduledPickupDate ? new Date(v.scheduledPickupDate).toLocaleDateString() : 'Pending'}
                      </p>
                    </div>
                  </div>

                  {/* Progressive Status Timeline */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
                      Collection Workflow Progress
                    </h4>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8 text-center text-xs">
                      {[
                        { key: 'vehicle_assigned', label: '1. Vehicle Assigned' },
                        { key: 'on_the_way', label: '2. En Route' },
                        { key: 'arrived', label: '3. At Farm' },
                        { key: 'produce_weighed', label: '4. Weighed' },
                        { key: 'qc_completed', label: '5. QC Passed' },
                        { key: 'collection_completed', label: '6. Loaded' },
                        { key: 'dispatched_to_buyer', label: '7. Dispatched' },
                        { key: 'delivered', label: '8. Delivered' }
                      ].map((step, idx) => {
                        const isDone = idx <= currentStepIdx;
                        const isCurrent = idx === currentStepIdx;

                        return (
                          <div
                            key={step.key}
                            className={`rounded-lg border p-2.5 transition ${
                              isCurrent
                                ? 'border-leaf-600 bg-leaf-50 font-bold text-leaf-900 shadow-sm ring-1 ring-leaf-500'
                                : isDone
                                ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800'
                                : 'border-stone-200 bg-white text-stone-400'
                            }`}
                          >
                            <div>{isDone ? '✓' : '○'}</div>
                            <div className="mt-1 font-semibold leading-tight">{step.label}</div>
                          </div>
                        );
                      })}
                    </div>
                    {v.trackingNotes && (
                      <p className="mt-3 text-xs text-stone-600 bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                        <strong>Driver Note:</strong> {v.trackingNotes}
                      </p>
                    )}
                  </div>

                  {/* Weighed & QC Details if collected */}
                  {item.actualWeighedKg > 0 && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                      <h4 className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
                        <span>⚖️</span> Verified Weighbridge & Quality Control Inspection
                      </h4>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-emerald-900">
                        <div>
                          <span className="font-semibold text-emerald-800">Actual Weighed:</span>
                          <p className="text-sm font-mono font-bold">{item.actualWeighedKg.toLocaleString()} kg</p>
                        </div>
                        <div>
                          <span className="font-semibold text-emerald-800">Accepted Quantity:</span>
                          <p className="text-sm font-mono font-bold text-emerald-700">{item.acceptedQuantityKg.toLocaleString()} kg</p>
                        </div>
                        <div>
                          <span className="font-semibold text-emerald-800">Rejected Quantity:</span>
                          <p className="text-sm font-mono font-bold text-stone-600">{item.rejectedQuantityKg.toLocaleString()} kg</p>
                        </div>
                        <div>
                          <span className="font-semibold text-emerald-800">QC Verified Grade:</span>
                          <p className="text-sm font-bold">{item.qcGrade || item.grade}</p>
                        </div>
                      </div>
                      {item.collectionNotes && (
                        <p className="mt-2 text-xs text-emerald-800 italic">
                          "{item.collectionNotes}"
                        </p>
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
