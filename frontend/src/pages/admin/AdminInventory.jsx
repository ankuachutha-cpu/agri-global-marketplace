import { useState, useEffect } from 'react';
import api, { errMsg } from '../../services/api.js';

export default function AdminInventory() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [cropName, setCropName] = useState('all');
  const [grade, setGrade] = useState('all');
  const [status, setStatus] = useState('all');

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const params = {};
      if (cropName !== 'all') params.cropName = cropName;
      if (grade !== 'all') params.grade = grade;
      if (status !== 'all') params.status = status;

      const res = await api.get('/admin-portal/inventory', { params });
      setInventory(res.data.inventory || []);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [cropName, grade, status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📦</span>
            <h1 className="text-2xl font-black text-stone-900">Centralized Agricultural Inventory</h1>
          </div>
          <p className="mt-1 text-sm text-stone-600">
            Real-time multi-farm inventory monitoring for <strong>Ragi</strong>, <strong>Rice</strong>, and <strong>Jowar</strong> across Karnataka.
          </p>
        </div>

        {/* Filter selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={cropName}
            onChange={(e) => setCropName(e.target.value)}
            className="rounded-xl border border-stone-300 px-3 py-1.5 text-xs font-bold text-stone-800"
          >
            <option value="all">All Crops</option>
            <option value="Ragi">Ragi</option>
            <option value="Rice">Rice</option>
            <option value="Jowar">Jowar</option>
          </select>

          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="rounded-xl border border-stone-300 px-3 py-1.5 text-xs font-bold text-stone-800"
          >
            <option value="all">All Grades</option>
            <option value="Grade A">Grade A</option>
            <option value="Grade B">Grade B</option>
            <option value="Grade C">Grade C</option>
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-stone-300 px-3 py-1.5 text-xs font-bold text-stone-800"
          >
            <option value="all">All Statuses</option>
            <option value="available">Available</option>
            <option value="allocated">Allocated</option>
            <option value="in_collection">In Collection</option>
            <option value="collected">Collected</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-stone-500">Loading inventory data...</div>
      ) : inventory.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">
          No crops found matching current filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-stone-700">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs font-bold uppercase text-stone-600">
              <tr>
                <th className="px-6 py-4">Produce & Farmer</th>
                <th className="px-6 py-4">Grade</th>
                <th className="px-6 py-4">Total Physical</th>
                <th className="px-6 py-4">Available Free</th>
                <th className="px-6 py-4">Allocated</th>
                <th className="px-6 py-4">Collected</th>
                <th className="px-6 py-4">Procurement Rate</th>
                <th className="px-6 py-4">District / Location</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {inventory.map((c) => (
                <tr key={c._id} className="hover:bg-stone-50/70 transition">
                  <td className="px-6 py-4 font-bold text-stone-900">
                    <div className="flex items-center gap-2">
                      <span>{c.name === 'Ragi' ? '🌾' : c.name === 'Rice' ? '🍚' : '🌽'}</span>
                      <div>
                        <div>{c.name}</div>
                        <div className="text-xs font-normal text-stone-500">{c.farmerName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-800">
                      {c.grade}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-stone-900">
                    {c.totalQuantityKg.toLocaleString()} kg
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-emerald-700">
                    {c.availableQuantityKg.toLocaleString()} kg
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-amber-700">
                    {c.allocatedQuantityKg.toLocaleString()} kg
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-blue-700">
                    {c.collectedQuantityKg.toLocaleString()} kg
                  </td>
                  <td className="px-6 py-4 font-semibold text-stone-900">
                    ₹{c.pricePerKg} / kg
                  </td>
                  <td className="px-6 py-4 text-xs text-stone-600 max-w-[200px] truncate">
                    <span className="font-semibold text-stone-900 block">{c.district || 'Mandya'}</span>
                    <span className="text-stone-500 truncate">{c.village || c.farmAddress}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                      c.status === 'collected'
                        ? 'bg-blue-100 text-blue-800'
                        : c.status === 'allocated' || c.availableQuantityKg <= 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {c.status}
                    </span>
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
