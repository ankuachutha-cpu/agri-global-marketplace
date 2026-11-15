import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../../services/api.js';

const ALLOWED_CROPS = ['Ragi', 'Rice', 'Jowar'];
const GRADES = ['Grade A', 'Grade B', 'Grade C'];
const DESTINATIONS = [
  'Mangalore Port Container Freight Station',
  'JNPT Port Mumbai CFS / Reefer Yard',
  'Chennai Port Export Terminal',
  'Bangalore Central Warehousing Corporation (CWC)',
  'Hubballi Processing Factory & Silos'
];

export default function CreateRequirement() {
  const navigate = useNavigate();
  const [cropName, setCropName] = useState('Ragi');
  const [quantityInput, setQuantityInput] = useState('50');
  const [unit, setUnit] = useState('tonne');
  const [requiredGrade, setRequiredGrade] = useState('Grade A');
  const [qualityRequirements, setQualityRequirements] = useState('Export ready, moisture under 12%, machine cleaned & destoned');
  const [deliveryDestination, setDeliveryDestination] = useState(DESTINATIONS[0]);
  const [customDestination, setCustomDestination] = useState('');
  const [requiredDeliveryDate, setRequiredDeliveryDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successResult, setSuccessResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessResult(null);

    const val = Number(quantityInput);
    if (!val || val <= 0) {
      setError('Please enter a valid positive quantity.');
      return;
    }

    const requiredQuantityKg = unit === 'tonne' ? val * 1000 : val;
    const finalDestination = customDestination.trim() || deliveryDestination;

    if (!finalDestination) {
      setError('Please specify a delivery destination.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/requirements', {
        cropName,
        requiredQuantityKg,
        requiredGrade,
        qualityRequirements,
        deliveryDestination: finalDestination,
        requiredDeliveryDate
      });

      setSuccessResult(res.data.requirement);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border border-leaf-200 bg-gradient-to-r from-leaf-100 via-stone-50 to-white p-6 shadow-sm">
        <h1 className="text-2xl font-black text-stone-900">📦 Post Bulk Crop Purchase Requirement</h1>
        <p className="mt-1 text-sm text-stone-600">
          Specify bulk procurement for <strong>Ragi</strong>, <strong>Rice</strong>, or <strong>Jowar</strong>. Our middleman engine will automatically identify 2–3 compatible farmers with available stock and propose contributions.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {successResult ? (
        <div className="space-y-4 rounded-2xl border border-green-200 bg-green-50/70 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎉</span>
            <div>
              <h2 className="text-lg font-black text-green-950">Requirement Successfully Created & Matched!</h2>
              <p className="text-xs text-green-800">
                Requirement ID: <strong className="font-mono">{successResult.requirementId}</strong> | Total Target: <strong>{successResult.requiredQuantityKg.toLocaleString()} kg</strong>
              </p>
            </div>
          </div>

          {/* Allocation Breakdown */}
          <div className="mt-4 rounded-xl bg-white p-4 shadow-xs">
            <h3 className="text-sm font-bold text-stone-900">Automated Farmer Contributions:</h3>
            <p className="mt-0.5 text-xs text-stone-500">
              The engine automatically split the order across {successResult.contributions?.length || 0} compatible farmers:
            </p>

            <div className="mt-3 divide-y divide-stone-100">
              {successResult.contributions?.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-2 text-xs">
                  <div>
                    <span className="font-bold text-stone-800">{c.farmerName}</span>
                    <span className="ml-2 text-stone-500">({c.farmerLocation})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-md bg-leaf-50 px-2 py-0.5 font-bold text-leaf-800">
                      {c.proposedQuantityKg.toLocaleString()} kg
                    </span>
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                      Proposed (Awaiting Confirmation)
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2 text-xs">
              <span className="font-bold text-stone-600">Total Allocated:</span>
              <span className="font-black text-leaf-900">
                {successResult.allocatedQuantityKg?.toLocaleString()} / {successResult.requiredQuantityKg?.toLocaleString()} kg
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/buyer/requirements')}
              className="rounded-xl bg-leaf-700 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-leaf-800"
            >
              View My Requirements Dashboard →
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          {/* Crop Choice */}
          <div>
            <label className="block text-sm font-bold text-stone-800">Select Crop Required *</label>
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

          {/* Quantity & Unit */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-stone-700">Required Quantity *</label>
              <input
                type="number"
                min="1"
                required
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                placeholder="e.g. 50"
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
                <option value="tonne">Tonnes (Metric Ton / MT = 1,000 kg)</option>
                <option value="kg">Kilograms (kg)</option>
              </select>
            </div>
          </div>

          {/* Grade & Quality Specs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-stone-700">Required Grade *</label>
              <select
                value={requiredGrade}
                onChange={(e) => setRequiredGrade(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm focus:border-leaf-600 focus:outline-none"
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-700">Target Delivery Date *</label>
              <input
                type="date"
                required
                value={requiredDeliveryDate}
                onChange={(e) => setRequiredDeliveryDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm focus:border-leaf-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700">Quality Specifications</label>
            <textarea
              rows="2"
              value={qualityRequirements}
              onChange={(e) => setQualityRequirements(e.target.value)}
              placeholder="e.g. Grain moisture max 11%, machine cleaned, pesticide residue certified"
              className="mt-1 w-full rounded-xl border border-stone-300 p-2.5 text-sm focus:border-leaf-600 focus:outline-none"
            />
          </div>

          {/* Delivery Destination */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-stone-700">Delivery Destination (Warehouse, Port, or Factory) *</label>
            <select
              value={deliveryDestination}
              onChange={(e) => setDeliveryDestination(e.target.value)}
              className="w-full rounded-xl border border-stone-300 p-2.5 text-sm focus:border-leaf-600 focus:outline-none"
            >
              {DESTINATIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
              <option value="custom">Other Custom Facility / Factory / Port</option>
            </select>

            {deliveryDestination === 'custom' && (
              <input
                type="text"
                required
                value={customDestination}
                onChange={(e) => setCustomDestination(e.target.value)}
                placeholder="Enter facility name and full city address"
                className="mt-2 w-full rounded-xl border border-stone-300 p-2.5 text-sm focus:border-leaf-600 focus:outline-none"
              />
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-leaf-700 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-leaf-800 disabled:opacity-50"
            >
              {loading ? 'Matching Farmers & Aggregating...' : '🚀 Submit Requirement & Auto-Match'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
