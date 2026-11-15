import { useState, useEffect } from 'react';
import api, { errMsg } from '../../services/api.js';

export default function AdminSettings() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin-portal/settings');
      setConfigs(res.data.configurations || []);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleFieldChange = (index, field, value) => {
    setConfigs((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: Number(value) };
      return copy;
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await api.put('/admin-portal/settings', { configurations: configs });
      setSuccess('Pricing rules and reference rates saved successfully!');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚙️</span>
          <h1 className="text-2xl font-black text-stone-900">Platform Pricing & Sourcing Parameters</h1>
        </div>
        <p className="mt-1 text-sm text-stone-600">
          Configure reference mandi rates, automated farmer procurement benchmarks, platform margin %, and logistics allowances.
        </p>
      </div>

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          ✅ {success}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-stone-500">Loading configurations...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {configs.map((cfg, idx) => (
              <div
                key={cfg.cropName}
                className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4"
              >
                <div className="flex items-center gap-2 border-b border-stone-100 pb-3 font-bold text-lg text-stone-900">
                  <span>{cfg.cropName === 'Ragi' ? '🌾' : cfg.cropName === 'Rice' ? '🍚' : '🌽'}</span>
                  <span>{cfg.cropName} Pricing</span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-stone-600">
                    Mandi Benchmark (₹/kg)
                  </label>
                  <input
                    type="number"
                    value={cfg.mandiReferencePricePerKg}
                    onChange={(e) => handleFieldChange(idx, 'mandiReferencePricePerKg', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm font-mono font-bold text-stone-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-stone-600">
                    Farmer Procurement Rate (₹/kg)
                  </label>
                  <input
                    type="number"
                    value={cfg.defaultFarmerProcurementPricePerKg}
                    onChange={(e) => handleFieldChange(idx, 'defaultFarmerProcurementPricePerKg', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm font-mono font-bold text-emerald-700"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-stone-600">
                    Buyer Procurement Rate (₹/kg)
                  </label>
                  <input
                    type="number"
                    value={cfg.buyerProcurementRatePerKg}
                    onChange={(e) => handleFieldChange(idx, 'buyerProcurementRatePerKg', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm font-mono font-bold text-leaf-800"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-100">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-stone-500">
                      Platform Fee %
                    </label>
                    <input
                      type="number"
                      value={cfg.platformMarginPercent}
                      onChange={(e) => handleFieldChange(idx, 'platformMarginPercent', e.target.value)}
                      className="mt-1 w-full rounded-xl border border-stone-300 px-2.5 py-1.5 text-xs font-mono text-stone-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-stone-500">
                      Logistics ₹/kg
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={cfg.logisticsCostPerKg}
                      onChange={(e) => handleFieldChange(idx, 'logisticsCostPerKg', e.target.value)}
                      className="mt-1 w-full rounded-xl border border-stone-300 px-2.5 py-1.5 text-xs font-mono text-stone-900"
                      required
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-leaf-700 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-leaf-800 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : '💾 Save Sourcing Parameters'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
