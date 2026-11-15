import { useState, useEffect } from 'react';
import api, { errMsg } from '../../services/api.js';
import MapView from '../../components/MapView.jsx';

export default function FarmerProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [farmAddress, setFarmAddress] = useState('');
  const [village, setVillage] = useState('');
  const [hobli, setHobli] = useState('');
  const [taluk, setTaluk] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('Karnataka');
  const [pincode, setPincode] = useState('');
  const [coordinates, setCoordinates] = useState({ latitude: 12.5234, longitude: 76.8971 });

  // Bank fields
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [upiId, setUpiId] = useState('');

  // Live GPS loading
  const [gpsLoading, setGpsLoading] = useState(false);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get('/farmer/profile');
      const u = res.data.user || {};
      setUser(u);
      setName(u.name || '');
      setPhone(u.phone || '');

      const fl = u.farmLocation || {};
      setFarmAddress(fl.address || '');
      setVillage(fl.village || '');
      setHobli(fl.hobli || '');
      setTaluk(fl.taluk || '');
      setDistrict(fl.district || '');
      setState(fl.state || 'Karnataka');
      setPincode(fl.pincode || '');
      if (fl.latitude && fl.longitude) {
        setCoordinates({ latitude: fl.latitude, longitude: fl.longitude });
      }

      const ba = u.bankAccount || {};
      setAccountHolderName(ba.accountHolderName || u.name || '');
      setAccountNumber(ba.accountNumber || '');
      setIfscCode(ba.ifscCode || '');
      setBankName(ba.bankName || '');
      setUpiId(ba.upiId || '');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by your browser.');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setCoordinates({ latitude: lat, longitude: lon });

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
            { headers: { Accept: 'application/json' } }
          );
          if (res.ok) {
            const data = await res.json();
            const a = data.address || {};
            setVillage(a.village || a.hamlet || a.suburb || village);
            setTaluk(a.county || a.district || taluk);
            setDistrict(a.state_district || a.district || district);
            setState(a.state || 'Karnataka');
            setFarmAddress(data.display_name || farmAddress);
          }
        } catch {
          // ignore network error
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        setGpsLoading(false);
        setError(`Failed to read GPS coordinates: ${err.message}`);
      },
      { timeout: 15000, enableHighAccuracy: true }
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await api.put('/farmer/profile', {
        name,
        phone,
        farmLocation: {
          address: farmAddress || [village, hobli, taluk, district, state].filter(Boolean).join(', '),
          village,
          hobli,
          taluk,
          district,
          state,
          pincode,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude
        },
        bankAccount: {
          accountHolderName,
          accountNumber,
          ifscCode,
          bankName,
          upiId
        }
      });
      setSuccess('Farm location and bank settlement profile saved successfully!');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const mapPoints = coordinates.latitude && coordinates.longitude
    ? [{ lat: coordinates.latitude, lng: coordinates.longitude, label: `Farm: ${name}` }]
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚜</span>
          <h1 className="text-2xl font-black text-stone-900">Farm Profile & Direct Settlement Setup</h1>
        </div>
        <p className="mt-1 text-sm text-stone-600">
          Maintain your precise farm pickup coordinates for automated logistics routing, and configure direct bank/UPI payout details.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {success}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-stone-500">Loading profile data...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: Contact Details */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <span>👤</span> Farmer Contact Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-stone-600">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm font-semibold text-stone-900 focus:border-leaf-600 focus:ring-1 focus:ring-leaf-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-stone-600">Contact Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm font-semibold text-stone-900 focus:border-leaf-600 focus:ring-1 focus:ring-leaf-600"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Farm Location & GPS */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <span>📍</span> Farm Location & GPS Geocoding
              </h2>
              <button
                type="button"
                onClick={handleDetectGPS}
                disabled={gpsLoading}
                className="rounded-xl border border-leaf-300 bg-leaf-50 px-3.5 py-1.5 text-xs font-bold text-leaf-800 hover:bg-leaf-100 transition"
              >
                {gpsLoading ? 'Detecting GPS...' : '🎯 Auto-Detect GPS Location'}
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-stone-600">Full Farm Address / Survey Number</label>
              <input
                type="text"
                value={farmAddress}
                onChange={(e) => setFarmAddress(e.target.value)}
                placeholder="Survey No 142, Dudda Village, Mandya Taluk"
                className="mt-1 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-leaf-600 focus:ring-1 focus:ring-leaf-600"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-stone-600">Village</label>
                <input
                  type="text"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-stone-600">Hobli</label>
                <input
                  type="text"
                  value={hobli}
                  onChange={(e) => setHobli(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-stone-600">Taluk</label>
                <input
                  type="text"
                  value={taluk}
                  onChange={(e) => setTaluk(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-stone-600">District</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-stone-600">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-stone-600">GPS Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={coordinates.latitude}
                  onChange={(e) => setCoordinates({ ...coordinates, latitude: parseFloat(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm font-mono text-stone-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-stone-600">GPS Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={coordinates.longitude}
                  onChange={(e) => setCoordinates({ ...coordinates, longitude: parseFloat(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm font-mono text-stone-900"
                />
              </div>
            </div>

            {mapPoints.length > 0 && (
              <div className="mt-4">
                <span className="block text-xs font-bold uppercase text-stone-500 mb-2">Verified Farm Map Pin</span>
                <div className="h-48 overflow-hidden rounded-xl border border-stone-200">
                  <MapView points={mapPoints} />
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Bank Account & UPI */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <span>💳</span> Bank & UPI Direct Settlement
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-stone-600">Account Holder Name</label>
                <input
                  type="text"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-stone-600">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. State Bank of India"
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-stone-600">Account Number</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm font-mono text-stone-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-stone-600">IFSC Code</label>
                <input
                  type="text"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SBIN0001244"
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm font-mono uppercase text-stone-900"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase text-stone-600">Direct UPI ID</label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="farmer@oksbi"
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm font-mono text-stone-900"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-leaf-700 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-leaf-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : '💾 Save Profile & Location'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
