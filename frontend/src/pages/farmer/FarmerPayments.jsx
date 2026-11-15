import { useState, useEffect } from 'react';
import api, { errMsg } from '../../services/api.js';

export default function FarmerPayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/farmer/payments');
      setPayments(res.data.payments || []);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const totalSettled = payments
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + (p.finalPayableAmountInr || 0), 0);

  const totalPending = payments
    .filter((p) => p.status !== 'completed')
    .reduce((sum, p) => sum + (p.finalPayableAmountInr || 0), 0);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Settled (Paid)</span>;
      case 'processing':
        return <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">Processing Payout</span>;
      default:
        return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Pending Delivery</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💰</span>
          <h1 className="text-2xl font-black text-stone-900">Payment & Settlement History</h1>
        </div>
        <p className="mt-1 text-sm text-stone-600">
          Transparent financial ledger for your harvested and collected produce. Payments are credited directly via UPI or NEFT.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Total Settled Earnings</span>
          <div className="mt-2 text-3xl font-black text-emerald-950 font-mono">
            ₹{totalSettled.toLocaleString()}
          </div>
          <p className="mt-1 text-xs text-emerald-700">Credited to registered bank / UPI</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Pending Settlements</span>
          <div className="mt-2 text-3xl font-black text-amber-950 font-mono">
            ₹{totalPending.toLocaleString()}
          </div>
          <p className="mt-1 text-xs text-amber-700">Released upon consignment delivery confirmation</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Total Payout Records</span>
          <div className="mt-2 text-3xl font-black text-stone-900 font-mono">
            {payments.length}
          </div>
          <p className="mt-1 text-xs text-stone-500">Tracked with immutable transaction IDs</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-stone-500">Loading payment ledger...</div>
      ) : payments.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
          <span className="text-4xl">💳</span>
          <h3 className="mt-3 text-lg font-bold text-stone-900">No Payment Records Yet</h3>
          <p className="mt-1 text-sm text-stone-500">
            Payment records are automatically generated as soon as your produce is weighed and verified at farm collection.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-stone-700">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs font-bold uppercase text-stone-600">
              <tr>
                <th className="px-6 py-4">Payment Reference</th>
                <th className="px-6 py-4">Crop Produce</th>
                <th className="px-6 py-4">Accepted Quantity</th>
                <th className="px-6 py-4">Agreed Rate</th>
                <th className="px-6 py-4">Gross Amount</th>
                <th className="px-6 py-4">Net Payout</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Settlement Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {payments.map((p) => (
                <tr key={p._id} className="hover:bg-stone-50/70 transition">
                  <td className="px-6 py-4 font-mono font-bold text-stone-900">
                    {p.paymentId}
                    {p.requirementId && (
                      <span className="block text-xs font-normal text-stone-500">
                        Lot: {p.requirementId}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-bold text-stone-900">
                    {p.cropName}
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-stone-800">
                    {p.collectedQuantityKg.toLocaleString()} kg
                  </td>
                  <td className="px-6 py-4 font-semibold text-stone-800">
                    ₹{p.agreedPricePerKg} / kg
                  </td>
                  <td className="px-6 py-4 font-mono text-stone-700">
                    ₹{p.grossAmountInr.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-emerald-700 text-base">
                    ₹{p.finalPayableAmountInr.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(p.status)}
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {p.transactionRef ? (
                      <span className="font-mono text-stone-700 font-semibold block">
                        Ref: {p.transactionRef}
                      </span>
                    ) : (
                      <span className="text-stone-400 italic">Pending Transfer</span>
                    )}
                    {p.paymentDate && (
                      <span className="text-stone-500 block">
                        {new Date(p.paymentDate).toLocaleDateString()}
                      </span>
                    )}
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
