import { useState, useEffect } from 'react';
import api, { errMsg } from '../../services/api.js';

const VEHICLE_OPTIONS = [
  { type: 'Small Truck 3T', defaultCapacityKg: 3000 },
  { type: 'Medium Truck 10T', defaultCapacityKg: 10000 },
  { type: 'Heavy Truck 25T', defaultCapacityKg: 25000 },
  { type: 'Large Container 40T', defaultCapacityKg: 40000 }
];

export default function VehicleManagement() {
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState(null);

  // Assign vehicle form state
  const [vehicleType, setVehicleType] = useState('Medium Truck 10T');
  const [registrationNumber, setRegistrationNumber] = useState('KA-09-AG-7788');
  const [capacityKg, setCapacityKg] = useState('10000');
  const [driverName, setDriverName] = useState('Ramesh Kumar');
  const [driverPhone, setDriverPhone] = useState('+91 98765 43210');
  const [scheduledPickupDate, setScheduledPickupDate] = useState(new Date().toISOString().split('T')[0]);

  // Produce Collection Modal/Form state
  const [collectingContrib, setCollectingContrib] = useState(null);
  const [actualWeighedKg, setActualWeighedKg] = useState('');
  const [acceptedQuantityKg, setAcceptedQuantityKg] = useState('');
  const [rejectedQuantityKg, setRejectedQuantityKg] = useState('0');
  const [qcGrade, setQcGrade] = useState('Grade A');
  const [collectionNotes, setCollectionNotes] = useState('High quality crop inspected and weighed at farm');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRequirements = async () => {
    try {
      setLoading(true);
      const res = await api.get('/requirements');
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

  const handleVehicleTypeChange = (type) => {
    setVehicleType(type);
    const opt = VEHICLE_OPTIONS.find((v) => v.type === type);
    if (opt) setCapacityKg(String(opt.defaultCapacityKg));
  };

  // Submit vehicle assignment
  const handleAssignVehicle = async (e) => {
    e.preventDefault();
    if (!selectedReq) return;
    setError('');
    setMessage('');
    setActionLoading(true);

    try {
      const res = await api.post(`/requirements/${selectedReq._id}/assign-vehicle`, {
        vehicleType,
        registrationNumber,
        capacityKg: Number(capacityKg),
        driverName,
        driverPhone,
        scheduledPickupDate
      });
      setMessage(res.data.message);
      setSelectedReq(null);
      await fetchRequirements();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setActionLoading(false);
    }
  };

  // Workflow transition
  const handleWorkflowTransition = async (reqId, newStatus, trackingNotes) => {
    setError('');
    setMessage('');
    setActionLoading(true);

    try {
      const res = await api.patch(`/requirements/${reqId}/vehicle-status`, {
        newStatus,
        trackingNotes
      });
      setMessage(res.data.message);
      await fetchRequirements();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setActionLoading(false);
    }
  };

  // Record produce collection at farmer location
  const handleRecordCollection = async (e) => {
    e.preventDefault();
    if (!collectingContrib) return;
    setError('');
    setMessage('');
    setActionLoading(true);

    try {
      const res = await api.post(`/requirements/${collectingContrib.reqId}/collect`, {
        contributionId: collectingContrib.contributionId,
        actualWeighedKg: Number(actualWeighedKg),
        acceptedQuantityKg: Number(acceptedQuantityKg),
        rejectedQuantityKg: Number(rejectedQuantityKg),
        qcGrade,
        collectionNotes
      });
      setMessage(res.data.message);
      setCollectingContrib(null);
      await fetchRequirements();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-black text-stone-900">🚚 Vehicle Fleet & Farm Collection Operations</h1>
        <p className="mt-1 text-sm text-stone-600">
          Assign transport vehicles with automated capacity validation, execute multi-farmer pickup workflows, weigh & inspect produce, and dispatch consolidated lots to buyers.
        </p>
      </div>

      {message && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">
          ✅ {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Assign Vehicle Modal / Drawer */}
      {selectedReq && (
        <div className="rounded-2xl border border-leaf-300 bg-leaf-50/70 p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-leaf-200 pb-3">
            <div>
              <h2 className="text-lg font-black text-leaf-950">
                Assign Vehicle for Lot #{selectedReq.requirementId} ({selectedReq.cropName})
              </h2>
              <p className="text-xs text-leaf-800">
                Destination: {selectedReq.deliveryDestination} | Total Weight to Collect:{' '}
                <strong>
                  {selectedReq.contributions
                    ?.filter((c) => c.status === 'accepted')
                    .reduce((s, c) => s + c.proposedQuantityKg, 0)
                    .toLocaleString()}{' '}
                  kg
                </strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedReq(null)}
              className="text-sm font-bold text-stone-500 hover:text-stone-800"
            >
              ✕ Close
            </button>
          </div>

          <form onSubmit={handleAssignVehicle} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-stone-700">Vehicle Type *</label>
                <select
                  value={vehicleType}
                  onChange={(e) => handleVehicleTypeChange(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-white p-2.5 text-xs font-semibold"
                >
                  {VEHICLE_OPTIONS.map((v) => (
                    <option key={v.type} value={v.type}>{v.type} (up to {v.defaultCapacityKg.toLocaleString()} kg)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700">Vehicle Registration Number *</label>
                <input
                  type="text"
                  required
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  placeholder="e.g. KA-09-AG-7788"
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-white p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700">Maximum Load Capacity (kg) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={capacityKg}
                  onChange={(e) => setCapacityKg(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-white p-2.5 text-xs"
                />
                <p className="mt-1 text-[11px] text-stone-500">
                  Capacity check is enforced: total crop weight cannot exceed this limit.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700">Scheduled Pickup Date *</label>
                <input
                  type="date"
                  required
                  value={scheduledPickupDate}
                  onChange={(e) => setScheduledPickupDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-white p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700">Driver Name *</label>
                <input
                  type="text"
                  required
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Driver full name"
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-white p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700">Driver Phone Number *</label>
                <input
                  type="text"
                  required
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-white p-2.5 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setSelectedReq(null)}
                className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="rounded-xl bg-leaf-700 px-6 py-2 text-xs font-bold text-white shadow-sm hover:bg-leaf-800 disabled:opacity-50"
              >
                {actionLoading ? 'Assigning Fleet...' : 'Confirm Vehicle Assignment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Record Collection Modal */}
      {collectingContrib && (
        <div className="rounded-2xl border border-purple-300 bg-purple-50/70 p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-purple-200 pb-3">
            <div>
              <h2 className="text-lg font-black text-purple-950">
                ⚖️ Record Farm Weighing & QC Inspection
              </h2>
              <p className="text-xs text-purple-800">
                Farmer: <strong>{collectingContrib.farmerName}</strong> | Expected Weight: <strong>{collectingContrib.proposedQuantityKg} kg</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCollectingContrib(null)}
              className="text-sm font-bold text-stone-500 hover:text-stone-800"
            >
              ✕ Close
            </button>
          </div>

          <form onSubmit={handleRecordCollection} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-bold text-stone-700">Actual Weighed Weight (kg) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={actualWeighedKg}
                  onChange={(e) => {
                    setActualWeighedKg(e.target.value);
                    if (!acceptedQuantityKg) setAcceptedQuantityKg(e.target.value);
                  }}
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-white p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700">Accepted Weight (kg) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={acceptedQuantityKg}
                  onChange={(e) => setAcceptedQuantityKg(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-white p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700">Rejected Weight (kg)</label>
                <input
                  type="number"
                  min="0"
                  value={rejectedQuantityKg}
                  onChange={(e) => setRejectedQuantityKg(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-white p-2.5 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-stone-700">QC Verified Grade *</label>
                <select
                  value={qcGrade}
                  onChange={(e) => setQcGrade(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-white p-2.5 text-xs"
                >
                  <option value="Grade A">Grade A</option>
                  <option value="Grade B">Grade B</option>
                  <option value="Grade C">Grade C</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700">Inspection & Weighing Notes</label>
                <input
                  type="text"
                  value={collectionNotes}
                  onChange={(e) => setCollectionNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-white p-2.5 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setCollectingContrib(null)}
                className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="rounded-xl bg-purple-700 px-6 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-800 disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : '✅ Save Collection & Update Stock'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List of Lots / Requirements */}
      {loading ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">
          Loading collection lots...
        </div>
      ) : requirements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center text-sm text-stone-500">
          No lots available.
        </div>
      ) : (
        <div className="space-y-6">
          {requirements.map((req) => {
            const acceptedContribs = (req.contributions || []).filter((c) => c.status === 'accepted' || c.status === 'collected' || c.status === 'delivered');
            const totalAcceptedKg = (req.contributions || [])
              .filter((c) => c.status === 'accepted')
              .reduce((sum, c) => sum + c.proposedQuantityKg, 0);
            const vehicle = req.vehicle || {};
            const vStatus = vehicle.currentStatus || 'none';

            return (
              <div key={req._id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-stone-400">Lot #{req.requirementId}</span>
                    <h2 className="text-lg font-black text-stone-900">
                      {req.cropName} — {req.requiredQuantityKg.toLocaleString()} kg
                    </h2>
                    <p className="mt-0.5 text-xs text-stone-500">
                      Destination: <strong>{req.deliveryDestination}</strong> | Target: <strong>{new Date(req.requiredDeliveryDate).toLocaleDateString()}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {vStatus === 'none' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReq(req);
                          const opt = VEHICLE_OPTIONS[1];
                          setVehicleType(opt.type);
                          setCapacityKg(String(opt.defaultCapacityKg));
                        }}
                        disabled={acceptedContribs.length === 0}
                        className="rounded-xl bg-leaf-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-leaf-800 disabled:opacity-40"
                      >
                        🚚 Assign Vehicle ({totalAcceptedKg.toLocaleString()} kg ready)
                      </button>
                    ) : (
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 uppercase">
                        Vehicle: {vStatus.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Vehicle Details & Workflow progression buttons */}
                {vStatus !== 'none' && (
                  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-blue-950">
                      <div>
                        <strong>{vehicle.vehicleType}</strong> ({vehicle.registrationNumber}) | Capacity: <strong>{vehicle.capacityKg?.toLocaleString()} kg</strong>
                      </div>
                      <div>
                        Driver: <strong>{vehicle.driverName}</strong> ({vehicle.driverPhone})
                      </div>
                    </div>

                    {/* Progressive Workflow Control Buttons */}
                    <div className="mt-4 border-t border-blue-200/60 pt-3">
                      <p className="text-xs font-bold text-blue-950">Collection Status Progression:</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => handleWorkflowTransition(req._id, 'on_the_way', 'Vehicle on the way to farmers')}
                          disabled={actionLoading || vStatus !== 'vehicle_assigned'}
                          className={`rounded-lg px-3 py-1.5 font-bold transition ${
                            vStatus === 'vehicle_assigned'
                              ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                              : 'bg-stone-100 text-stone-400'
                          }`}
                        >
                          1. ➔ On the Way
                        </button>

                        <button
                          type="button"
                          onClick={() => handleWorkflowTransition(req._id, 'arrived', 'Vehicle arrived at farm cluster')}
                          disabled={actionLoading || vStatus !== 'on_the_way'}
                          className={`rounded-lg px-3 py-1.5 font-bold transition ${
                            vStatus === 'on_the_way'
                              ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                              : 'bg-stone-100 text-stone-400'
                          }`}
                        >
                          2. 📍 Arrived at Farm
                        </button>

                        <button
                          type="button"
                          onClick={() => handleWorkflowTransition(req._id, 'dispatched_to_buyer', 'All collections completed. Dispatched to buyer destination')}
                          disabled={actionLoading || !['collection_completed', 'produce_collected'].includes(vStatus)}
                          className={`rounded-lg px-3 py-1.5 font-bold transition ${
                            ['collection_completed', 'produce_collected'].includes(vStatus)
                              ? 'bg-purple-600 text-white shadow-sm hover:bg-purple-700'
                              : 'bg-stone-100 text-stone-400'
                          }`}
                        >
                          3. 🚚 Dispatch to Buyer
                        </button>

                        <button
                          type="button"
                          onClick={() => handleWorkflowTransition(req._id, 'delivered', 'Vehicle arrived at buyer destination CFS')}
                          disabled={actionLoading || vStatus !== 'dispatched_to_buyer'}
                          className={`rounded-lg px-3 py-1.5 font-bold transition ${
                            vStatus === 'dispatched_to_buyer'
                              ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                              : 'bg-stone-100 text-stone-400'
                          }`}
                        >
                          4. 🏁 Mark Arrived at Destination
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Farmer Pickups List */}
                <div className="mt-4">
                  <h3 className="text-xs font-bold uppercase text-stone-500">Farmers in this Collection Route:</h3>
                  <div className="mt-2 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
                    {acceptedContribs.map((c, i) => {
                      const isCollected = c.status === 'collected' || c.status === 'delivered';
                      const canRecordCollect = !isCollected && ['arrived', 'produce_collected', 'next_farmer', 'on_the_way'].includes(vStatus);

                      return (
                        <div key={i} className="flex flex-wrap items-center justify-between gap-3 p-3 text-xs">
                          <div>
                            <strong className="text-stone-800">{c.farmerName}</strong>
                            <span className="ml-2 text-stone-500">📍 {c.farmerVillage || c.farmerLocation}</span>
                            {c.farmerPhone && <span className="ml-2 text-stone-400">📞 {c.farmerPhone}</span>}
                            <div className="mt-0.5 text-stone-600">
                              Reserved: <strong>{c.proposedQuantityKg.toLocaleString()} kg</strong> of {c.cropName} ({c.grade})
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {isCollected ? (
                              <div className="text-right">
                                <span className="rounded-md bg-purple-100 px-2 py-0.5 font-bold text-purple-800">
                                  Weighed: {c.actualWeighedKg} kg
                                </span>
                                <div className="text-[11px] text-green-700 font-semibold">
                                  Accepted: {c.acceptedQuantityKg} kg | QC: {c.qcGrade || 'Passed'}
                                </div>
                              </div>
                            ) : (
                              canRecordCollect && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCollectingContrib({ ...c, reqId: req._id });
                                    setActualWeighedKg(String(c.proposedQuantityKg));
                                    setAcceptedQuantityKg(String(c.proposedQuantityKg));
                                    setRejectedQuantityKg('0');
                                  }}
                                  className="rounded-lg bg-leaf-700 px-3 py-1.5 font-bold text-white shadow-sm hover:bg-leaf-800"
                                >
                                  ⚖️ Record Weighing & QC
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
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
