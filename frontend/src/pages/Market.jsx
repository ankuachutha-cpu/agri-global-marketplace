import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errMsg, imgUrl } from '../services/api.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { useToast } from '../components/Toast.jsx';
import CropCard from '../components/CropCard.jsx';
import { Spinner, ErrorBox, Empty, PageHeader, Field, Notice } from '../components/ui.jsx';
import { CATEGORIES } from '../utils/format.js';
import { validateCrop } from '../utils/validate.js';

export function Marketplace() {
  const [filters, setFilters] = useState({ q: '', category: '', state: '', minPrice: '', maxPrice: '' });
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState({});
  const params = { ...Object.fromEntries(Object.entries(applied).filter(([, v]) => v !== '')), page, limit: 12 };
  const { data, loading, error, reload } = useApi('/crops', params);
  const { rateNote } = useCurrency();
  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });
  const submit = (e) => { e.preventDefault(); setPage(1); setApplied(filters); };
  const reset = () => { const z = { q: '', category: '', state: '', minPrice: '', maxPrice: '' }; setFilters(z); setApplied(z); setPage(1); };
  return (
    <div>
      <PageHeader title="Marketplace" subtitle="Fresh produce listed directly by Indian farmers" />
      <form onSubmit={submit} className="card mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6" role="search">
        <input aria-label="Search crops" placeholder="Search crops..." className="input lg:col-span-2" value={filters.q} onChange={set('q')} />
        <select aria-label="Category" className="input" value={filters.category} onChange={set('category')}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <input aria-label="State" placeholder="State" className="input" value={filters.state} onChange={set('state')} />
        <input aria-label="Min price (INR)" type="number" min="0" placeholder="Min ₹" className="input" value={filters.minPrice} onChange={set('minPrice')} />
        <input aria-label="Max price (INR)" type="number" min="0" placeholder="Max ₹" className="input" value={filters.maxPrice} onChange={set('maxPrice')} />
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6"><button className="btn-primary">Search</button><button type="button" className="btn-outline" onClick={reset}>Reset</button></div>
      </form>
      {rateNote && <p className="mb-3 text-xs text-stone-500">{rateNote}</p>}
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.items.length ? <Empty title="No crops found" hint="Try changing your search or filters." /> : (
        <>
          <p className="mb-2 text-sm text-stone-500">{data.total} result{data.total === 1 ? '' : 's'}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{data.items.map((c) => <CropCard key={c._id} crop={c} />)}</div>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button className="btn-outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span className="text-sm">Page {data.page} of {Math.max(data.pages, 1)}</span>
            <button className="btn-outline" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </>
      )}
    </div>
  );
}

export function CropDetails() {
  const { id } = useParams(); const { data, loading, error, reload } = useApi(`/crops/${id}`);
  const { user } = useAuth(); const { format, rateNote } = useCurrency(); const { toast } = useToast(); const nav = useNavigate();
  const [qty, setQty] = useState(1); const [busy, setBusy] = useState(false);
  if (loading) return <Spinner />; if (error) return <ErrorBox message={error} onRetry={reload} />;
  const c = data.crop; const p = format(c.priceInr);
  const qtyOk = Number(qty) > 0 && Number(qty) <= c.quantity;
  const addToCart = async () => {
    setBusy(true);
    try { await api.put('/cart/items', { cropId: c._id, quantity: Number(qty) }); toast('Added to cart'); nav('/cart'); }
    catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };
  const addToWatchlist = async () => {
    try { await api.post('/buyer/watchlist', { cropId: c._id }); toast('Added to your watchlist'); }
    catch (e) { toast(errMsg(e), 'error'); }
  };
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-2">
        <div className="flex h-72 items-center justify-center overflow-hidden rounded-xl bg-leaf-50 text-7xl">{c.images?.[0] ? <img src={imgUrl(c.images[0])} alt={c.name} className="h-full w-full object-cover" /> : '🌱'}</div>
        {c.images?.length > 1 && <div className="flex gap-2">{c.images.slice(1).map((i) => <img key={i} src={imgUrl(i)} alt="" className="h-20 w-20 rounded-lg object-cover" />)}</div>}
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{c.name}</h1>
          {c.organicCertified && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">🌿 Organic Certified</span>}
        </div>
        <p className="text-sm text-stone-500">{c.category} · Grade {c.grade || 'Ungraded'}{c.variety ? ` · Variety: ${c.variety}` : ''}</p>
        <p className="mt-3 text-3xl font-bold text-leaf-700">{p.text}<span className="text-sm font-normal text-stone-500"> / {c.unit}</span></p>
        {p.converted && <p className="text-xs text-stone-500">Original: ₹{c.priceInr} / {c.unit}. {rateNote}</p>}
        
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm border-t border-b border-stone-200 py-3">
          <dt className="text-stone-500">Available Stock</dt><dd className="font-semibold">{c.quantity} {c.unit}</dd>
          <dt className="text-stone-500">Location</dt><dd>{c.location}{c.state ? `, ${c.state}` : ''}, {c.country}</dd>
          {c.farmAddress && <><dt className="text-stone-500">Farm Address</dt><dd>{c.farmAddress}</dd></>}
          {c.coordinates?.latitude && c.coordinates?.longitude && (
            <><dt className="text-stone-500">GPS Coordinates</dt><dd className="font-mono text-xs text-emerald-700">🛰️ {c.coordinates.latitude}, {c.coordinates.longitude}</dd></>
          )}
          {c.harvestDate && <><dt className="text-stone-500">Harvest Date</dt><dd>{new Date(c.harvestDate).toLocaleDateString()}</dd></>}
          {c.moisturePercent !== undefined && c.moisturePercent !== null && <><dt className="text-stone-500">Moisture Content</dt><dd>{c.moisturePercent}%</dd></>}
          {c.grainOrFruitSize && <><dt className="text-stone-500">Size / Caliber</dt><dd>{c.grainOrFruitSize}</dd></>}
          {c.color && <><dt className="text-stone-500">Appearance / Color</dt><dd>{c.color}</dd></>}
          {c.packagingType && <><dt className="text-stone-500">Packaging Type</dt><dd>{c.packagingType}</dd></>}
          {c.shelfLifeDays && <><dt className="text-stone-500">Expected Shelf Life</dt><dd>{c.shelfLifeDays} days</dd></>}
          <dt className="text-stone-500">Farmer</dt><dd>{c.farmer?.name}{c.farmer?.city ? ` (${c.farmer.city})` : ''}</dd>
        </dl>
        
        {c.description && <p className="mt-4 text-sm text-stone-700">{c.description}</p>}
        <div className="mt-6">
          {!user ? <Link to="/login" state={{ from: `/crops/${c._id}` }} className="btn-primary">Login to order</Link>
            : user.role === 'buyer' ? (<div className="flex flex-wrap items-end gap-3"><Field label={`Quantity (${c.unit})`} id="qty"><input id="qty" type="number" min="0" step="any" className="input w-32" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
              <button className="btn-primary mb-3" disabled={!qtyOk || busy} onClick={addToCart}>Add to cart</button>
              <button type="button" className="btn-outline mb-3" onClick={addToWatchlist}>⭐ Watchlist</button>
              <Link to="/buyer/portal" className="btn-outline mb-3">📝 Post RFQ</Link>
              {!qtyOk && <p role="alert" className="mb-3 text-xs text-red-600">Enter 0 &lt; qty ≤ {c.quantity}</p>}</div>)
              : user.role === 'farmer' && String(c.farmer?._id) === String(user._id) ? (
                <div className="flex flex-wrap gap-2">
                  <Link to={`/global-buyers?crop=${encodeURIComponent(c.name)}&cropId=${c._id}`} className="btn-primary">Find International Buyers</Link>
                  <Link to={`/farmer/crops/${c._id}/edit`} className="btn-outline">Edit listing</Link>
                  <Link to="/farmer/collections" className="btn-outline">📦 Schedule Collection</Link>
                </div>
              ) : <p className="text-sm text-stone-500">Only buyers can order.</p>}
        </div>
      </div>
    </div>
  );
}

const EMPTY = {
  name: '',
  category: 'Vegetables',
  description: '',
  quantity: '',
  unit: 'kg',
  priceInr: '',
  location: '',
  state: '',
  country: 'India',
  harvestDate: '',
  grade: 'Ungraded',
  status: 'available',
  farmAddress: '',
  pincode: '',
  latitude: '',
  longitude: '',
  variety: '',
  moisturePercent: '',
  grainOrFruitSize: '',
  color: '',
  organicCertified: false,
  packagingType: 'Crates',
  shelfLifeDays: ''
};

export function CropForm() {
  const { id } = useParams(); const edit = !!id; const nav = useNavigate(); const { toast } = useToast();
  const existing = useApi(edit ? `/crops/${id}` : null);
  const [f, setF] = useState(EMPTY);
  const [files, setFiles] = useState([]);
  const [keep, setKeep] = useState([]);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);

  useEffect(() => {
    const c = existing.data?.crop;
    if (c) {
      setF({
        ...EMPTY,
        ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, c[k] ?? EMPTY[k]])),
        latitude: c.coordinates?.latitude ?? c.latitude ?? '',
        longitude: c.coordinates?.longitude ?? c.longitude ?? '',
        organicCertified: !!c.organicCertified,
        harvestDate: c.harvestDate ? c.harvestDate.slice(0, 10) : ''
      });
      setKeep(c.images || []);
    }
  }, [existing.data]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const detectGps = () => {
    if (!navigator.geolocation) {
      toast('Geolocation is not supported by your browser', 'error');
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingGps(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setF((prev) => ({ ...prev, latitude: lat, longitude: lng }));
        toast(`GPS detected: ${lat}, ${lng}`);
      },
      (err) => {
        setLocatingGps(false);
        toast(`GPS detection failed: ${err.message}`, 'error');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const pickFiles = (e) => {
    const list = [...e.target.files];
    const bad = list.find((x) => !['image/jpeg', 'image/png', 'image/webp'].includes(x.type) || x.size > 3 * 1024 * 1024);
    if (bad) { toast('Images must be JPEG, PNG or WebP and under 3 MB', 'error'); e.target.value = ''; return; }
    if (list.length + keep.length > 5) { toast('Maximum 5 images per crop', 'error'); e.target.value = ''; return; }
    setFiles(list);
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = validateCrop(f);
    setErrs(v);
    if (Object.keys(v).length) return;

    const fd = new FormData();
    Object.entries(f).forEach(([k, val]) => {
      if (val !== '' && val !== null && val !== undefined) {
        fd.append(k, val);
      }
    });
    if (edit) fd.append('keepImages', keep.join(','));
    files.forEach((x) => fd.append('images', x));
    setBusy(true);
    try {
      if (edit) await api.put(`/crops/${id}`, fd);
      else await api.post('/crops', fd);
      toast(edit ? 'Crop updated' : 'Crop added');
      nav('/farmer/crops');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (edit && existing.loading) return <Spinner />;
  if (edit && existing.error) return <ErrorBox message={existing.error} />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={edit ? 'Edit crop listing' : 'List new crop for aggregation & export'}
        subtitle="Provide accurate quality specifications and GPS coordinates to facilitate automatic container pooling and collection."
      />
      <form onSubmit={submit} noValidate className="card space-y-6">
        {/* Section 1: Basic Information */}
        <div>
          <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wide border-b pb-1 mb-3">
            1. Crop Details & Pricing
          </h3>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Field label="Crop Name" id="name" error={errs.name}>
              <input id="name" placeholder="e.g. Tomatoes" className="input" value={f.name} onChange={set('name')} />
            </Field>
            <Field label="Category" id="category" error={errs.category}>
              <select id="category" className="input" value={f.category} onChange={set('category')}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Variety / Cultivar" id="variety">
              <input id="variety" placeholder="e.g. Roma Hybrid, Sona Masoori" className="input" value={f.variety} onChange={set('variety')} />
            </Field>
            <Field label="Quality Grade" id="grade">
              <select id="grade" className="input" value={f.grade} onChange={set('grade')}>
                {['A', 'B', 'C', 'Ungraded'].map((g) => <option key={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Quantity" id="quantity" error={errs.quantity}>
              <input id="quantity" type="number" min="0" step="any" className="input" value={f.quantity} onChange={set('quantity')} />
            </Field>
            <Field label="Unit" id="unit">
              <select id="unit" className="input" value={f.unit} onChange={set('unit')}>
                <option>kg</option><option>quintal</option><option>tonne</option>
              </select>
            </Field>
            <Field label="Expected Price per Unit (INR)" id="priceInr" error={errs.priceInr}>
              <input id="priceInr" type="number" min="0" step="any" className="input" value={f.priceInr} onChange={set('priceInr')} />
            </Field>
            <Field label="Harvest Date" id="harvestDate">
              <input id="harvestDate" type="date" className="input" value={f.harvestDate} onChange={set('harvestDate')} />
            </Field>
          </div>
        </div>

        {/* Section 2: Quality & Export Specifications */}
        <div>
          <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wide border-b pb-1 mb-3">
            2. Export Quality Specifications
          </h3>
          <div className="grid gap-x-3 sm:grid-cols-3">
            <Field label="Moisture Content (%)" id="moisturePercent">
              <input
                id="moisturePercent"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="e.g. 12.5"
                className="input"
                value={f.moisturePercent}
                onChange={set('moisturePercent')}
              />
            </Field>
            <Field label="Fruit / Grain Size" id="grainOrFruitSize">
              <input
                id="grainOrFruitSize"
                placeholder="e.g. Medium, 50-60mm"
                className="input"
                value={f.grainOrFruitSize}
                onChange={set('grainOrFruitSize')}
              />
            </Field>
            <Field label="Color / Appearance" id="color">
              <input
                id="color"
                placeholder="e.g. Deep Red, Golden"
                className="input"
                value={f.color}
                onChange={set('color')}
              />
            </Field>
            <Field label="Packaging Type" id="packagingType">
              <select id="packagingType" className="input" value={f.packagingType} onChange={set('packagingType')}>
                {['Crates', 'Jute Bags', 'Corrugated Boxes', 'HDPE Sacks', 'Bulk / Loose'].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Expected Shelf Life (Days)" id="shelfLifeDays">
              <input
                id="shelfLifeDays"
                type="number"
                min="1"
                max="365"
                placeholder="e.g. 14"
                className="input"
                value={f.shelfLifeDays}
                onChange={set('shelfLifeDays')}
              />
            </Field>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-stone-700">
                <input
                  type="checkbox"
                  className="rounded border-stone-300 text-leaf-600 focus:ring-leaf-500 h-4 w-4"
                  checked={f.organicCertified}
                  onChange={set('organicCertified')}
                />
                <span>🌿 Organic Certified Produce</span>
              </label>
            </div>
          </div>
        </div>

        {/* Section 3: Farm Location & GPS */}
        <div>
          <div className="flex items-center justify-between border-b pb-1 mb-3">
            <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wide">
              3. Farm Location & GPS Geotagging
            </h3>
            <button
              type="button"
              className="btn-outline text-xs px-2.5 py-1"
              disabled={locatingGps}
              onClick={detectGps}
            >
              {locatingGps ? 'Locating...' : '🛰️ Detect Current GPS'}
            </button>
          </div>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Field label="Location (village/city)" id="location" error={errs.location}>
              <input id="location" placeholder="e.g. Kolar" className="input" value={f.location} onChange={set('location')} />
            </Field>
            <Field label="State" id="state">
              <input id="state" placeholder="e.g. Karnataka" className="input" value={f.state} onChange={set('state')} />
            </Field>
            <Field label="Farm Address / Plot / Survey No." id="farmAddress">
              <input id="farmAddress" placeholder="e.g. Green Valley Plot 4" className="input" value={f.farmAddress} onChange={set('farmAddress')} />
            </Field>
            <Field label="Pincode" id="pincode">
              <input id="pincode" placeholder="e.g. 563101" className="input" value={f.pincode} onChange={set('pincode')} />
            </Field>
            <Field label="GPS Latitude" id="latitude">
              <input
                id="latitude"
                type="number"
                step="any"
                placeholder="e.g. 13.1378"
                className="input"
                value={f.latitude}
                onChange={set('latitude')}
              />
            </Field>
            <Field label="GPS Longitude" id="longitude">
              <input
                id="longitude"
                type="number"
                step="any"
                placeholder="e.g. 78.1291"
                className="input"
                value={f.longitude}
                onChange={set('longitude')}
              />
            </Field>
          </div>
        </div>

        {/* Section 4: Description and Images */}
        <div>
          <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wide border-b pb-1 mb-3">
            4. Crop Description & Photographs
          </h3>
          <Field label="Produce Description" id="description">
            <textarea
              id="description"
              rows="3"
              placeholder="Describe produce condition, harvesting practices, pesticide-free methods..."
              className="input"
              value={f.description}
              onChange={set('description')}
            />
          </Field>
          {edit && keep.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {keep.map((i) => (
                <div key={i} className="relative">
                  <img src={imgUrl(i)} alt="" className="h-16 w-16 rounded object-cover" />
                  <button
                    type="button"
                    aria-label="Remove image"
                    className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-xs text-white"
                    onClick={() => setKeep(keep.filter((k) => k !== i))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <Field label="Images (JPEG/PNG/WebP, max 3 MB each, up to 5)" id="images">
            <input id="images" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={pickFiles} />
          </Field>
        </div>

        <div className="flex gap-2 pt-2 border-t border-stone-200">
          <button className="btn-primary" disabled={busy}>
            {busy ? 'Saving...' : 'Save crop'}
          </button>
          <button type="button" className="btn-outline" onClick={() => nav(-1)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export function MyCrops() {
  const { data, loading, error, reload } = useApi('/crops/mine'); const { toast } = useToast(); const { format } = useCurrency();
  const del = async (c) => {
    if (!window.confirm(`Delete "${c.name}"?`)) return;
    try { await api.delete(`/crops/${c._id}`); toast('Crop deleted'); reload(); } catch (e) { toast(errMsg(e), 'error'); }
  };
  return (
    <div>
      <PageHeader title="My crops">
        <div className="flex gap-2">
          <Link to="/farmer/collections" className="btn-outline">📦 View Collections</Link>
          <Link to="/farmer/crops/new" className="btn-primary">+ Add crop</Link>
        </div>
      </PageHeader>
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.items.length ? <Empty title="No crops yet" hint="Add your first crop listing to start selling." /> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b text-stone-500"><tr><th className="p-2">Crop</th><th>Total Qty</th><th>Aggregation Status</th><th>Price</th><th>Status</th><th></th></tr></thead>
          <tbody>{data.items.map((c) => {
            const alloc = c.allocatedQuantity || 0;
            const free = Math.max(0, c.quantity - alloc);
            return (
              <tr key={c._id} className="border-b">
                <td className="p-2">
                  <Link className="font-medium text-leaf-700" to={`/crops/${c._id}`}>{c.name}</Link>
                  <div className="text-xs text-stone-500">
                    {c.location} · Grade {c.grade || 'A'}
                    {c.variety ? ` · ${c.variety}` : ''}
                    {c.organicCertified ? ' · 🌿 Organic' : ''}
                  </div>
                </td>
                <td>
                  <div className="font-semibold">{c.quantity} {c.unit}</div>
                  {alloc > 0 && <div className="text-xs text-stone-500">Free: {free} {c.unit}</div>}
                </td>
                <td>
                  {alloc >= c.quantity ? (
                    <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
                      📦 In Bulk Lot ({alloc} {c.unit})
                    </span>
                  ) : alloc > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                      🔄 Partial ({alloc} {c.unit} in lot)
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-stone-50 px-2 py-0.5 text-xs font-medium text-stone-600 border border-stone-200">
                      Unallocated
                    </span>
                  )}
                </td>
                <td>{format(c.priceInr).text}</td>
                <td>{c.status}</td>
                <td className="space-x-2 text-right">
                  <Link className="btn-primary" to={`/global-buyers?crop=${encodeURIComponent(c.name)}&cropId=${c._id}`}>Find International Buyers</Link>
                  <Link className="btn-outline" to={`/farmer/crops/${c._id}/edit`}>Edit</Link>
                  <button className="btn-danger" onClick={() => del(c)}>Delete</button>
                </td>
              </tr>
            );
          })}</tbody></table></div>)}
    </div>
  );
}
