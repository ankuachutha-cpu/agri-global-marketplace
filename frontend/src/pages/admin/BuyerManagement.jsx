import { useState, useEffect } from 'react';
import api, { errMsg } from '../../services/api.js';

export default function BuyerManagement() {
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchBuyers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin-portal/buyers');
      setBuyers(res.data.buyers || []);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuyers();
  }, []);

  const filtered = buyers.filter((b) => {
    const q = search.toLowerCase();
    return (
      b.companyName?.toLowerCase().includes(q) ||
      b.name?.toLowerCase().includes(q) ||
      b.email?.toLowerCase().includes(q) ||
      b.gstin?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏢</span>
            <h1 className="text-2xl font-black text-stone-900">Buyer Enterprise Directory</h1>
          </div>
          <p className="mt-1 text-sm text-stone-600">
            Registered commercial procurement buyers, food processors, and international importers.
          </p>
        </div>
        <div>
          <input
            type="text"
            placeholder="Search by company, GSTIN..."
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
        <div className="py-12 text-center text-sm text-stone-500">Loading buyer directory...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">
          No buyers found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-stone-700">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs font-bold uppercase text-stone-600">
              <tr>
                <th className="px-6 py-4">Company & Buyer</th>
                <th className="px-6 py-4">GSTIN / Tax ID</th>
                <th className="px-6 py-4">Country & Phone</th>
                <th className="px-6 py-4">Active Requirements</th>
                <th className="px-6 py-4">Total Demanded</th>
                <th className="px-6 py-4">Total Procured</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((b) => (
                <tr key={b._id} className="hover:bg-stone-50/70 transition">
                  <td className="px-6 py-4 font-bold text-stone-900">
                    <div>{b.companyName}</div>
                    <div className="text-xs font-normal text-stone-500">{b.name} ({b.email})</div>
                  </td>
                  <td className="px-6 py-4 font-mono font-semibold text-stone-800 text-xs">
                    {b.gstin || 'Not registered'}
                  </td>
                  <td className="px-6 py-4 text-xs text-stone-600">
                    <div>{b.country || 'India'}</div>
                    <div className="text-stone-400">{b.phone || '-'}</div>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-stone-900">
                    {b.requirementsCount} requirement(s)
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-stone-900">
                    {(b.totalDemandedKg / 1000).toFixed(1)} MT
                    <span className="block text-xs font-normal text-stone-500">{b.totalDemandedKg.toLocaleString()} kg</span>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-emerald-700">
                    {(b.totalProcuredKg / 1000).toFixed(1)} MT
                    <span className="block text-xs font-normal text-emerald-600">{b.totalProcuredKg.toLocaleString()} kg</span>
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
