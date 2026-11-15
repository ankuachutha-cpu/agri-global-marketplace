import { useState, useEffect } from 'react';
import api, { errMsg } from '../../services/api.js';

export default function PaymentManagement() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [releasingId, setReleasingId] = useState(null);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin-portal/payments');
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

  const handleReleasePayment = async (id) => {
    setError('');
    setMessage('');
    setReleasingId(id);

    try {
      const res = await api.post(`/admin-portal/payments/${id}/release`);
      setMessage(res.data.message || 'Payment successfully released to farmer.');
      await fetchPayments();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setReleasingId(null);
    }
  };

  const totalVolume = payments.reduce((sum, p) => sum + (p.finalPayableAmountInr || 0), 0);
  const totalCompleted = payments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + (p.finalPayableAmountInr || 0), 0);
  const totalPending = payments.filter((p) => p.status !== 'completed').reduce((sum, p) => sum + (p.finalPayableAmountInr || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">💰</span>
            <h1 className="text-2xl font-black text-stone-900">Farmer Payment & Settlement Ledger</h1>
          </div>
          <p className="mt-1 text-sm text-stone-600">
            Authorize direct payouts for weighed and verified farm produce. All settlements are tracked with bank references.
          </p>
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          ✅ {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-bold uppercase text-stone-500">Total Settlement Volume</span>
          <div className="mt-2 text-3xl font-black text-stone-900 font-mono">
            ₹{totalVolume.toLocaleString()}
          </div>
          <p className="mt-1 text-xs text-stone-500">{payments.length} transactions recorded</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
          <span className="text-xs font-bold uppercase text-emerald-800">Settled (Paid)</span>
          <div className="mt-2 text-3xl font-black text-emerald-950 font-mono">
            ₹{totalCompleted.toLocaleString()}
          </div>
          <p className="mt-1 text-xs text-emerald-700">Disbursed to farmers via UPI / NEFT</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
          <span className="text-xs font-bold uppercase text-amber-800">Pending Authorization</span>
          <div className="mt-2 text-3xl font-black text-amber-950 font-mono">
            ₹{totalPending.toLocaleString()}
          </div>
          <p className="mt-1 text-xs text-amber-700">Ready for admin payout release</p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-stone-500">Loading payment ledger...</div>
      ) : payments.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">
          No payment records found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-stone-700">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs font-bold uppercase text-stone-600">
              <tr>
                <th className="px-6 py-4">Payment ID & Lot</th>
                <th className="px-6 py-4">Farmer Recipient</th>
                <th className="px-6 py-4">Produce & Quantity</th>
                <th className="px-6 py-4">Agreed Rate</th>
                <th className="px-6 py-4">Final Payable</th>
                <th className="px-6 py-4">Status & Reference</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {payments.map((p) => {
                const isPaid = p.status === 'completed';

                return (
                  <tr key={p._id} className="hover:bg-stone-50/70 transition">
                    <td className="px-6 py-4 font-mono font-bold text-stone-900">
                      {p.paymentId}
                      {p.requirementId && (
                        <span className="block text-xs font-normal text-stone-500">
                          Lot: #{p.requirementId}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-stone-900">
                      {p.farmerName}
                      <span className="block text-xs font-normal text-stone-500">
                        {p.farmer?.bankAccount?.upiId || p.farmer?.bankAccount?.accountNumber ? (
                          <span className="text-emerald-700 font-mono">
                            {p.farmer.bankAccount.upiId || `A/C: ${p.farmer.bankAccount.accountNumber}`}
                          </span>
                        ) : (
                          'Bank info on file'
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-stone-900">{p.cropName}</span>
                      <span className="block font-mono text-xs text-stone-600 font-bold">
                        {p.collectedQuantityKg.toLocaleString()} kg
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-stone-800">
                      ₹{p.agreedPricePerKg} / kg
                    </td>
                    <td className="px-6 py-4 font-mono font-black text-emerald-800 text-base">
                      ₹{p.finalPayableAmountInr.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                        isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {p.status}
                      </span>
                      {p.transactionRef && (
                        <span className="font-mono text-stone-600 block mt-1">
                          {p.transactionRef}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isPaid ? (
                        <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                          <span>✓</span> Settled
                        </span>
                      ) : (
                        <button
                          onClick={() => handleReleasePayment(p._id)}
                          disabled={releasingId === p._id}
                          className="rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50 transition"
                        >
                          {releasingId === p._id ? 'Releasing...' : '⚡ Release Payout'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
