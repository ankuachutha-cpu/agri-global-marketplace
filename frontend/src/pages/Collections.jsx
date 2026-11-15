import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { useToast } from '../components/Toast.jsx';
import api, { errMsg } from '../services/api.js';
import { Spinner, ErrorBox, Empty, PageHeader, Field } from '../components/ui.jsx';

const STATUS_BADGES = {
  scheduled: { text: 'Scheduled', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  in_transit: { text: 'In Transit 🚚', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  inspected_at_farm: { text: 'Inspected at Farm 🔬', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
  delivered_to_hub: { text: 'Delivered to Hub 🏢', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  accepted: { text: 'Accepted & Verified ✅', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { text: 'Rejected ❌', bg: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { text: 'Cancelled', bg: 'bg-stone-100 text-stone-600 border-stone-200' }
};

const PAYMENT_BADGES = {
  pending: { text: 'Pending', bg: 'bg-stone-50 text-stone-600 border-stone-200' },
  processing: { text: 'Processing ⏳', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  paid: { text: 'Paid 💰', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed: { text: 'Failed', bg: 'bg-red-50 text-red-700 border-red-200' }
};

export default function Collections() {
  const { user, refreshUser } = useAuth();
  const { format } = useCurrency();
  const { toast } = useToast();

  const { data, loading, error, reload } = useApi('/collections/farmer');
  const myCrops = useApi('/crops/mine');

  // Modals state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedCropId, setSelectedCropId] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [gpsCoords, setGpsCoords] = useState(null);
  const [locatingGps, setLocatingGps] = useState(false);
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Inspection / Details modal
  const [activeCollection, setActiveCollection] = useState(null);

  // Status Filter
  const [statusFilter, setStatusFilter] = useState('all');

  // Farm Location Profile update state
  const [editingLocation, setEditingLocation] = useState(false);
  const [farmAddressInput, setFarmAddressInput] = useState(user?.farmLocation?.address || '');
  const [districtInput, setDistrictInput] = useState(user?.farmLocation?.district || user?.city || '');
  const [pincodeInput, setPincodeInput] = useState(user?.farmLocation?.pincode || '');
  const [farmLatitude, setFarmLatitude] = useState(user?.farmLocation?.latitude ?? user?.farmLocation?.coordinates?.latitude ?? '');
  const [farmLongitude, setFarmLongitude] = useState(user?.farmLocation?.longitude ?? user?.farmLocation?.coordinates?.longitude ?? '');
  const [savingLocation, setSavingLocation] = useState(false);

  const detectGps = (onSuccess) => {
    if (!navigator.geolocation) {
      toast('Geolocation is not supported by your browser', 'error');
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingGps(false);
        const coords = {
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6))
        };
        onSuccess(coords);
        toast(`GPS detected: ${coords.latitude}, ${coords.longitude}`);
      },
      (err) => {
        setLocatingGps(false);
        toast(`GPS detection failed: ${err.message}`, 'error');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSaveFarmLocation = async (e) => {
    e.preventDefault();
    setSavingLocation(true);
    try {
      await api.patch('/auth/me', {
        farmAddress: farmAddressInput,
        district: districtInput,
        pincode: pincodeInput,
        latitude: farmLatitude ? Number(farmLatitude) : undefined,
        longitude: farmLongitude ? Number(farmLongitude) : undefined
      });
      toast('Farm location profile updated');
      setEditingLocation(false);
      if (refreshUser) refreshUser();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleOpenSchedule = (preselectedCropId = '') => {
    setSelectedCropId(preselectedCropId);
    setPickupDate(new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10));
    setPickupAddress(user?.farmLocation?.address || user?.city || '');
    setContactPhone(user?.phone || '');
    const userLat = user?.farmLocation?.latitude ?? user?.farmLocation?.coordinates?.latitude;
    const userLng = user?.farmLocation?.longitude ?? user?.farmLocation?.coordinates?.longitude;
    if (userLat && userLng) {
      setGpsCoords({ latitude: userLat, longitude: userLng });
    } else {
      setGpsCoords(null);
    }
    setScheduleNotes('');
    setShowScheduleModal(true);
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCropId) {
      toast('Please select a crop listing', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/collections/schedule', {
        cropId: selectedCropId,
        scheduledDate: pickupDate ? new Date(pickupDate).toISOString() : undefined,
        pickupAddress,
        coordinates: gpsCoords,
        pickupContactPhone: contactPhone,
        notes: scheduleNotes
      });
      toast('Collection pickup scheduled successfully!');
      setShowScheduleModal(false);
      reload();
      if (myCrops.reload) myCrops.reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Demo status advancement simulation
  const advanceStatus = async (col, nextStatus, payload = {}) => {
    try {
      await api.patch(`/collections/${col.collectionId || col._id}/status`, {
        status: nextStatus,
        ...payload
      });
      toast(`Status updated to ${nextStatus}`);
      reload();
      if (activeCollection) {
        const updated = await api.get(`/collections/${col.collectionId || col._id}`);
        setActiveCollection(updated.data);
      }
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const collections = data?.collections || [];
  const filtered = statusFilter === 'all'
    ? collections
    : statusFilter === 'active'
      ? collections.filter((c) => ['scheduled', 'in_transit', 'inspected_at_farm', 'delivered_to_hub'].includes(c.status))
      : statusFilter === 'completed'
        ? collections.filter((c) => c.status === 'accepted')
        : collections.filter((c) => c.status === statusFilter);

  // Available crops not yet scheduled
  const activeCropIds = new Set(
    collections
      .filter((c) => ['scheduled', 'in_transit', 'inspected_at_farm', 'delivered_to_hub'].includes(c.status))
      .map((c) => String(c.crop?._id || c.crop))
  );

  const availableCrops = (myCrops.data?.items || []).filter(
    (c) => c.quantity > 0 && !activeCropIds.has(String(c._id))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Crop Collection & Logistics Tracker"
          subtitle="Real-time pickup scheduling, quality grading, aggregation verification, and direct farmer payouts"
        />
        <button
          className="btn-primary"
          onClick={() => handleOpenSchedule()}
        >
          📅 Schedule New Pickup
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card border-l-4 border-l-leaf-600">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Total Pickups</p>
          <p className="mt-1 text-2xl font-extrabold text-stone-800">{data.totalCollectionsCount || 0}</p>
          <p className="text-xs text-stone-500">Scheduled: {data.totalScheduledKg || 0} kg produce</p>
        </div>
        <div className="card border-l-4 border-l-emerald-600">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Accepted & Verified</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-700">{data.totalAcceptedKg || 0} kg</p>
          <p className="text-xs text-stone-500">Merged into export-ready lots</p>
        </div>
        <div className="card border-l-4 border-l-blue-600">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Pending Payouts</p>
          <p className="mt-1 text-2xl font-extrabold text-blue-700">₹{data.pendingPayoutInr?.toLocaleString() || 0}</p>
          <p className="text-xs text-stone-500">Under QC or hub processing</p>
        </div>
        <div className="card border-l-4 border-l-amber-500">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Earnings Received</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-700">₹{data.receivedEarningsInr?.toLocaleString() || 0}</p>
          <p className="text-xs text-stone-500">Directly settled to bank / UPI</p>
        </div>
      </div>

      {/* Farm Location & GPS Card */}
      <div className="card bg-stone-50/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-stone-800 flex items-center gap-2">
              📍 Registered Farm Location & GPS Coordinates
            </h3>
            <p className="text-xs text-stone-500">
              Logistics drivers navigate directly to your farm gate using verified GPS coordinates.
            </p>
          </div>
          <button
            className="btn-outline text-xs"
            onClick={() => setEditingLocation(!editingLocation)}
          >
            {editingLocation ? 'Close' : '✏️ Edit Farm Location'}
          </button>
        </div>

        {!editingLocation ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <span className="text-xs text-stone-500 block">Farm Address</span>
              <span className="font-medium text-stone-800">{user?.farmLocation?.address || user?.city || 'Not specified'}</span>
            </div>
            <div>
              <span className="text-xs text-stone-500 block">District & Pincode</span>
              <span className="font-medium text-stone-800">
                {user?.farmLocation?.district || user?.district || user?.city || 'Kolar'}, {user?.farmLocation?.pincode || '563101'}
              </span>
            </div>
            <div>
              <span className="text-xs text-stone-500 block">GPS Coordinates</span>
              {user?.farmLocation?.latitude || user?.farmLocation?.coordinates?.latitude ? (
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  🛰️ {user.farmLocation.latitude ?? user.farmLocation.coordinates.latitude}, {user.farmLocation.longitude ?? user.farmLocation.coordinates.longitude}
                </span>
              ) : (
                <span className="text-amber-700 font-medium">⚠️ GPS not captured yet</span>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveFarmLocation} className="mt-4 pt-4 border-t border-stone-200 grid gap-3 sm:grid-cols-3">
            <Field label="Farm Address / Plot / Survey No." id="farmAddress">
              <input
                id="farmAddress"
                className="input"
                placeholder="e.g. Survey 42, Kolar Farm Road"
                value={farmAddressInput}
                onChange={(e) => setFarmAddressInput(e.target.value)}
              />
            </Field>
            <Field label="District" id="district">
              <input
                id="district"
                className="input"
                placeholder="e.g. Kolar"
                value={districtInput}
                onChange={(e) => setDistrictInput(e.target.value)}
              />
            </Field>
            <Field label="Pincode" id="pincode">
              <input
                id="pincode"
                className="input"
                placeholder="e.g. 563101"
                value={pincodeInput}
                onChange={(e) => setPincodeInput(e.target.value)}
              />
            </Field>
            <div className="sm:col-span-2 grid grid-cols-2 gap-2">
              <Field label="Latitude" id="lat">
                <input
                  id="lat"
                  type="number"
                  step="any"
                  className="input"
                  placeholder="13.1378"
                  value={farmLatitude}
                  onChange={(e) => setFarmLatitude(e.target.value)}
                />
              </Field>
              <Field label="Longitude" id="lng">
                <input
                  id="lng"
                  type="number"
                  step="any"
                  className="input"
                  placeholder="78.1291"
                  value={farmLongitude}
                  onChange={(e) => setFarmLongitude(e.target.value)}
                />
              </Field>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                className="btn-outline"
                disabled={locatingGps}
                onClick={() => detectGps((c) => { setFarmLatitude(c.latitude); setFarmLongitude(c.longitude); })}
              >
                {locatingGps ? 'Locating...' : '🛰️ Use Current GPS'}
              </button>
              <button type="submit" className="btn-primary" disabled={savingLocation}>
                {savingLocation ? 'Saving...' : 'Save Location'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 pb-2">
        {[
          ['all', 'All Pickups'],
          ['active', 'Active In-Transit / Scheduled'],
          ['accepted', 'Accepted & QC Verified'],
          ['rejected', 'Rejected']
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === key
                ? 'bg-leaf-700 text-white shadow-sm'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Collections List */}
      {!filtered.length ? (
        <Empty
          title="No collections found"
          hint="You have not scheduled any crop pickups matching this filter. Schedule a pickup to send your harvest for aggregation."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b text-stone-500 bg-stone-50">
              <tr>
                <th className="p-3">Pickup ID & Crop</th>
                <th>Scheduled Date</th>
                <th>Quantity (Est / Acc)</th>
                <th>Bulk Lot ID</th>
                <th>Status</th>
                <th>Payout</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((c) => {
                const sBadge = STATUS_BADGES[c.status] || { text: c.status, bg: 'bg-stone-100 text-stone-600' };
                const pBadge = PAYMENT_BADGES[c.paymentStatus] || { text: c.paymentStatus, bg: 'bg-stone-100 text-stone-600' };
                return (
                  <tr key={c._id} className="hover:bg-stone-50/50">
                    <td className="p-3">
                      <div className="font-bold text-stone-800">{c.collectionId}</div>
                      <div className="font-medium text-leaf-700">{c.cropName} (Grade {c.grade || 'A'})</div>
                      <div className="text-xs text-stone-500 truncate max-w-xs">{c.pickupAddress}</div>
                    </td>
                    <td>
                      <div>{new Date(c.scheduledDate).toLocaleDateString()}</div>
                      <div className="text-xs text-stone-400">
                        {new Date(c.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td>
                      <div className="font-semibold text-stone-800">
                        {c.acceptedQuantityKg !== null && c.acceptedQuantityKg !== undefined
                          ? `${c.acceptedQuantityKg} kg (accepted)`
                          : `${c.estimatedQuantityKg} kg (est)`}
                      </div>
                      {c.rejectedQuantityKg > 0 && (
                        <div className="text-xs text-red-600 font-medium">{c.rejectedQuantityKg} kg rejected</div>
                      )}
                      <div className="text-xs text-stone-500">₹{c.unitPriceInr} / kg</div>
                    </td>
                    <td>
                      {c.lotId ? (
                        <Link
                          to="/aggregation"
                          className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700 border border-purple-200 hover:bg-purple-100"
                        >
                          📦 {c.lotId}
                        </Link>
                      ) : (
                        <span className="text-xs text-stone-400">Direct pickup</span>
                      )}
                    </td>
                    <td>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${sBadge.bg}`}>
                        {sBadge.text}
                      </span>
                      {c.qualityInspection?.gradeAssigned && (
                        <div className="text-[11px] text-stone-500 mt-1">
                          QC: Grade {c.qualityInspection.gradeAssigned}
                          {c.qualityInspection.moisturePercent ? ` · ${c.qualityInspection.moisturePercent}% moist` : ''}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="font-bold text-stone-800">
                        ₹{(c.totalFinalPayoutInr ?? c.totalEstimatedPayoutInr)?.toLocaleString()}
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${pBadge.bg}`}>
                        {pBadge.text}
                      </span>
                      {c.paymentReference && (
                        <div className="text-[10px] text-stone-500 font-mono mt-0.5">{c.paymentReference}</div>
                      )}
                    </td>
                    <td className="text-right p-3 space-x-1">
                      <button
                        className="btn-outline text-xs px-2.5 py-1"
                        onClick={() => setActiveCollection(c)}
                      >
                        Inspect & Timeline
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* SCHEDULE PICKUP MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-stone-800">📅 Schedule Produce Collection Pickup</h3>
            <p className="mt-1 text-xs text-stone-500">
              Book a logistics truck to pick up produce from your farm and transport it to the nearest aggregation center.
            </p>

            <form onSubmit={handleScheduleSubmit} className="mt-4 space-y-3">
              <Field label="Select Crop Listing" id="cropSelect">
                <select
                  id="cropSelect"
                  className="input"
                  value={selectedCropId}
                  onChange={(e) => {
                    setSelectedCropId(e.target.value);
                    const found = availableCrops.find((c) => c._id === e.target.value);
                    if (found?.farmAddress) setPickupAddress(found.farmAddress);
                    if (found?.coordinates?.latitude) setGpsCoords(found.coordinates);
                  }}
                  required
                >
                  <option value="">-- Choose crop listing --</option>
                  {availableCrops.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} - {c.quantity} {c.unit} (₹{c.priceInr}/{c.unit}) [{c.location}]
                    </option>
                  ))}
                </select>
                {!availableCrops.length && (
                  <p className="text-xs text-amber-600 mt-1">
                    No unassigned crops available. Please add a crop or wait for active collections to complete.
                  </p>
                )}
              </Field>

              <Field label="Preferred Pickup Date" id="pickupDate">
                <input
                  id="pickupDate"
                  type="date"
                  className="input"
                  min={new Date().toISOString().slice(0, 10)}
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  required
                />
              </Field>

              <Field label="Farm Pickup Address" id="pickupAddress">
                <input
                  id="pickupAddress"
                  className="input"
                  placeholder="Farm gate / survey no / landmark"
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  required
                />
              </Field>

              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-700">GPS Coordinates for Driver</span>
                  <button
                    type="button"
                    className="btn-outline text-xs px-2 py-0.5"
                    disabled={locatingGps}
                    onClick={() => detectGps((coords) => setGpsCoords(coords))}
                  >
                    {locatingGps ? 'Locating...' : '🛰️ Capture Farm GPS'}
                  </button>
                </div>
                {gpsCoords ? (
                  <p className="mt-1 text-xs text-emerald-700 font-mono">
                    ✅ Lat: {gpsCoords.latitude}, Lng: {gpsCoords.longitude}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-stone-500">
                    No GPS captured. Drivers will use the text address above.
                  </p>
                )}
              </div>

              <Field label="Contact Phone at Farm" id="contactPhone">
                <input
                  id="contactPhone"
                  className="input"
                  placeholder="e.g. 9876543210"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </Field>

              <Field label="Special Notes for Vehicle (e.g. Road accessibility)" id="notes">
                <textarea
                  id="notes"
                  rows="2"
                  className="input"
                  placeholder="e.g. Truck accessible up to main gate; call 30 mins before arrival"
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                />
              </Field>

              <div className="mt-4 flex justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setShowScheduleModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting || !selectedCropId}
                >
                  {submitting ? 'Scheduling...' : 'Confirm Pickup'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECTION & TIMELINE MODAL */}
      {activeCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-stone-800">
                  Collection Details: {activeCollection.collectionId}
                </h3>
                <p className="text-xs text-stone-500">
                  {activeCollection.cropName} · Grade {activeCollection.grade || 'A'} · {activeCollection.pickupAddress}
                </p>
              </div>
              <button
                className="btn-outline text-xs px-2 py-1"
                onClick={() => setActiveCollection(null)}
              >
                ✕ Close
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-100">
                <span className="text-[10px] text-stone-500 block">Estimated Qty</span>
                <span className="font-bold text-stone-800">{activeCollection.estimatedQuantityKg} kg</span>
              </div>
              <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-100">
                <span className="text-[10px] text-stone-500 block">Accepted Qty</span>
                <span className="font-bold text-emerald-700">
                  {activeCollection.acceptedQuantityKg !== null ? `${activeCollection.acceptedQuantityKg} kg` : 'Pending QC'}
                </span>
              </div>
              <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-100">
                <span className="text-[10px] text-stone-500 block">Rate / kg</span>
                <span className="font-bold text-stone-800">₹{activeCollection.unitPriceInr}</span>
              </div>
              <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-100">
                <span className="text-[10px] text-stone-500 block">Final Payout</span>
                <span className="font-bold text-leaf-700">
                  ₹{(activeCollection.totalFinalPayoutInr ?? activeCollection.totalEstimatedPayoutInr)?.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Quality Inspection Report */}
            <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50/50 p-4">
              <h4 className="text-sm font-bold text-stone-800 mb-2 flex items-center gap-1.5">
                🔬 Quality Inspection Report
              </h4>
              {activeCollection.qualityInspection?.inspectedAt ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-stone-500 block">Inspector</span>
                    <span className="font-semibold text-stone-800">{activeCollection.qualityInspection.inspectorName || 'Hub QC Lead'}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Grade Assigned</span>
                    <span className="font-bold text-emerald-700">Grade {activeCollection.qualityInspection.gradeAssigned || activeCollection.grade}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block">Moisture Content</span>
                    <span className="font-semibold text-stone-800">
                      {activeCollection.qualityInspection.moisturePercent ? `${activeCollection.qualityInspection.moisturePercent}%` : 'Standard'}
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-3 mt-1">
                    <span className="text-stone-500 block">QC Remarks</span>
                    <span className="text-stone-700">{activeCollection.qualityInspection.notes || 'Meets export aggregation standard'}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-stone-500 italic">
                  Inspection will be conducted during farm loading or at regional collection center.
                </p>
              )}
            </div>

            {/* Audit & Logistics Timeline */}
            <div className="mt-4">
              <h4 className="text-sm font-bold text-stone-800 mb-2">📜 Logistics & Payout Timeline</h4>
              <div className="space-y-2 border-l-2 border-leaf-400 pl-3">
                {(activeCollection.timeline || []).map((t, i) => (
                  <div key={i} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-800 uppercase tracking-wide">{t.status.replace(/_/g, ' ')}</span>
                      <span className="text-stone-400">· {new Date(t.timestamp).toLocaleString()}</span>
                      <span className="rounded bg-stone-100 px-1 py-0.2 text-[10px] text-stone-600">{t.actor}</span>
                    </div>
                    {t.note && <p className="text-stone-600 mt-0.5">{t.note}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Demo Simulation Controls */}
            <div className="mt-6 rounded-xl border border-dashed border-leaf-300 bg-leaf-50/50 p-3">
              <span className="text-xs font-bold text-leaf-800 block mb-1">
                ⚙️ Quick Lifecycle Advancement (Testing & Verification)
              </span>
              <div className="flex flex-wrap gap-2 text-xs">
                {activeCollection.status === 'scheduled' && (
                  <button
                    className="btn-outline text-xs px-2 py-1"
                    onClick={() => advanceStatus(activeCollection, 'in_transit', { note: 'Truck KA-04-E-8472 dispatched' })}
                  >
                    🚚 Dispatch Vehicle (In Transit)
                  </button>
                )}
                {activeCollection.status === 'in_transit' && (
                  <button
                    className="btn-outline text-xs px-2 py-1"
                    onClick={() => advanceStatus(activeCollection, 'inspected_at_farm', {
                      note: 'Farm gate quality check verified Grade A',
                      inspection: {
                        inspectorName: 'QC Inspector Suresh',
                        gradeAssigned: activeCollection.grade || 'A',
                        moisturePercent: 12.2,
                        passed: true,
                        notes: 'High quality produce without bruises'
                      }
                    })}
                  >
                    🔬 Complete Farm QC Inspection
                  </button>
                )}
                {['in_transit', 'inspected_at_farm'].includes(activeCollection.status) && (
                  <button
                    className="btn-outline text-xs px-2 py-1"
                    onClick={() => advanceStatus(activeCollection, 'delivered_to_hub', {
                      centerName: 'Bangalore East Hub',
                      note: 'Truck arrived and unloaded at collection center'
                    })}
                  >
                    🏢 Deliver to Hub
                  </button>
                )}
                {['inspected_at_farm', 'delivered_to_hub'].includes(activeCollection.status) && (
                  <button
                    className="btn-primary text-xs px-2 py-1"
                    onClick={() => advanceStatus(activeCollection, 'accepted', {
                      acceptedQuantityKg: activeCollection.estimatedQuantityKg,
                      note: `Full batch ${activeCollection.estimatedQuantityKg} kg accepted for export lot`
                    })}
                  >
                    ✅ Accept Produce & Queue Payout
                  </button>
                )}
                {activeCollection.status === 'accepted' && activeCollection.paymentStatus !== 'paid' && (
                  <button
                    className="btn-primary text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => advanceStatus(activeCollection, 'accepted', {
                      paymentStatus: 'paid',
                      paymentReference: `UPI-AGRI-${Math.floor(100000 + Math.random() * 900000)}`,
                      note: 'Direct DBT bank transfer completed'
                    })}
                  >
                    💰 Disburse Payout (Mark Paid)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
