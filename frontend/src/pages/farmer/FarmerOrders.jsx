import { useState, useEffect } from 'react';
import api, { errMsg } from '../../services/api.js';

export default function FarmerOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await api.get('/requirements/farmer/orders');
      setOrders(res.data.orders || []);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleRespond = async (order, action) => {
    setError('');
    setMessage('');
    setActionInProgress(order.contributionId);

    try {
      const res = await api.post(
        `/requirements/farmer/orders/${order.requirementMongoId}/${order.contributionId}/respond`,
        { action }
      );
      setMessage(res.data.message);
      await fetchOrders();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setActionInProgress(null);
    }
  };

  const getOrderStatusBadge = (status) => {
    switch (status) {
      case 'proposed':
        return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Pending Your Confirmation</span>;
      case 'accepted':
        return <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">Accepted & Reserved</span>;
      case 'rejected':
        return <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">Rejected (Released)</span>;
      case 'collected':
        return <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">Produce Collected & Weighed</span>;
      case 'delivered':
        return <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">Delivered to Buyer</span>;
      default:
        return <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">{status}</span>;
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border border-leaf-200 bg-gradient-to-r from-leaf-100 via-stone-50 to-white p-6 shadow-sm">
        <h1 className="text-2xl font-black text-stone-900">📋 My Matched Orders</h1>
        <p className="mt-1 text-sm text-stone-600">
          Buyer requirements automatically matched with your available crop produce. Stock is only reserved when you confirm <strong>ACCEPT</strong>.
        </p>
      </div>

      {message && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">
          ✅ {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">
          Loading your matched orders...
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
          <span className="text-4xl">📦</span>
          <p className="mt-3 text-base font-bold text-stone-800">No Orders Matched Yet</p>
          <p className="mt-1 text-sm text-stone-500">
            When international or bulk buyers create requirements for Ragi, Rice, or Jowar, matched contribution requests will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isProposed = order.status === 'proposed';
            const isActing = actionInProgress === order.contributionId;

            return (
              <div
                key={order.contributionId}
                className={`overflow-hidden rounded-2xl border bg-white p-6 shadow-sm transition ${
                  isProposed ? 'border-amber-300 ring-2 ring-amber-100' : 'border-stone-200'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-stone-400">Order ID: {order.contributionId}</span>
                    <h2 className="text-xl font-black text-stone-900">
                      Produce Requested: {order.proposedQuantityKg.toLocaleString()} kg of {order.cropName}
                    </h2>
                  </div>
                  <div>{getOrderStatusBadge(order.status)}</div>
                </div>

                {/* Requirement Overview */}
                <div className="mt-4 grid grid-cols-1 gap-4 text-xs sm:grid-cols-2 md:grid-cols-4">
                  <div className="rounded-xl bg-stone-50 p-3">
                    <span className="block font-medium text-stone-400">Buyer</span>
                    <span className="mt-0.5 block font-bold text-stone-800">{order.buyerName}</span>
                    <span className="text-stone-500">{order.buyerCompany}</span>
                  </div>

                  <div className="rounded-xl bg-stone-50 p-3">
                    <span className="block font-medium text-stone-400">Target Grade</span>
                    <span className="mt-0.5 block font-bold text-stone-800">{order.requiredGrade}</span>
                    <span className="text-stone-500">{order.qualityRequirements || 'Standard export'}</span>
                  </div>

                  <div className="rounded-xl bg-stone-50 p-3">
                    <span className="block font-medium text-stone-400">Delivery Destination</span>
                    <span className="mt-0.5 block font-bold text-stone-800 truncate">{order.deliveryDestination}</span>
                    <span className="text-stone-500">Total Lot: {order.totalLotSizeKg.toLocaleString()} kg</span>
                  </div>

                  <div className="rounded-xl bg-green-50/70 p-3">
                    <span className="block font-medium text-green-700">Your Available Stock</span>
                    <span className="mt-0.5 block font-black text-green-900 text-sm">
                      {order.farmerStock?.availableStockKg?.toLocaleString()} kg
                    </span>
                    <span className="text-green-600">Reserved: {order.farmerStock?.reservedStockKg?.toLocaleString()} kg</span>
                  </div>
                </div>

                {/* Vehicle & Collection Details if assigned */}
                {order.vehicle && order.vehicle.vehicleType && (
                  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 text-xs text-blue-900">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">🚚 Assigned Collection Vehicle:</span>
                      <span className="rounded-md bg-blue-200/80 px-2 py-0.5 font-bold uppercase">{order.vehicle.currentStatus || 'Assigned'}</span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <div>Vehicle: <strong>{order.vehicle.vehicleType}</strong> ({order.vehicle.registrationNumber})</div>
                      <div>Driver: <strong>{order.vehicle.driverName}</strong> ({order.vehicle.driverPhone})</div>
                      <div>Pickup: <strong>{order.vehicle.scheduledPickupDate ? new Date(order.vehicle.scheduledPickupDate).toLocaleDateString() : 'Scheduled'}</strong></div>
                    </div>
                  </div>
                )}

                {/* Collection QC report if collected */}
                {order.status === 'collected' && (
                  <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50/50 p-3.5 text-xs text-purple-900">
                    <span className="font-bold">⚖️ Weighing & QC Result at Farm:</span>
                    <div className="mt-1 flex flex-wrap gap-4">
                      <span>Actual Weighed: <strong>{order.actualWeighedKg} kg</strong></span>
                      <span>Accepted: <strong className="text-green-700">{order.acceptedQuantityKg} kg</strong></span>
                      {order.rejectedQuantityKg > 0 && <span>Rejected: <strong className="text-red-700">{order.rejectedQuantityKg} kg</strong></span>}
                    </div>
                  </div>
                )}

                {/* Accept / Reject Buttons for Proposed Orders */}
                {isProposed && (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-amber-200/60 pt-4">
                    <div className="text-xs text-stone-600">
                      ⚠️ Confirming will reserve <strong className="text-stone-900">{order.proposedQuantityKg.toLocaleString()} kg</strong> for vehicle pickup. Rejecting will release this quota.
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleRespond(order, 'reject')}
                        disabled={isActing}
                        className="rounded-xl border border-red-300 bg-white px-5 py-2 text-sm font-bold text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-50"
                      >
                        {isActing ? 'Processing...' : '❌ REJECT'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRespond(order, 'accept')}
                        disabled={isActing}
                        className="rounded-xl bg-leaf-700 px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-leaf-800 disabled:opacity-50"
                      >
                        {isActing ? 'Reserving Produce...' : '✅ ACCEPT & RESERVE'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
