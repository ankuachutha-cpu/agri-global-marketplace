import { useState, useEffect } from 'react';
import api, { errMsg } from '../../services/api.js';

export default function BuyerProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [gstin, setGstin] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('India');
  const [email, setEmail] = useState('');

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get('/buyer/profile');
      const u = res.data.user || {};
      setCompanyName(u.companyName || u.organization || u.name || '');
      setGstin(u.gstin || '');
      setDeliveryAddress(u.deliveryAddress || u.farmLocation?.address || '');
      setPhone(u.phone || '');
      setCountry(u.country || 'India');
      setEmail(u.email || '');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await api.put('/buyer/profile', {
        companyName,
        gstin,
        deliveryAddress,
        phone,
        country
      });
      setSuccess('Buyer company profile updated successfully!');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏢</span>
          <h1 className="text-2xl font-black text-stone-900">Buyer Company Profile & Facilities</h1>
        </div>
        <p className="mt-1 text-sm text-stone-600">
          Configure your registered enterprise details, GSTIN tax identifiers, and default destination delivery hubs.
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
        <div className="py-12 text-center text-sm text-stone-500">Loading company profile...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <span>🏛️</span> Enterprise Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-stone-600">Company / Entity Name *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm font-semibold text-stone-900 focus:border-leaf-600 focus:ring-1 focus:ring-leaf-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-stone-600">GSTIN / Tax ID</label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="29ABCDE1234F1Z5"
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm font-mono uppercase text-stone-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-stone-600">Contact Email</label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-stone-600">Procurement Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase text-stone-600">Primary Delivery Destination / Warehouse *</label>
                <textarea
                  rows={3}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="e.g. Plot 45, APMC Yard, Yeshwanthpur Industrial Suburb, Bengaluru, Karnataka, 560022"
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-leaf-600 focus:ring-1 focus:ring-leaf-600"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-leaf-700 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-leaf-800 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : '💾 Save Profile'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
