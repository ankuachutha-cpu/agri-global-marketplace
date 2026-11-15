import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api, { errMsg } from '../services/api.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { Spinner, Empty, PageHeader } from '../components/ui.jsx';
import { fmtDate } from '../utils/format.js';

export default function Finance() {
  const { user } = useAuth();
  const { format } = useCurrency();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const role = user?.role || 'buyer';
  const defaultTab = role === 'farmer' ? 'My Earnings' : role === 'admin' ? 'Treasury Overview' : 'Invoices & Checkout';
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Modals state
  const [showPayModal, setShowPayModal] = useState(false);
  const [payTargetOrder, setPayTargetOrder] = useState(null);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleFarmerData, setSettleFarmerData] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundPayment, setRefundPayment] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Settle Form State
  const [settleMethod, setSettleMethod] = useState('UPI');
  const [settleUpi, setSettleUpi] = useState('');
  const [settleAccNum, setSettleAccNum] = useState('');
  const [settleIfsc, setSettleIfsc] = useState('');
  const [settleBank, setSettleBank] = useState('');
  const [settleNotes, setSettleNotes] = useState('');

  // Farmer Bank Settings Form State
  const [bankHolder, setBankHolder] = useState(user?.bankAccount?.accountHolderName || user?.name || '');
  const [bankAcc, setBankAcc] = useState(user?.bankAccount?.accountNumber || '');
  const [bankIfsc, setBankIfsc] = useState(user?.bankAccount?.ifscCode || '');
  const [bankName, setBankName] = useState(user?.bankAccount?.bankName || '');
  const [farmerUpi, setFarmerUpi] = useState(user?.bankAccount?.upiId || '');
  const [settlePref, setSettlePref] = useState(user?.bankAccount?.settlementPreference || 'UPI');
  const [savingBank, setSavingBank] = useState(false);

  // Refund Form State
  const [refundReason, setRefundReason] = useState('Order cancelled / quality dispute');
  const [refundAmount, setRefundAmount] = useState('');

  // Data fetching based on role
  const adminApi = useApi('/payments/dashboard/admin', { skip: role !== 'admin' });
  const farmerApi = useApi('/payments/dashboard/farmer', { skip: role !== 'farmer' });
  const buyerApi = useApi('/payments/dashboard/buyer', { skip: role !== 'buyer' });
  const configApi = useApi('/payments/config');

  const reloadAll = () => {
    if (role === 'admin') adminApi.reload();
    if (role === 'farmer') farmerApi.reload();
    if (role === 'buyer') buyerApi.reload();
  };

  // Handlers
  const handleCheckoutPayment = async () => {
    if (!payTargetOrder) return;
    setSubmitting(true);
    try {
      // 1. Create Gateway Order
      const createRes = await api.post('/payments/create-order', {
        orderId: payTargetOrder._id,
        amount: payTargetOrder.totalInr,
        currency: 'INR',
        purpose: 'order_purchase',
        idempotencyKey: `PAY-CHECKOUT-${payTargetOrder._id}-${Date.now()}`
      });

      const { paymentId, gatewayOrderId } = createRes.data;

      // 2. Complete payment via backend cryptographic verification
      const verifyRes = await api.post('/payments/verify', {
        paymentId,
        gatewayOrderId,
        gatewayPaymentId: `pay_demo_${Date.now()}`,
        gatewaySignature: 'demo_signature_ok'
      });

      toast(`Payment of ₹${payTargetOrder.totalInr.toLocaleString()} verified and settled! Receipt: ${verifyRes.data.receiptNumber}`);
      setShowPayModal(false);
      setPayTargetOrder(null);
      reloadAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisburseSettlement = async (e) => {
    e.preventDefault();
    if (!settleFarmerData) return;
    setSubmitting(true);
    try {
      const gross = settleFarmerData.amountInr;
      const res = await api.post('/payments/settle-farmer', {
        farmerId: settleFarmerData.farmerId,
        collectionId: settleFarmerData.collectionId,
        cropName: settleFarmerData.cropName,
        acceptedQuantityKg: settleFarmerData.acceptedQuantityKg,
        ratePerKg: settleFarmerData.ratePerKg,
        amountInr: gross,
        paymentMethod: settleMethod,
        beneficiaryDetails: {
          accountNumber: settleAccNum,
          ifscCode: settleIfsc,
          bankName: settleBank,
          upiId: settleUpi
        },
        idempotencyKey: `SET-DISBURSE-${settleFarmerData.collectionId || settleFarmerData.farmerId}-${Date.now()}`,
        notes: settleNotes
      });

      toast(`Settlement disbursed! Net payout: ₹${res.data.settlement.netPayoutInr.toLocaleString()} (UTR: ${res.data.settlement.transactionReference})`);
      setShowSettleModal(false);
      setSettleFarmerData(null);
      reloadAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveBankSettings = async (e) => {
    e.preventDefault();
    setSavingBank(true);
    try {
      await api.patch('/payments/farmer/bank-details', {
        accountHolderName: bankHolder,
        accountNumber: bankAcc,
        ifscCode: bankIfsc,
        bankName,
        upiId: farmerUpi,
        settlementPreference: settlePref
      });
      toast('Bank and UPI settlement credentials saved successfully');
      reloadAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSavingBank(false);
    }
  };

  const handleOpenInvoice = async (invoiceNumber) => {
    try {
      const res = await api.get(`/payments/invoices/${invoiceNumber}`);
      setInvoiceData(res.data);
      setShowInvoiceModal(true);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleProcessRefund = async (e) => {
    e.preventDefault();
    if (!refundPayment) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/payments/${refundPayment._id || refundPayment.paymentId}/refund`, {
        reason: refundReason,
        amountInr: refundAmount ? Number(refundAmount) : refundPayment.amountInr
      });
      toast(`Refund processed successfully: ${res.data.refund.refundId}`);
      setShowRefundModal(false);
      setRefundPayment(null);
      reloadAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Financial Transactions & Payment Settlement"
          subtitle="Razorpay digital checkout, 5% platform commission accounting, farmer payouts via UPI/NEFT, and export commercial invoices"
        />
        <div className="flex gap-2">
          {role === 'buyer' && (
            <Link to="/buyer/portal" className="btn-outline">
              📋 My Purchase Orders
            </Link>
          )}
          <button className="btn-primary" onClick={reloadAll}>
            🔄 Refresh Ledgers
          </button>
        </div>
      </div>

      {/* Role-Specific Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-2">
        {role === 'admin' && ['Treasury Overview', 'Disburse Farmer Payouts', 'Payment Transactions', 'Receipts & Refunds'].map((t) => (
          <button
            key={t}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
              activeTab === t ? 'bg-leaf-700 text-white shadow-sm' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}

        {role === 'farmer' && ['My Earnings', 'Settlement History', 'Bank & UPI Settings'].map((t) => (
          <button
            key={t}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
              activeTab === t ? 'bg-leaf-700 text-white shadow-sm' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}

        {role === 'buyer' && ['Invoices & Checkout', 'Payment Receipts', 'Escrow Status'].map((t) => (
          <button
            key={t}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
              activeTab === t ? 'bg-leaf-700 text-white shadow-sm' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ======================================================== */}
      {/* ADMIN VIEW                                               */}
      {/* ======================================================== */}
      {role === 'admin' && activeTab === 'Treasury Overview' && (
        <div className="space-y-6">
          {/* Admin KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="card border-l-4 border-l-blue-600">
              <p className="text-xs font-bold uppercase text-stone-500">Gross Marketplace Volume</p>
              <p className="mt-1 text-2xl font-black text-blue-900">
                ₹{(adminApi.data?.metrics?.totalGrossVolumeInr || 0).toLocaleString()}
              </p>
              <p className="text-xs text-stone-500">{adminApi.data?.metrics?.totalPaymentsCount || 0} completed orders</p>
            </div>
            <div className="card border-l-4 border-l-emerald-600">
              <p className="text-xs font-bold uppercase text-stone-500">Platform Commissions (5%)</p>
              <p className="mt-1 text-2xl font-black text-emerald-900">
                ₹{(adminApi.data?.metrics?.totalCommissionsCollectedInr || 0).toLocaleString()}
              </p>
              <p className="text-xs text-stone-500">Standard 5% platform fee</p>
            </div>
            <div className="card border-l-4 border-l-leaf-600">
              <p className="text-xs font-bold uppercase text-stone-500">Farmer Payouts Disbursed</p>
              <p className="mt-1 text-2xl font-black text-leaf-800">
                ₹{(adminApi.data?.metrics?.totalFarmerPayoutsDisbursedInr || 0).toLocaleString()}
              </p>
              <p className="text-xs text-stone-500">{adminApi.data?.metrics?.totalSettlementsCount || 0} UTR transfers</p>
            </div>
            <div className="card border-l-4 border-l-amber-600">
              <p className="text-xs font-bold uppercase text-stone-500">Disbursal Success Rate</p>
              <p className="mt-1 text-2xl font-black text-amber-900">100%</p>
              <p className="text-xs text-stone-500">Zero double-disbursement guarantee</p>
            </div>
            <div className="card border-l-4 border-l-red-600">
              <p className="text-xs font-bold uppercase text-stone-500">Total Refunds Processed</p>
              <p className="mt-1 text-2xl font-black text-red-900">
                ₹{(adminApi.data?.metrics?.totalRefundsInr || 0).toLocaleString()}
              </p>
              <p className="text-xs text-stone-500">Disputes & cancelled orders</p>
            </div>
          </div>

          {/* Recent Payments Table */}
          <div className="card space-y-3">
            <h3 className="font-bold text-stone-800 text-sm">Recent Buyer Payments</h3>
            {!adminApi.data?.recentPayments?.length ? (
              <p className="text-xs text-stone-500">No payment transactions recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-stone-50 text-stone-500">
                    <tr>
                      <th className="p-2">Payment ID</th>
                      <th>Payer (Buyer)</th>
                      <th>Gross Value</th>
                      <th>5% Commission</th>
                      <th>Net Disbursal</th>
                      <th>Status</th>
                      <th>Receipt #</th>
                      <th className="text-right p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {adminApi.data.recentPayments.map((p) => (
                      <tr key={p._id}>
                        <td className="p-2 font-mono font-bold text-stone-900">{p.paymentId}</td>
                        <td>{p.payerName} ({p.payerCountry})</td>
                        <td className="font-bold text-stone-900">₹{p.amountInr?.toLocaleString()}</td>
                        <td className="text-emerald-700 font-semibold">₹{p.platformCommissionInr?.toLocaleString()}</td>
                        <td className="text-leaf-800 font-semibold">₹{p.netDisbursalInr?.toLocaleString()}</td>
                        <td>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            p.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                            p.status === 'refunded' ? 'bg-red-100 text-red-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="font-mono text-purple-800">{p.receiptNumber || '—'}</td>
                        <td className="text-right p-2">
                          {p.status === 'completed' && (
                            <button
                              className="text-red-600 hover:underline text-[11px] font-semibold"
                              onClick={() => {
                                setRefundPayment(p);
                                setRefundAmount(String(p.amountInr));
                                setShowRefundModal(true);
                              }}
                            >
                              Refund
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADMIN TAB 2: DISBURSE FARMER PAYOUTS */}
      {role === 'admin' && activeTab === 'Disburse Farmer Payouts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-stone-800 text-sm">Disburse Farmer Bank / UPI Settlements</h3>
              <p className="text-xs text-stone-500">Direct Benefit Transfer (DBT) with automated 5% commission accounting</p>
            </div>
            <button
              className="btn-primary text-xs"
              onClick={() => {
                setSettleFarmerData({
                  farmerId: user._id,
                  collectionId: `COL-MANUAL-${Date.now().toString().slice(-4)}`,
                  cropName: 'Assorted Vegetables',
                  acceptedQuantityKg: 500,
                  ratePerKg: 40,
                  amountInr: 20000
                });
                setShowSettleModal(true);
              }}
            >
              + Create Direct Payout
            </button>
          </div>

          <div className="card space-y-3">
            <h4 className="font-bold text-stone-800 text-xs uppercase">Recent Disbursed Settlements</h4>
            {!adminApi.data?.recentSettlements?.length ? (
              <p className="text-xs text-stone-500">No farmer settlements disbursed yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-stone-50 text-stone-500">
                    <tr>
                      <th className="p-2">Settlement ID</th>
                      <th>Farmer Name</th>
                      <th>Crop & Volume</th>
                      <th>Gross Amount</th>
                      <th>5% Commission</th>
                      <th>Net Transferred</th>
                      <th>UTR / Transaction Ref</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {adminApi.data.recentSettlements.map((s) => (
                      <tr key={s._id}>
                        <td className="p-2 font-mono font-bold text-stone-900">{s.settlementId}</td>
                        <td className="font-semibold text-stone-800">{s.farmerName}</td>
                        <td>{s.cropName} ({s.acceptedQuantityKg} kg)</td>
                        <td>₹{s.grossPayableInr?.toLocaleString()}</td>
                        <td className="text-emerald-700 font-semibold">₹{s.platformCommissionInr?.toLocaleString()}</td>
                        <td className="font-bold text-leaf-800">₹{s.netPayoutInr?.toLocaleString()}</td>
                        <td className="font-mono text-blue-800">{s.transactionReference}</td>
                        <td className="text-stone-400">{fmtDate(s.settledAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* FARMER VIEW                                              */}
      {/* ======================================================== */}
      {role === 'farmer' && activeTab === 'My Earnings' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card border-l-4 border-l-leaf-600">
              <p className="text-xs font-bold uppercase text-stone-500">Total Net Disbursed</p>
              <p className="mt-1 text-2xl font-black text-leaf-800">
                ₹{(farmerApi.data?.metrics?.totalSettledEarningsInr || 0).toLocaleString()}
              </p>
              <p className="text-xs text-stone-500">Received via UPI / NEFT</p>
            </div>
            <div className="card border-l-4 border-l-amber-600">
              <p className="text-xs font-bold uppercase text-stone-500">Pending Payable Balance</p>
              <p className="mt-1 text-2xl font-black text-amber-900">
                ₹{(farmerApi.data?.metrics?.payableBalanceInr || 0).toLocaleString()}
              </p>
              <p className="text-xs text-stone-500">Accepted produce awaiting payout</p>
            </div>
            <div className="card border-l-4 border-l-emerald-600">
              <p className="text-xs font-bold uppercase text-stone-500">Settlements Received</p>
              <p className="mt-1 text-2xl font-black text-emerald-900">
                {farmerApi.data?.metrics?.settlementsCount || 0}
              </p>
              <p className="text-xs text-stone-500">Verified UTR transactions</p>
            </div>
            <div className="card border-l-4 border-l-blue-600">
              <p className="text-xs font-bold uppercase text-stone-500">Platform Facilitation Fee</p>
              <p className="mt-1 text-2xl font-black text-blue-900">5.0%</p>
              <p className="text-xs text-stone-500">Transparent quality inspection fee</p>
            </div>
          </div>

          <div className="card space-y-3">
            <h3 className="font-bold text-stone-800 text-sm">Disbursed Payout Transactions</h3>
            {!farmerApi.data?.settlements?.length ? (
              <p className="text-xs text-stone-500">No settlement transfers recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-stone-50 text-stone-500">
                    <tr>
                      <th className="p-2">Settlement ID</th>
                      <th>Crop & Volume</th>
                      <th>Gross Value</th>
                      <th>5% Commission</th>
                      <th>Net Credited</th>
                      <th>Method & UTR</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {farmerApi.data.settlements.map((s) => (
                      <tr key={s._id}>
                        <td className="p-2 font-mono font-bold text-stone-900">{s.settlementId}</td>
                        <td>{s.cropName} ({s.acceptedQuantityKg} kg)</td>
                        <td>₹{s.grossPayableInr?.toLocaleString()}</td>
                        <td className="text-emerald-700">₹{s.platformCommissionInr?.toLocaleString()}</td>
                        <td className="font-bold text-leaf-800">₹{s.netPayoutInr?.toLocaleString()}</td>
                        <td>
                          <span className="font-mono text-purple-800">{s.transactionReference}</span>
                          <span className="ml-1 text-[10px] text-stone-500">({s.paymentMethod})</span>
                        </td>
                        <td className="text-stone-400">{fmtDate(s.settledAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FARMER TAB 3: BANK & UPI SETTINGS */}
      {role === 'farmer' && activeTab === 'Bank & UPI Settings' && (
        <div className="card max-w-xl bg-white space-y-4">
          <h3 className="font-bold text-stone-900 text-base">🏦 Farmer Payout & Bank Credentials</h3>
          <p className="text-xs text-stone-500">
            Configure your UPI VPA or Bank Account details for instant direct settlement transfers upon quality inspection.
          </p>

          <form onSubmit={handleSaveBankSettings} className="space-y-3 text-xs">
            <div>
              <label className="font-bold text-stone-700 block mb-1">Account Holder Name</label>
              <input className="input w-full" value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-stone-700 block mb-1">UPI ID (VPA)</label>
                <input className="input w-full font-mono" value={farmerUpi} onChange={(e) => setFarmerUpi(e.target.value)} placeholder="kisan@okhdfcbank" />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Settlement Preference</label>
                <select className="input w-full" value={settlePref} onChange={(e) => setSettlePref(e.target.value)}>
                  <option value="UPI">Instant UPI (Recommended)</option>
                  <option value="NEFT">Bank Account NEFT / RTGS</option>
                </select>
              </div>
            </div>

            <div className="border-t pt-3 space-y-3">
              <h4 className="font-bold text-stone-700">Bank Account Details (NEFT / RTGS)</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Bank Account Number</label>
                  <input className="input w-full font-mono" value={bankAcc} onChange={(e) => setBankAcc(e.target.value)} placeholder="012345678901" />
                </div>
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">IFSC Code</label>
                  <input className="input w-full font-mono" value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} placeholder="HDFC0001234" />
                </div>
              </div>
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Bank Name & Branch</label>
                <input className="input w-full" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="State Bank of India - Mandya Branch" />
              </div>
            </div>

            <div className="pt-2 text-right">
              <button type="submit" className="btn-primary" disabled={savingBank}>
                {savingBank ? 'Saving...' : 'Save Settlement Details'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* BUYER VIEW                                               */}
      {/* ======================================================== */}
      {role === 'buyer' && activeTab === 'Invoices & Checkout' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card border-l-4 border-l-blue-600">
              <p className="text-xs font-bold uppercase text-stone-500">Total Purchase Orders</p>
              <p className="mt-1 text-2xl font-black text-blue-900">
                ₹{(buyerApi.data?.metrics?.totalSpentInr || 0).toLocaleString()}
              </p>
              <p className="text-xs text-stone-500">Paid commercial volume</p>
            </div>
            <div className="card border-l-4 border-l-amber-600">
              <p className="text-xs font-bold uppercase text-stone-500">Pending Invoices</p>
              <p className="mt-1 text-2xl font-black text-amber-900">
                ₹{(buyerApi.data?.metrics?.pendingInvoicesInr || 0).toLocaleString()}
              </p>
              <p className="text-xs text-stone-500">Awaiting digital checkout</p>
            </div>
            <div className="card border-l-4 border-l-emerald-600">
              <p className="text-xs font-bold uppercase text-stone-500">Payment Gateway</p>
              <p className="mt-1 text-2xl font-black text-emerald-900">Razorpay Live</p>
              <p className="text-xs text-stone-500">Cards, NetBanking, UPI, Swift Wire</p>
            </div>
          </div>

          <div className="card space-y-3">
            <h3 className="font-bold text-stone-800 text-sm">Commercial Export Orders & Invoices</h3>
            {!buyerApi.data?.orders?.length ? (
              <p className="text-xs text-stone-500">No export purchase orders placed yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-stone-50 text-stone-500">
                    <tr>
                      <th className="p-2">Invoice / PO Number</th>
                      <th>Commodity & Quantity</th>
                      <th>Total Export Value</th>
                      <th>Payment Status</th>
                      <th>Receipt #</th>
                      <th className="text-right p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {buyerApi.data.orders.map((o) => (
                      <tr key={o._id}>
                        <td className="p-2">
                          <div className="font-mono font-bold text-stone-900">{o.invoiceNumber || o._id}</div>
                          <div className="text-[10px] text-stone-400">{fmtDate(o.createdAt)}</div>
                        </td>
                        <td>
                          <div className="font-semibold text-stone-800">{o.cropName}</div>
                          <div className="text-stone-500">{o.quantity} {o.unit}</div>
                        </td>
                        <td className="font-bold text-emerald-800">
                          ₹{o.totalInr?.toLocaleString()}
                        </td>
                        <td>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            o.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {o.paymentStatus || 'pending'}
                          </span>
                        </td>
                        <td className="font-mono text-purple-800">{o.receiptNumber || '—'}</td>
                        <td className="text-right p-2 space-x-2">
                          {o.invoiceNumber && (
                            <button
                              className="btn-outline text-[11px] px-2 py-0.5"
                              onClick={() => handleOpenInvoice(o.invoiceNumber)}
                            >
                              📄 Invoice
                            </button>
                          )}
                          {o.paymentStatus !== 'paid' && (
                            <button
                              className="btn-primary text-[11px] px-2.5 py-0.5"
                              onClick={() => {
                                setPayTargetOrder(o);
                                setShowPayModal(true);
                              }}
                            >
                              💳 Pay via Razorpay
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODALS                                                   */}
      {/* ======================================================== */}

      {/* RAZORPAY CHECKOUT MODAL */}
      {showPayModal && payTargetOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">💳</span>
                <h3 className="font-bold text-stone-900 text-sm">Razorpay Secure Checkout</h3>
              </div>
              <button className="text-stone-400 hover:text-stone-700" onClick={() => setShowPayModal(false)}>✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-stone-50 p-3 rounded space-y-1">
                <div className="flex justify-between">
                  <span className="text-stone-500">Order / Invoice:</span>
                  <span className="font-mono font-bold text-stone-800">{payTargetOrder.invoiceNumber || payTargetOrder._id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Commodity:</span>
                  <span className="font-semibold text-stone-800">{payTargetOrder.cropName} ({payTargetOrder.quantity} {payTargetOrder.unit})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Platform Facilitation (5%):</span>
                  <span className="text-stone-600">₹{(Math.round(payTargetOrder.totalInr * 0.05)).toLocaleString()} (Included)</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold text-base text-leaf-800">
                  <span>Total Amount:</span>
                  <span>₹{payTargetOrder.totalInr.toLocaleString()}</span>
                </div>
              </div>

              <div className="border border-blue-200 bg-blue-50/50 p-2.5 rounded text-[11px] text-blue-900">
                🔒 Protected by 256-bit SSL encryption & cryptographic HMAC signature verification. Supports International Credit/Debit Cards, UPI, NetBanking and Wire Transfer.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" className="btn-outline" onClick={() => setShowPayModal(false)}>Cancel</button>
                <button type="button" className="btn-primary" onClick={handleCheckoutPayment} disabled={submitting}>
                  {submitting ? 'Verifying with Gateway...' : `Authorize & Pay ₹${payTargetOrder.totalInr.toLocaleString()}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SETTLE FARMER MODAL (ADMIN) */}
      {showSettleModal && settleFarmerData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md bg-white shadow-2xl">
            <h3 className="font-bold text-stone-900 text-sm mb-3">Disburse Farmer Bank / UPI Settlement</h3>
            <form onSubmit={handleDisburseSettlement} className="space-y-3 text-xs">
              <div className="bg-stone-50 p-3 rounded space-y-1">
                <div className="flex justify-between">
                  <span className="text-stone-500">Produce:</span>
                  <span className="font-semibold text-stone-800">{settleFarmerData.cropName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Accepted Weight:</span>
                  <span>{settleFarmerData.acceptedQuantityKg} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Gross Payable:</span>
                  <span className="font-bold text-stone-800">₹{settleFarmerData.amountInr.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Platform Fee (5%):</span>
                  <span>- ₹{Math.round(settleFarmerData.amountInr * 0.05).toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold text-base text-leaf-800">
                  <span>Net Payout to Farmer:</span>
                  <span>₹{(settleFarmerData.amountInr - Math.round(settleFarmerData.amountInr * 0.05)).toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">Disbursal Method</label>
                <select className="input w-full" value={settleMethod} onChange={(e) => setSettleMethod(e.target.value)}>
                  <option value="UPI">UPI Transfer</option>
                  <option value="NEFT">NEFT / RTGS Bank Transfer</option>
                  <option value="IMPS">IMPS Immediate Payout</option>
                </select>
              </div>

              {settleMethod === 'UPI' ? (
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Beneficiary UPI ID</label>
                  <input className="input w-full font-mono" value={settleUpi} onChange={(e) => setSettleUpi(e.target.value)} placeholder="kisan@okhdfcbank" required />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <input className="input font-mono" value={settleAccNum} onChange={(e) => setSettleAccNum(e.target.value)} placeholder="Account Number" required />
                  <input className="input font-mono" value={settleIfsc} onChange={(e) => setSettleIfsc(e.target.value)} placeholder="IFSC Code" required />
                </div>
              )}

              <div>
                <label className="font-bold text-stone-700 block mb-1">Settlement Notes</label>
                <input className="input w-full" value={settleNotes} onChange={(e) => setSettleNotes(e.target.value)} placeholder="Harvest batch verified and approved by hub QC" />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" className="btn-outline" onClick={() => setShowSettleModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Disbursing...' : 'Disburse Net Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE INVOICE MODAL */}
      {showInvoiceModal && invoiceData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <div>
                <span className="text-xs font-bold text-leaf-700 uppercase tracking-wider">AgriGlobal International B2B Platform</span>
                <h3 className="text-lg font-black text-stone-900">Commercial Export Invoice</h3>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary text-xs" onClick={() => window.print()}>
                  🖨️ Print / Save PDF
                </button>
                <button className="text-stone-400 hover:text-stone-700 px-2" onClick={() => setShowInvoiceModal(false)}>✕</button>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-stone-50 p-3 rounded">
                <div>
                  <p className="font-bold text-stone-700 uppercase text-[10px]">Exporter / Supplier</p>
                  <p className="font-bold text-stone-900 text-sm mt-0.5">{invoiceData.supplier?.name}</p>
                  <p className="text-stone-500">AgriGlobal Export Aggregation Hub, India</p>
                  <p className="text-stone-500">APEDA Registered Exporter</p>
                </div>
                <div>
                  <p className="font-bold text-stone-700 uppercase text-[10px]">Importer / Consignee</p>
                  <p className="font-bold text-stone-900 text-sm mt-0.5">{invoiceData.buyer?.company || invoiceData.buyer?.name}</p>
                  <p className="text-stone-500">Destination: {invoiceData.shipping?.destinationPort} ({invoiceData.buyer?.country})</p>
                  <p className="text-stone-500">Incoterms: {invoiceData.shipping?.deliveryTerms}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-stone-600">
                <div>Invoice #: <b className="font-mono text-stone-900">{invoiceData.invoiceNumber}</b></div>
                <div>Date: <b>{new Date(invoiceData.date).toLocaleDateString()}</b></div>
                <div>Receipt: <b className="font-mono text-purple-800">{invoiceData.financialSummary?.receiptNumber || 'PAID'}</b></div>
              </div>

              <table className="w-full text-left border">
                <thead className="bg-stone-100 text-stone-700 border-b">
                  <tr>
                    <th className="p-2">Description</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th className="text-right p-2">Amount (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoiceData.lineItems?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-medium">{item.description}</td>
                      <td>{item.quantity} {item.unit}</td>
                      <td>₹{item.unitPriceInr}</td>
                      <td className="text-right p-2 font-bold">₹{item.totalInr?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="bg-stone-50 p-3 rounded space-y-1">
                <div className="flex justify-between">
                  <span>Gross Export Total:</span>
                  <b>₹{invoiceData.financialSummary?.grossTotalInr?.toLocaleString()}</b>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>Platform Facilitation & QC Fee (5%):</span>
                  <span>₹{invoiceData.financialSummary?.platformCommissionInr?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>Export Tax / IGST (Zero-Rated for Export):</span>
                  <span>₹0.00</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-black text-sm text-leaf-800">
                  <span>Total Amount Paid:</span>
                  <span>₹{invoiceData.financialSummary?.grossTotalInr?.toLocaleString()}</span>
                </div>
              </div>

              <div className="text-[10px] text-stone-400 text-center pt-2">
                This is a computer-generated commercial export invoice issued via AgriGlobal Marketplace Platform.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REFUND MODAL (ADMIN) */}
      {showRefundModal && refundPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md bg-white shadow-2xl">
            <h3 className="font-bold text-stone-900 text-sm mb-3">Process Payment Refund</h3>
            <form onSubmit={handleProcessRefund} className="space-y-3 text-xs">
              <div>
                <span className="text-stone-500">Payment ID:</span>
                <span className="font-mono font-bold ml-2">{refundPayment.paymentId}</span>
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Refund Amount (INR)</label>
                <input type="number" className="input w-full" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} required />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Reason for Refund</label>
                <textarea rows="3" className="input w-full" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} required />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" className="btn-outline" onClick={() => setShowRefundModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary bg-red-600 hover:bg-red-700 text-white" disabled={submitting}>
                  {submitting ? 'Processing...' : 'Authorize Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
