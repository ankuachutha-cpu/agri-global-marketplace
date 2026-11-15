import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi.js';
import api, { errMsg } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { Spinner, ErrorBox, Empty, PageHeader, Badge, Notice } from '../components/ui.jsx';
import { CATEGORIES } from '../utils/format.js';

export default function GlobalSellMarketplace() {
  const { user } = useAuth();
  const { fmt } = useCurrency();

  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCrop, setSelectedCrop] = useState(null);
  const [offerModalCrop, setOfferModalCrop] = useState(null);
  const [offerForm, setOfferForm] = useState({
    offerPriceInr: '',
    minOrderQuantityKg: '100',
    packagingType: 'Corrugated Export Boxes (10kg)',
    grade: 'A'
  });
  const [offerSaving, setOfferSaving] = useState(false);
  const [offerSuccess, setOfferSuccess] = useState('');
  const [offerError, setOfferError] = useState('');

  // Fetch dynamic crops
  const params = {
    ...(category && { category }),
    ...(search && { q: search })
  };
  const { data, loading, error, reload } = useApi('/crops/marketplace/dynamic-crops', params);

  // Fetch farmer's own crops if logged in as farmer (to allow sell offer linking)
  const { data: myCropsData } = useApi(user?.role === 'farmer' ? '/crops/mine' : null);

  // Fetch individual listings when a crop is selected
  const { data: listingsData, loading: listingsLoading } = useApi(
    selectedCrop ? `/crops/marketplace/listings?crop=${encodeURIComponent(selectedCrop.cropName)}` : null
  );

  const handleOpenOfferModal = (crop) => {
    setOfferModalCrop(crop);
    setOfferSuccess('');
    setOfferError('');
    setOfferForm({
      offerPriceInr: crop.avgPriceInr || crop.minPriceInr || '',
      minOrderQuantityKg: '500',
      packagingType: 'Standard Export Reefer Packaging',
      grade: crop.gradesAvailable?.[0] || 'A'
    });
  };

  const handleSaveSellOffer = async (e) => {
    e.preventDefault();
    if (!offerModalCrop) return;
    setOfferSaving(true);
    setOfferError('');
    setOfferSuccess('');

    try {
      // Find matching farmer crop
      const matching = myCropsData?.items?.find(
        (c) => c.name.toLowerCase().includes(offerModalCrop.cropName.toLowerCase()) ||
               offerModalCrop.cropName.toLowerCase().includes(c.name.toLowerCase())
      );

      if (!matching) {
        throw new Error(`You do not currently have an active listing for "${offerModalCrop.cropName}". Please add this crop to your farm inventory first under "My Crops".`);
      }

      await api.post(`/crops/${matching._id}/sell-offer`, {
        offerPriceInr: Number(offerForm.offerPriceInr),
        minOrderQuantityKg: Number(offerForm.minOrderQuantityKg),
        packagingType: offerForm.packagingType,
        grade: offerForm.grade,
        offerStatus: 'active'
      });

      setOfferSuccess(`Sell offer successfully activated for ${offerModalCrop.cropName}! International buyers can now discover your lot.`);
      setTimeout(() => {
        setOfferModalCrop(null);
        reload();
      }, 1600);
    } catch (err) {
      setOfferError(errMsg(err));
    } finally {
      setOfferSaving(false);
    }
  };

  const totalCropsCount = data?.totalDistinctCrops || 0;
  const cropsList = data?.crops || [];
  const totalVolumeKg = cropsList.reduce((acc, c) => acc + (c.totalQuantityKg || 0), 0);
  const totalFreeStockKg = cropsList.reduce((acc, c) => acc + (c.freeStockKg || 0), 0);
  const totalFarmers = new Set(cropsList.flatMap((c) => c.originStates || [])).size;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global Crop Sell Marketplace"
        subtitle="Dynamic AI-powered international agricultural catalogue. Discover live produce available across India with verified grades, free stock, and export pricing."
      >
        <div className="flex flex-wrap gap-2">
          <Link to="/farmer/demand-board" className="btn-primary">
            📋 View Live Buyer Demands
          </Link>
          {user?.role === 'farmer' && (
            <Link to="/farmer/crops/new" className="btn-outline">
              ➕ Add New Crop
            </Link>
          )}
        </div>
      </PageHeader>

      {/* KPI Overview */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card border-l-4 border-l-leaf-600">
          <p className="text-xs font-semibold text-stone-500 uppercase">Distinct Crops Available</p>
          <p className="text-2xl font-bold text-stone-800">{totalCropsCount}</p>
          <p className="text-xs text-stone-500 mt-1">Discovered dynamically from MongoDB</p>
        </div>
        <div className="card border-l-4 border-l-blue-600">
          <p className="text-xs font-semibold text-stone-500 uppercase">Total Available Produce</p>
          <p className="text-2xl font-bold text-blue-700">
            {Math.round(totalVolumeKg / 1000).toLocaleString()} <span className="text-sm font-normal text-stone-600">MT</span>
          </p>
          <p className="text-xs text-stone-500 mt-1">{totalVolumeKg.toLocaleString()} kg total volume</p>
        </div>
        <div className="card border-l-4 border-l-emerald-600">
          <p className="text-xs font-semibold text-stone-500 uppercase">Unallocated Free Stock</p>
          <p className="text-2xl font-bold text-emerald-700">
            {Math.round(totalFreeStockKg / 1000).toLocaleString()} <span className="text-sm font-normal text-stone-600">MT</span>
          </p>
          <p className="text-xs text-stone-500 mt-1">Ready for immediate export commitment</p>
        </div>
        <div className="card border-l-4 border-l-amber-600">
          <p className="text-xs font-semibold text-stone-500 uppercase">Origin States & Regions</p>
          <p className="text-2xl font-bold text-amber-700">{totalFarmers}</p>
          <p className="text-xs text-stone-500 mt-1">Sourced from certified farming clusters</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="search">
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-stone-600">Search Crop, Variety, or Keyword</label>
          <input
            type="text"
            className="input w-full"
            placeholder="e.g. Tomato, Mango, Basmati Rice, Onion..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Category Filter</label>
          <select
            className="input w-full"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            className="btn-outline w-full"
            onClick={() => { setSearch(''); setCategory(''); }}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* AI Market Insight Notice */}
      <Notice>
        💡 <b>AI Demand Matcher Active:</b> Current international buyers are actively procuring Grade A produce for UAE, Saudi Arabia, and Europe. Check the <b>Live Demand Board</b> to contribute produce towards guaranteed purchase orders.
      </Notice>

      {/* Dynamic Crops Grid */}
      {loading ? (
        <Spinner label="Scanning database for distinct crops..." />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : cropsList.length === 0 ? (
        <Empty
          title="No crops matching your search criteria"
          hint="Try adjusting keywords or selecting 'All Categories'."
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cropsList.map((crop) => {
            const freePercent = crop.totalQuantityKg > 0
              ? Math.round((crop.freeStockKg / crop.totalQuantityKg) * 100)
              : 0;

            return (
              <article
                key={crop.cropName}
                className="card flex flex-col justify-between hover:shadow-md transition-shadow border-stone-200"
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h2 className="text-xl font-bold text-stone-900 capitalize">{crop.cropName}</h2>
                      <span className="text-xs text-stone-500 font-medium">{crop.category}</span>
                    </div>
                    <Badge>{crop.exportSuitability?.includes('High') ? 'Grade A Export' : 'Standard Export'}</Badge>
                  </div>

                  {/* Image Preview */}
                  {crop.images?.length > 0 && (
                    <div className="mb-3 h-36 w-full overflow-hidden rounded-lg bg-stone-100">
                      <img
                        src={crop.images[0]}
                        alt={crop.cropName}
                        className="h-full w-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  )}

                  {/* Stock Progress & Allocation */}
                  <div className="space-y-1 mb-3 bg-stone-50 p-2.5 rounded-lg border border-stone-100">
                    <div className="flex justify-between text-xs">
                      <span className="text-stone-600 font-medium">Free Available Stock:</span>
                      <span className="font-bold text-emerald-700">
                        {crop.freeStockKg.toLocaleString()} kg ({crop.freeStockMt} MT)
                      </span>
                    </div>
                    <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${freePercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-stone-500 pt-0.5">
                      <span>Total: {crop.totalQuantityKg.toLocaleString()} kg</span>
                      <span>Reserved: {crop.allocatedQuantityKg.toLocaleString()} kg</span>
                    </div>
                  </div>

                  {/* Pricing & Grades */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="p-2 rounded bg-leaf-50 border border-leaf-100">
                      <p className="text-leaf-800 font-medium">Indicative Price</p>
                      <p className="text-sm font-bold text-leaf-900 mt-0.5">
                        {fmt(crop.avgPriceInr)} / kg
                      </p>
                      <p className="text-[10px] text-stone-500">
                        Range: {fmt(crop.minPriceInr)} - {fmt(crop.maxPriceInr)}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-stone-100 border border-stone-200">
                      <p className="text-stone-700 font-medium">Grades Available</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {crop.gradesAvailable?.map((g) => (
                          <span key={g} className="px-1.5 py-0.5 rounded bg-white text-[10px] font-bold text-stone-800 border border-stone-300">
                            Grade {g}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Origin States & Listings Count */}
                  <div className="space-y-1 text-xs text-stone-600 mb-4">
                    <p>
                      <b>Origin States:</b> {crop.originStates?.slice(0, 3).join(', ') || 'India'}
                      {crop.originStates?.length > 3 && ` +${crop.originStates.length - 3} more`}
                    </p>
                    <p>
                      <b>Active Farmer Lots:</b> {crop.listingsCount} lots across {crop.uniqueFarmersCount} farmer(s)
                    </p>
                    {crop.organicCertified && (
                      <p className="text-emerald-700 font-medium">
                        🌿 Organic Certified Lots Available
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t border-stone-100 pt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-outline flex-1 text-xs py-2 text-center"
                    onClick={() => setSelectedCrop(crop)}
                  >
                    🔍 View {crop.listingsCount} Farmer Lot{crop.listingsCount === 1 ? '' : 's'}
                  </button>
                  {user?.role === 'farmer' && (
                    <button
                      type="button"
                      className="btn-primary flex-1 text-xs py-2 text-center"
                      onClick={() => handleOpenOfferModal(crop)}
                    >
                      🏷️ Add Sell Offer
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Individual Farmer Lots Modal */}
      {selectedCrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <h3 className="text-lg font-bold text-stone-900">
                  Farmer Lots for {selectedCrop.cropName}
                </h3>
                <p className="text-xs text-stone-500">
                  {selectedCrop.freeStockKg.toLocaleString()} kg free stock currently available
                </p>
              </div>
              <button
                className="btn-outline text-xs px-2 py-1"
                onClick={() => setSelectedCrop(null)}
              >
                ✕ Close
              </button>
            </div>

            {listingsLoading ? (
              <Spinner label="Loading individual farm lots..." />
            ) : listingsData?.items?.length === 0 ? (
              <p className="text-stone-500 text-sm py-4 text-center">
                No individual farm lots found for this crop.
              </p>
            ) : (
              <div className="space-y-3">
                {listingsData?.items?.map((item) => (
                  <div
                    key={item._id}
                    className="p-3 rounded-lg border border-stone-200 bg-stone-50 space-y-2 text-xs"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-stone-800 text-sm">
                          {item.name} {item.variety ? `(${item.variety})` : ''}
                        </p>
                        <p className="text-stone-500">
                          📍 {item.location || item.state}, India · Farmer: {item.farmer?.name || 'Verified Farmer'}
                        </p>
                      </div>
                      <Badge>{item.grade ? `Grade ${item.grade}` : 'Ungraded'}</Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1 bg-white p-2 rounded border border-stone-100">
                      <div>
                        <span className="text-stone-500">Available:</span>{' '}
                        <b>{item.freeStockKg?.toLocaleString() || item.quantity} kg</b>
                      </div>
                      <div>
                        <span className="text-stone-500">Price:</span>{' '}
                        <b className="text-leaf-800">{fmt(item.priceInr)} / kg</b>
                      </div>
                      <div>
                        <span className="text-stone-500">Harvest:</span>{' '}
                        <b>{item.harvestDate ? new Date(item.harvestDate).toLocaleDateString() : 'Fresh'}</b>
                      </div>
                    </div>

                    {item.offerStatus === 'active' && item.offerPriceInr && (
                      <div className="p-1.5 rounded bg-amber-50 border border-amber-200 text-amber-900">
                        🏷️ <b>Active Export Sell Offer:</b> {fmt(item.offerPriceInr)}/kg · Min Order: {item.minOrderQuantityKg || 100} kg · {item.packagingType || 'Export boxes'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Farmer Sell Offer Modal */}
      {offerModalCrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-lg font-bold text-stone-900">
                Activate Export Sell Offer for {offerModalCrop.cropName}
              </h3>
              <button
                className="btn-outline text-xs px-2 py-1"
                onClick={() => setOfferModalCrop(null)}
              >
                ✕ Close
              </button>
            </div>

            {offerSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
                ✓ {offerSuccess}
              </div>
            )}
            {offerError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
                ⚠ {offerError}
              </div>
            )}

            <form onSubmit={handleSaveSellOffer} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Target Export Offer Price (₹ per kg) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  className="input w-full"
                  value={offerForm.offerPriceInr}
                  onChange={(e) => setOfferForm({ ...offerForm, offerPriceInr: e.target.value })}
                  placeholder="e.g. 45"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Minimum Order Quantity (kg)
                </label>
                <input
                  type="number"
                  min="10"
                  className="input w-full"
                  value={offerForm.minOrderQuantityKg}
                  onChange={(e) => setOfferForm({ ...offerForm, minOrderQuantityKg: e.target.value })}
                  placeholder="e.g. 500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Export Quality Grade
                </label>
                <select
                  className="input w-full"
                  value={offerForm.grade}
                  onChange={(e) => setOfferForm({ ...offerForm, grade: e.target.value })}
                >
                  <option value="A">Grade A (Premium Export Quality)</option>
                  <option value="B">Grade B (Commercial Grade)</option>
                  <option value="C">Grade C (Processing Grade)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Packaging Specifications
                </label>
                <input
                  type="text"
                  className="input w-full"
                  value={offerForm.packagingType}
                  onChange={(e) => setOfferForm({ ...offerForm, packagingType: e.target.value })}
                  placeholder="e.g. 10kg Corrugated Boxes, Plastic Crates"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={offerSaving}
                  className="btn-primary flex-1"
                >
                  {offerSaving ? 'Activating Offer...' : 'Confirm & Publish Sell Offer'}
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setOfferModalCrop(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
