import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner, ErrorBox, PageHeader } from '../components/ui.jsx';
import AdminDashboard from './Admin.jsx';
import BuyerPortal from './BuyerPortal.jsx';

const Stat = ({ label, value, subtext, color = 'text-leaf-700' }) => (
  <div className="card text-center">
    <p className={`text-3xl font-extrabold ${color}`}>{value}</p>
    <p className="text-xs font-semibold text-stone-700 mt-1">{label}</p>
    {subtext && <p className="text-[11px] text-stone-400 mt-0.5">{subtext}</p>}
  </div>
);

const Tile = ({ to, children, badge }) => (
  <Link to={to} className="card font-medium hover:shadow-md flex items-center justify-between group transition">
    <span className="group-hover:text-leaf-700">{children}</span>
    {badge && (
      <span className="rounded-full bg-leaf-100 px-2 py-0.5 text-xs font-bold text-leaf-800">
        {badge}
      </span>
    )}
  </Link>
);

function FarmerDash() {
  const { user } = useAuth();
  const crops = useApi('/crops/mine');
  const orders = useApi('/orders');
  const lots = useApi('/aggregation/farmer/contributions');
  const collections = useApi('/collections/farmer');

  if (crops.loading || orders.loading) return <Spinner />;
  if (crops.error || orders.error) return <ErrorBox message={crops.error || orders.error} />;

  const pendingOrders = orders.data?.items?.filter((o) => o.status === 'Pending').length || 0;
  const myLotCount = lots.data?.lots?.length || 0;
  const colData = collections.data || {};
  const activePickups = (colData.collections || []).filter((c) =>
    ['scheduled', 'in_transit', 'inspected_at_farm', 'delivered_to_hub'].includes(c.status)
  ).length;

  const totalCropKg = (crops.data?.items || []).reduce((acc, c) => {
    const factor = c.unit === 'tonne' ? 1000 : c.unit === 'quintal' ? 100 : 1;
    return acc + (c.quantity || 0) * factor;
  }, 0);

  const farmCoords = user?.farmLocation?.latitude && user?.farmLocation?.longitude
    ? `${user.farmLocation.latitude}, ${user.farmLocation.longitude}`
    : user?.farmLocation?.coordinates?.latitude && user?.farmLocation?.coordinates?.longitude
      ? `${user.farmLocation.coordinates.latitude}, ${user.farmLocation.coordinates.longitude}`
      : null;

  return (
    <div className="space-y-6">
      {/* 4 Primary KPI Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="My Active Crops"
          value={crops.data.items.length}
          subtext={`Total: ${totalCropKg.toLocaleString()} kg`}
        />
        <Stat
          label="In Bulk Export Lots"
          value={myLotCount}
          subtext="Pooled for international buyers"
          color="text-purple-700"
        />
        <Stat
          label="Verified Produce"
          value={`${colData.totalAcceptedKg || 0} kg`}
          subtext={`${activePickups} active pickup${activePickups === 1 ? '' : 's'}`}
          color="text-blue-700"
        />
        <Stat
          label="Settled Earnings"
          value={`₹${(colData.receivedEarningsInr || 0).toLocaleString()}`}
          subtext={`Pending: ₹${(colData.pendingPayoutInr || 0).toLocaleString()}`}
          color="text-emerald-700"
        />
      </div>

      {/* Farm Location & GPS Banner */}
      <div className="card bg-stone-50 border-leaf-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-leaf-100 text-xl">
            📍
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-800">
              Farm Location & Gate Geotag: {user?.farmLocation?.address || user?.city || 'Location on profile'}
            </h3>
            <p className="text-xs text-stone-500">
              {farmCoords ? (
                <span className="text-emerald-700 font-medium">🛰️ GPS Verified: {farmCoords}</span>
              ) : (
                <span className="text-amber-700 font-medium">⚠️ GPS coordinates not captured yet</span>
              )}
              {user?.district ? ` · District: ${user.district}` : ''}
              {user?.state ? ` · State: ${user.state}` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/finance" className="btn-outline text-xs">
            🏦 Payouts & UPI
          </Link>
          <Link to="/farmer/collections" className="btn-outline text-xs">
            Manage Pickups
          </Link>
          <Link to="/farmer/crops/new" className="btn-primary text-xs">
            + List New Crop
          </Link>
        </div>
      </div>

      {/* Recent Collections Strip */}
      {colData.collections?.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between border-b pb-2 mb-3">
            <h3 className="text-sm font-bold text-stone-800 flex items-center gap-2">
              🚚 Recent Harvest Collections & Inspection Status
            </h3>
            <Link to="/farmer/collections" className="text-xs font-semibold text-leaf-700 hover:underline">
              View All ({colData.collections.length}) →
            </Link>
          </div>
          <div className="divide-y divide-stone-100">
            {colData.collections.slice(0, 3).map((c) => (
              <div key={c._id} className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-stone-800">{c.collectionId}</span>
                  <span className="text-stone-500"> · {c.cropName} (Grade {c.grade || 'A'})</span>
                  <div className="text-[11px] text-stone-400">
                    Pickup: {new Date(c.scheduledDate).toLocaleDateString()} · {c.pickupAddress}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-stone-700">
                    {c.acceptedQuantityKg !== null ? `${c.acceptedQuantityKg} kg accepted` : `${c.estimatedQuantityKg} kg scheduled`}
                  </span>
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 font-semibold text-stone-700 capitalize">
                    {c.status.replace(/_/g, ' ')}
                  </span>
                  <span className={`font-semibold ${c.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-amber-700'}`}>
                    ₹{(c.totalFinalPayoutInr ?? c.totalEstimatedPayoutInr)?.toLocaleString()} ({c.paymentStatus})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Quick Action Tiles */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
          Farmer Management Portal
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Tile to="/farmer/crops/new">➕ Add a Crop Listing</Tile>
          <Tile to="/farmer/crops" badge={`${crops.data.items.length} listed`}>🌾 Manage My Crops</Tile>
          <Tile to="/aggregation" badge={`${myLotCount} lots`}>📦 Crop Aggregation Lots</Tile>
          <Tile to="/farmer/collections" badge={`${activePickups} active`}>🚚 Collections & Payouts</Tile>
          <Tile to="/orders" badge={pendingOrders ? `${pendingOrders} pending` : ''}>📦 Incoming Buyer Orders</Tile>
          <Tile to="/ai/price">📈 AI Price Prediction</Tile>
          <Tile to="/ai/recommend">🌱 AI Crop Recommendation</Tile>
          <Tile to="/buyer-finder">🌍 Find International Buyers</Tile>
          <Tile to="/exporters">🏭 Indian Exporters Directory</Tile>
          <Tile to="/export-guidance">📘 International Export Guidance</Tile>
          <Tile to="/collection-centers">📍 Regional Collection Hubs</Tile>
        </div>
      </div>
    </div>
  );
}

function BuyerDash() {
  return <BuyerPortal />;
}

export default function Dashboard() {
  const { user } = useAuth();
  if (user.role === 'admin') return <AdminDashboard />;
  return (
    <div>
      <PageHeader
        title={`${user.role === 'farmer' ? 'Farmer' : 'Buyer'} dashboard`}
        subtitle={`Welcome, ${user.name}`}
      />
      {user.role === 'farmer' ? <FarmerDash /> : <BuyerDash />}
    </div>
  );
}
