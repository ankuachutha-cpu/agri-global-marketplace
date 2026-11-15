import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../services/api.js';

export default function FarmerInventory() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await api.get('/farmer/inventory');
      setInventory(res.data.inventory || []);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const filtered = inventory.filter((item) => {
    if (filter === 'all') return true;
    return item.name.toLowerCase() === filter.toLowerCase();
  });

  const getStatusBadge = (status, availKg) => {
    if (status === 'in_collection') {
      return <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">In Collection</span>;
    }
    if (status === 'collected') {
      return <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">Collected & QC Passed</span>;
    }
    if (status === 'allocated' || availKg <= 0) {
      return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Allocated to Buyer</span>;
    }
    return <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Available for Procurement</span>;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌾</span>
            <h1 className="text-2xl font-black text-stone-900">My Produce & Inventory</h1>
          </div>
          <p className="mt-1 text-sm text-stone-600">
            Real-time tracking of your registered produce across Karnataka. Produce is automatically allocated to verified buyers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/farmer/add-crop"
            className="rounded-xl bg-leaf-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-leaf-800"
          >
            ➕ Add Available Crop
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 pb-3">
        {['all', 'Ragi', 'Rice', 'Jowar'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
              filter === tab
                ? 'bg-leaf-700 text-white shadow-sm'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            {tab === 'all' ? 'All Crops' : tab}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-stone-500">Loading produce inventory...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <span className="text-4xl">🌾</span>
          <h3 className="mt-3 text-lg font-bold text-stone-900">No Produce Listed</h3>
          <p className="mt-1 text-sm text-stone-500">
            You haven't listed any {filter !== 'all' ? filter : 'Ragi, Rice, or Jowar'} produce yet.
          </p>
          <Link
            to="/farmer/add-crop"
            className="mt-4 inline-flex items-center rounded-xl bg-leaf-700 px-4 py-2 text-sm font-bold text-white hover:bg-leaf-800"
          >
            List Produce Now
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-stone-700">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs font-bold uppercase text-stone-600">
              <tr>
                <th className="px-6 py-4">Crop Produce</th>
                <th className="px-6 py-4">Quality Grade</th>
                <th className="px-6 py-4">Total Listed</th>
                <th className="px-6 py-4">Available Stock</th>
                <th className="px-6 py-4">Allocated</th>
                <th className="px-6 py-4">Collected</th>
                <th className="px-6 py-4">Expected Price</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((item) => (
                <tr key={item._id} className="hover:bg-stone-50/70 transition">
                  <td className="px-6 py-4 font-bold text-stone-900">
                    <div className="flex items-center gap-2">
                      <span>{item.name === 'Ragi' ? '🌾' : item.name === 'Rice' ? '🍚' : '🌽'}</span>
                      <div>
                        <div>{item.name}</div>
                        <div className="text-xs font-normal text-stone-500">{item.farmAddress}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-md bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-800">
                      {item.grade}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-stone-900">
                    {item.totalQuantityKg.toLocaleString()} kg
                    <span className="block text-xs font-normal text-stone-500">
                      ({(item.totalQuantityKg / 100).toFixed(1)} quintals)
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-emerald-700">
                    {item.availableQuantityKg.toLocaleString()} kg
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-amber-700">
                    {item.allocatedQuantityKg.toLocaleString()} kg
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-blue-700">
                    {item.collectedQuantityKg.toLocaleString()} kg
                  </td>
                  <td className="px-6 py-4 font-bold text-stone-900">
                    ₹{item.pricePerKg} / kg
                    <span className="block text-xs font-normal text-stone-500">
                      (₹{item.expectedPricePerQuintal} / quintal)
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(item.status, item.availableQuantityKg)}
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
