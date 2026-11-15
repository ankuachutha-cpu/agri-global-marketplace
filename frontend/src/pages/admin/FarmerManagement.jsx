import { useState, useEffect } from 'react';
import api, { errMsg } from '../../services/api.js';

export default function FarmerManagement() {
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchFarmers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin-portal/farmers');
      setFarmers(res.data.farmers || []);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFarmers();
  }, []);

  const toggleStatus = async (id, currentActive) => {
    try {
      await api.patch(`/admin-portal/farmers/${id}/status`, { active: !currentActive });
      setFarmers((prev) =>
        prev.map((f) => (f._id === id ? { ...f, active: !currentActive } : f))
      );
    } catch (err) {
      alert(errMsg(err));
    }
  };

  const filtered = farmers.filter((f) => {
    const q = search.toLowerCase();
    return (
      f.name?.toLowerCase().includes(q) ||
      f.email?.toLowerCase().includes(q) ||
      f.farmLocation?.district?.toLowerCase().includes(q) ||
      f.farmLocation?.village?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">👨‍🌾</span>
            <h1 className="text-2xl font-black text-stone-900">Farmer Directory & Geographic Management</h1>
          </div>
          <p className="mt-1 text-sm text-stone-600">
            Registered agricultural producers across Karnataka with real-time stock and GPS locations.
          </p>
        </div>
        <div>
          <input
            type="text"
            placeholder="Search by name, district, village..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-stone-300 px-4 py-2 text-sm text-stone-900 focus:border-leaf-600"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-stone-500">Loading farmer directory...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">
          No farmers found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-stone-700">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs font-bold uppercase text-stone-600">
              <tr>
                <th className="px-6 py-4">Farmer Name & Contact</th>
                <th className="px-6 py-4">Farm Address & GPS Location</th>
                <th className="px-6 py-4">Total Listed Stock</th>
                <th className="px-6 py-4">Free Stock</th>
                <th className="px-6 py-4">Payout Account</th>
                <th className="px-6 py-4">Status & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((f) => (
                <tr key={f._id} className="hover:bg-stone-50/70 transition">
                  <td className="px-6 py-4 font-bold text-stone-900">
                    <div>{f.name}</div>
                    <div className="text-xs font-normal text-stone-500">{f.email} | {f.phone || 'No phone'}</div>
                  </td>
                  <td className="px-6 py-4 text-xs text-stone-600 max-w-[280px]">
                    <div className="font-semibold text-stone-900">
                      {f.farmLocation?.village || ''} {f.farmLocation?.district ? `(${f.farmLocation.district})` : ''}
                    </div>
                    <div className="text-stone-500 truncate">{f.farmLocation?.address || 'Karnataka'}</div>
                    {f.farmLocation?.latitude && (
                      <span className="font-mono text-[11px] text-leaf-700 block mt-0.5">
                        GPS: {Number(f.farmLocation.latitude).toFixed(4)}, {Number(f.farmLocation.longitude).toFixed(4)}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-stone-900">
                    {f.totalListedKg.toLocaleString()} kg
                    <span className="block text-xs font-normal text-stone-500">({f.cropsCount} crop listing(s))</span>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-emerald-700">
                    {f.availableStockKg.toLocaleString()} kg
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {f.bankAccountConfigured ? (
                      <span className="rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">
                        ✓ Bank / UPI Set
                      </span>
                    ) : (
                      <span className="text-stone-400 italic">Not Added</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleStatus(f._id, f.active)}
                      className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                        f.active
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {f.active ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
