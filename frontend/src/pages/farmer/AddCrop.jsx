import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../../services/api.js';
import MapView from '../../components/MapView.jsx';

const ALLOWED_CROPS = ['Ragi', 'Rice', 'Jowar'];
const GRADES = ['Grade A', 'Grade B', 'Grade C'];
const UNITS = ['kg', 'quintal', 'tonne'];

export default function AddCrop() {
  const navigate = useNavigate();
  const [cropName, setCropName] = useState('Ragi');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [priceInr, setPriceInr] = useState('38');
  const [grade, setGrade] = useState('Grade A');
  const [qualityDescription, setQualityDescription] = useState('');
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  // Live GPS & Location state
  const [gettingLocation, setGettingLocation] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [coordinates, setCoordinates] = useState({ latitude: 12.5234, longitude: 76.8971 }); // Default to Mandya, Karnataka
  const [village, setVillage] = useState('Dudda Village');
  const [hobli, setHobli] = useState('Dudda Hobli');
  const [taluk, setTaluk] = useState('Mandya Taluk');
  const [district, setDistrict] = useState('Mandya');
  const [state, setState] = useState('Karnataka');
  const [country, setCountry] = useState('India');
  const [farmAddress, setFarmAddress] = useState('Survey No 142, Dudda Village, Mandya Taluk');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Handle image files
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    setImages(files);
    const previews = files.map((f) => URL.createObjectURL(f));
    setImagePreviews(previews);
  };

  // Live GPS Retrieval with Reverse Geocoding
  const handleGetLiveGPS = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setGettingLocation(true);
    setGpsError('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setCoordinates({ latitude: lat, longitude: lon });

        // Reverse Geocoding using OpenStreetMap Nominatim
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
            { headers: { 'Accept': 'application/json' } }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};

            const detectedVillage = addr.village || addr.hamlet || addr.suburb || addr.neighbourhood || addr.town || 'Farm Area';
            const detectedHobli = addr.subdistrict || addr.county || 'Local Hobli';
            const detectedTaluk = addr.county || addr.city_district || addr.district || 'Taluk';
            const detectedDistrict = addr.state_district || addr.district || addr.city || 'District';
            const detectedState = addr.state || 'Karnataka';
            const detectedCountry = addr.country || 'India';

            setVillage(detectedVillage);
            setHobli(detectedHobli);
            setTaluk(detectedTaluk);
            setDistrict(detectedDistrict);
            setState(detectedState);
            setCountry(detectedCountry);
            setFarmAddress(data.display_name || `${detectedVillage}, ${detectedTaluk}, ${detectedDistrict}`);
          }
        } catch {
          // Fallback reverse geocoding estimation
          setFarmAddress(`Farm at Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}, ${district}, ${state}`);
        } finally {
          setGettingLocation(false);
        }
      },
      (err) => {
        setGettingLocation(false);
        setGpsError(err.message || 'Failed to retrieve GPS location. You can enter address manually.');
      },
      { timeout: 15000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setError('Please enter a valid available quantity.');
      return;
    }

    const fullLocation = [village, hobli, taluk, district, state, country].filter(Boolean).join(', ');
    if (!fullLocation.trim()) {
      setError('Please provide farm address details.');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('name', cropName);
      formData.append('category', 'Grains');
      formData.append('quantity', String(qty));
      formData.append('unit', unit);
      formData.append('priceInr', String(priceInr || 35));
      formData.append('grade', grade);
      formData.append('qualityDescription', qualityDescription);
      formData.append('location', fullLocation);
      formData.append('farmAddress', farmAddress);
      formData.append('village', village);
      formData.append('hobli', hobli);
      formData.append('taluk', taluk);
      formData.append('district', district);
      formData.append('state', state);
      formData.append('country', country);
      if (coordinates.latitude) formData.append('latitude', String(coordinates.latitude));
      if (coordinates.longitude) formData.append('longitude', String(coordinates.longitude));

      images.forEach((file) => {
        formData.append('images', file);
      });

      await api.post('/crops', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccess('Crop successfully added to your available selling inventory!');
      setTimeout(() => {
        navigate('/farmer/dashboard');
      }, 1200);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const mapPoints = coordinates.latitude && coordinates.longitude
    ? [{ lat: coordinates.latitude, lng: coordinates.longitude, label: `Farm: ${cropName} (${farmAddress})` }]
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border border-leaf-200 bg-gradient-to-r from-leaf-50 to-stone-50 p-6 shadow-sm">
        <h1 className="text-2xl font-black text-stone-900">🌾 Add Available Crop Produce</h1>
        <p className="mt-1 text-sm text-stone-600">
          List your crop to participate in automatic buyer aggregation. Only <strong>Ragi</strong>, <strong>Rice</strong>, and <strong>Jowar</strong> are accepted.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800" role="alert">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        {/* Crop Selection */}
        <div>
          <label className="block text-sm font-bold text-stone-800">Select Crop Produce *</label>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {ALLOWED_CROPS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCropName(c)}
                className={`flex flex-col items-center justify-center rounded-xl border p-4 text-center transition ${
                  cropName === c
                    ? 'border-leaf-600 bg-leaf-50 font-bold text-leaf-900 shadow-sm ring-2 ring-leaf-500'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <span className="text-2xl">{c === 'Ragi' ? '🌾' : c === 'Rice' ? '🍚' : '🌽'}</span>
                <span className="mt-1 text-base">{c}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quantity & Unit & Price */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-semibold text-stone-700">Available Quantity *</label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 5000"
              className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm focus:border-leaf-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700">Unit *</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm focus:border-leaf-600 focus:outline-none"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700">Expected Price (₹/kg)</label>
            <input
              type="number"
              min="1"
              value={priceInr}
              onChange={(e) => setPriceInr(e.target.value)}
              placeholder="e.g. 38"
              className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm focus:border-leaf-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Grade & Quality Description */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-stone-700">Crop Quality Grade *</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm focus:border-leaf-600 focus:outline-none"
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700">Quality Specifications</label>
            <input
              type="text"
              value={qualityDescription}
              onChange={(e) => setQualityDescription(e.target.value)}
              placeholder="e.g. Machine cleaned, moisture 11%, destoned"
              className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm focus:border-leaf-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Photos Upload */}
        <div>
          <label className="block text-sm font-semibold text-stone-700">Upload Produce Photographs</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
            className="mt-1 block w-full text-sm text-stone-500 file:mr-4 file:rounded-xl file:border-0 file:bg-stone-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-stone-700 hover:file:bg-stone-200"
          />
          {imagePreviews.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {imagePreviews.map((src, idx) => (
                <img key={idx} src={src} alt="Preview" className="h-20 w-20 rounded-lg object-cover border border-stone-200" />
              ))}
            </div>
          )}
        </div>

        {/* Live GPS & Reverse Geocoding Section */}
        <div className="rounded-xl border border-leaf-300 bg-leaf-50/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-leaf-950">📍 Live Farm GPS & Address</h3>
              <p className="text-xs text-stone-600">
                Click the button below to get your current GPS location and automatically resolve your full address.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGetLiveGPS}
              disabled={gettingLocation}
              className="rounded-xl bg-leaf-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-leaf-800 disabled:opacity-50"
            >
              {gettingLocation ? '📡 Retrieving GPS...' : '📍 Use Current GPS Location'}
            </button>
          </div>

          {gpsError && (
            <p className="mt-2 text-xs font-semibold text-amber-700">{gpsError}</p>
          )}

          {coordinates.latitude && (
            <div className="mt-2 text-xs font-medium text-stone-700">
              Latitude: <span className="font-mono font-bold text-leaf-800">{coordinates.latitude.toFixed(6)}</span> | Longitude: <span className="font-mono font-bold text-leaf-800">{coordinates.longitude.toFixed(6)}</span>
            </div>
          )}

          {/* Detailed Reverse Geocoded Address Fields */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-stone-700">Village</label>
              <input
                type="text"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                placeholder="Village"
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700">Hobli</label>
              <input
                type="text"
                value={hobli}
                onChange={(e) => setHobli(e.target.value)}
                placeholder="Hobli"
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700">Taluk</label>
              <input
                type="text"
                value={taluk}
                onChange={(e) => setTaluk(e.target.value)}
                placeholder="Taluk"
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700">District</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="District"
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State"
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Country"
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-xs"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-xs font-medium text-stone-700">Confirmed Farm Landmark / Survey No.</label>
            <input
              type="text"
              value={farmAddress}
              onChange={(e) => setFarmAddress(e.target.value)}
              placeholder="e.g. Survey No 142, Dudda Village"
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-xs"
            />
          </div>

          {/* Interactive Map Preview */}
          {mapPoints.length > 0 && (
            <div className="mt-4">
              <label className="mb-1 block text-xs font-bold text-stone-700">🗺️ Confirmed Farm GPS Location on Map:</label>
              <MapView points={mapPoints} height={200} />
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/farmer/dashboard')}
            className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-leaf-700 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-leaf-800 disabled:opacity-50"
          >
            {loading ? 'Submitting Produce...' : '✅ Save Crop Produce'}
          </button>
        </div>
      </form>
    </div>
  );
}
