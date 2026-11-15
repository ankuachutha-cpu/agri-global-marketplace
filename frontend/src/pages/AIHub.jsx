import { useState } from 'react';
import api, { errMsg } from '../services/api.js';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { PageHeader, ErrorBox, Notice, Badge } from '../components/ui.jsx';
import { PricePrediction, CropRecommendation } from './AI.jsx';

const CROPS = ['Basmati Rice', 'Rice', 'Mango', 'Table Grapes', 'Red Onion', 'Spices', 'Cotton'];
const COUNTRIES = ['United Arab Emirates', 'Saudi Arabia', 'United Kingdom', 'Netherlands', 'United States', 'Singapore', 'Malaysia', 'Bangladesh'];

export default function AIHub() {
  const [activeTab, setActiveTab] = useState('demand');

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Intelligence & Trade Analytics Hub"
        subtitle="Predict international demand, evaluate destination feasibility, analyze crop quality grades, and match with verified global buyers."
      />

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-3">
        <button
          onClick={() => setActiveTab('demand')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'demand' ? 'bg-leaf-700 text-white shadow' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          📈 International Demand Forecasting
        </button>
        <button
          onClick={() => setActiveTab('destinations')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'destinations' ? 'bg-leaf-700 text-white shadow' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          🌍 Export Destination Recommendations
        </button>
        <button
          onClick={() => setActiveTab('matching')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'matching' ? 'bg-leaf-700 text-white shadow' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          🤝 Smart Buyer Matching
        </button>
        <button
          onClick={() => setActiveTab('quality')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'quality' ? 'bg-leaf-700 text-white shadow' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          🔬 AI Quality Analysis & Grading
        </button>
        <button
          onClick={() => setActiveTab('price')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'price' ? 'bg-leaf-700 text-white shadow' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          📊 Mandi Price Prediction
        </button>
        <button
          onClick={() => setActiveTab('soil')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'soil' ? 'bg-leaf-700 text-white shadow' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          🌱 Soil Crop Recommendation
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'demand' && <DemandForecasting />}
      {activeTab === 'destinations' && <ExportDestinations />}
      {activeTab === 'matching' && <SmartMatching />}
      {activeTab === 'quality' && <QualityAnalysis />}
      {activeTab === 'price' && <PricePrediction />}
      {activeTab === 'soil' && <CropRecommendation />}
    </div>
  );
}

// -------------------------------------------------------------
// 1. DEMAND FORECASTING
// -------------------------------------------------------------
function DemandForecasting() {
  const [crop, setCrop] = useState('Basmati Rice');
  const [country, setCountry] = useState('United Arab Emirates');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      const res = await api.post('/ai/demand-forecast', {
        crop,
        targetCountry: country,
        targetMonth: Number(month)
      });
      setResult(res.data);
    } catch (e2) {
      setErr(errMsg(e2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="card space-y-4 lg:col-span-1">
        <h3 className="text-lg font-bold text-stone-800">Forecast Parameters</h3>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Commodity</label>
            <select
              className="input w-full"
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
            >
              {CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Target Export Market</label>
            <select
              className="input w-full"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Target Month</label>
            <select
              className="input w-full"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Month {m} ({new Date(2026, m - 1, 1).toLocaleString('default', { month: 'long' })})
                </option>
              ))}
            </select>
          </div>

          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Forecasting...' : 'Run Demand Forecast'}
          </button>
        </form>
        {err && <ErrorBox message={err} />}
      </div>

      <div className="space-y-4 lg:col-span-2">
        {result ? (
          <div className="card space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
              <div>
                <h2 className="text-xl font-bold text-leaf-800">{result.crop} Demand Forecast</h2>
                <p className="text-xs text-stone-500">
                  Target Destination: <span className="font-semibold text-stone-800">{result.targetCountry}</span> · Month: {result.targetMonth}/2026 · HS Code: {result.hsCode}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase tracking-wide text-stone-500">Confidence Score</span>
                <p className="text-lg font-extrabold text-leaf-700">{Math.round(result.confidenceScore * 100)}%</p>
              </div>
            </div>

            {/* Demand Meter & Pricing */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
                <p className="text-xs font-medium text-stone-500">Demand Index</p>
                <p className="my-1 text-3xl font-extrabold text-leaf-700">{result.demandIndex} <span className="text-sm font-normal text-stone-500">/ 100</span></p>
                <Badge variant={result.trend === 'Peak Demand' ? 'success' : result.trend === 'Rising' ? 'info' : 'neutral'}>
                  {result.trend}
                </Badge>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
                <p className="text-xs font-medium text-stone-500">Projected International Price</p>
                <p className="my-1 text-2xl font-extrabold text-stone-900">${result.projectedPriceUsdPerMt?.toLocaleString()} <span className="text-xs font-normal text-stone-500">/ MT</span></p>
                <p className="text-xs text-stone-500">≈ ₹{result.projectedPriceInrPerKg} / kg</p>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
                <p className="text-xs font-medium text-stone-500">Container & Cold Chain</p>
                <p className="my-1 text-sm font-bold text-stone-800">{result.containerType}</p>
                <Badge variant={result.reeferRequired ? 'warning' : 'neutral'}>
                  {result.reeferRequired ? 'Reefer Required' : 'Ambient Dry Cargo'}
                </Badge>
              </div>
            </div>

            {/* Explainability Factors */}
            <div>
              <h4 className="mb-2 text-sm font-bold text-stone-800">Analytical & Seasonality Factors (Explainability)</h4>
              <ul className="space-y-2">
                {result.factors?.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-lg bg-leaf-50/60 p-2.5 text-xs text-stone-700">
                    <span className="text-leaf-600 font-bold">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg bg-stone-100 p-3 text-xs text-stone-600">
              <span className="font-semibold text-stone-800">Data Sources:</span> {result.dataSources?.join(' · ')}
            </div>
          </div>
        ) : (
          <div className="card flex flex-col items-center justify-center p-12 text-center text-stone-500">
            <span className="text-4xl mb-3">📈</span>
            <p className="font-semibold text-stone-700">Run Demand Forecasting</p>
            <p className="text-xs max-w-sm mt-1">Select your commodity, target export country, and shipping month to view international trade projections.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 2. EXPORT DESTINATION RECOMMENDATIONS
// -------------------------------------------------------------
function ExportDestinations() {
  const [crop, setCrop] = useState('Mango');
  const [grade, setGrade] = useState('A');
  const [volumeKg, setVolumeKg] = useState(24000);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      const res = await api.post('/ai/destination-recommendations', {
        crop,
        grade,
        volumeKg: Number(volumeKg)
      });
      setResult(res.data);
    } catch (e2) {
      setErr(errMsg(e2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="card space-y-4 lg:col-span-1">
        <h3 className="text-lg font-bold text-stone-800">Shipment Profile</h3>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Crop</label>
            <select
              className="input w-full"
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
            >
              {CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Quality Grade</label>
            <select
              className="input w-full"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              <option value="A">Grade A (Premium Export Quality)</option>
              <option value="B">Grade B (Standard Export Quality)</option>
              <option value="C">Grade C (Domestic/Processing)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Volume (kg)</label>
            <input
              type="number"
              className="input w-full"
              value={volumeKg}
              onChange={(e) => setVolumeKg(e.target.value)}
              min={100}
              max={1000000}
            />
            <p className="mt-1 text-xs text-stone-500">24,000 kg ≈ 1 full 40ft container load</p>
          </div>

          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Evaluating...' : 'Recommend Destinations'}
          </button>
        </form>
        {err && <ErrorBox message={err} />}
      </div>

      <div className="space-y-4 lg:col-span-2">
        {result ? (
          <div className="space-y-4">
            <div className="card bg-leaf-50/60 p-4">
              <p className="text-sm font-bold text-leaf-900">{result.summary}</p>
              <p className="text-xs text-stone-600 mt-1">
                Volume: {result.volumeMt} MT · Requirement: {result.containerRequirement} · Confidence: {Math.round(result.confidenceScore * 100)}%
              </p>
            </div>

            <div className="grid gap-3">
              {result.recommendations?.map((r, i) => (
                <div key={r.country} className="card p-4 hover:border-leaf-300 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-leaf-700 text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <h4 className="text-base font-bold text-stone-900">{r.country}</h4>
                      <span className="text-xs text-stone-500">({r.destinationPort})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-leaf-700">Suitability: {r.suitabilityScore}%</span>
                      <Badge variant="success">Net Margin ~{r.estimatedNetMarginPercent}%</Badge>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs">
                    <div>
                      <span className="text-stone-500">Tariff Agreement:</span>
                      <p className="font-semibold text-stone-800">{r.tariffBenefit}</p>
                    </div>
                    <div>
                      <span className="text-stone-500">Maritime Transit:</span>
                      <p className="font-semibold text-stone-800">{r.estimatedTransitDays} Days from JNPT/Mundra</p>
                    </div>
                    <div>
                      <span className="text-stone-500">Target Value Realization:</span>
                      <p className="font-semibold text-leaf-700">${r.targetPriceUsdPerMt?.toLocaleString()} / MT (${r.estimatedTotalShipmentValueUsd?.toLocaleString()} Total)</p>
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-stone-600 bg-stone-50 p-2 rounded">{r.rationale}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card flex flex-col items-center justify-center p-12 text-center text-stone-500">
            <span className="text-4xl mb-3">🌍</span>
            <p className="font-semibold text-stone-700">Export Route Analysis</p>
            <p className="text-xs max-w-sm mt-1">Specify your crop volume and grade to see AI-ranked export corridors with tariff concessions and sea freight transit estimations.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 3. SMART BUYER MATCHING
// -------------------------------------------------------------
function SmartMatching() {
  const [cropName, setCropName] = useState('Mango');
  const [quantityKg, setQuantityKg] = useState(5000);
  const [targetCountry, setTargetCountry] = useState('United Arab Emirates');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      const res = await api.post('/ai/smart-matching', {
        cropName,
        quantityKg: Number(quantityKg),
        targetCountry
      });
      setResult(res.data);
    } catch (e2) {
      setErr(errMsg(e2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="card space-y-4 lg:col-span-1">
        <h3 className="text-lg font-bold text-stone-800">Match Parameters</h3>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Crop Offered</label>
            <input
              className="input w-full"
              value={cropName}
              onChange={(e) => setCropName(e.target.value)}
              placeholder="e.g. Alphonso Mango, Basmati Rice"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Offered Volume (kg)</label>
            <input
              type="number"
              className="input w-full"
              value={quantityKg}
              onChange={(e) => setQuantityKg(e.target.value)}
              min={10}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Target Region</label>
            <select
              className="input w-full"
              value={targetCountry}
              onChange={(e) => setTargetCountry(e.target.value)}
            >
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Matching...' : 'Find Compatible Buyers'}
          </button>
        </form>
        {err && <ErrorBox message={err} />}
      </div>

      <div className="space-y-4 lg:col-span-2">
        {result ? (
          <div className="space-y-4">
            <div className="card bg-leaf-50/60 p-4">
              <p className="text-sm font-bold text-leaf-900">{result.matchSummary}</p>
              <p className="text-xs text-stone-600 mt-1">
                Matched against live verified international importers and active RFQs in database.
              </p>
            </div>

            <div className="grid gap-3">
              {result.topMatches?.map((m) => (
                <div key={m.id} className="card p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-stone-900">{m.companyName || m.buyerName}</h4>
                        <Badge variant="info">{m.country}</Badge>
                      </div>
                      <p className="text-xs text-stone-500">
                        {m.matchType === 'live_rfq' ? `Live RFQ #${m.rfqNumber}` : 'Verified Corporate Buyer'}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs uppercase text-stone-500">Compatibility Score</span>
                      <p className="text-lg font-extrabold text-leaf-700">{m.matchScore}%</p>
                    </div>
                  </div>

                  {/* Compatibility factors */}
                  <div className="space-y-1">
                    {m.compatibilityFactors?.map((f, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-stone-700">
                        <span className="font-semibold text-leaf-700">• {f.factor}:</span>
                        <span>{f.detail}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                    <span className="text-xs text-stone-500">Recommended Action:</span>
                    <span className="text-xs font-bold text-leaf-800">{m.recommendedAction}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card flex flex-col items-center justify-center p-12 text-center text-stone-500">
            <span className="text-4xl mb-3">🤝</span>
            <p className="font-semibold text-stone-700">Smart Buyer Matching</p>
            <p className="text-xs max-w-sm mt-1">Connect your agricultural batch directly with verified global importers and open purchase requisitions.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 4. AI CROP QUALITY ANALYSIS
// -------------------------------------------------------------
function QualityAnalysis() {
  const [cropName, setCropName] = useState('Basmati Rice');
  const [moisture, setMoisture] = useState(12.8);
  const [defect, setDefect] = useState(1.5);
  const [uniformity, setUniformity] = useState(92);
  const [foreignMatter, setForeignMatter] = useState(0.1);
  const [colorScore, setColorScore] = useState(90);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      const res = await api.post('/ai/quality-analysis', {
        cropName,
        moisturePercent: Number(moisture),
        defectPercent: Number(defect),
        sizeUniformityPercent: Number(uniformity),
        foreignMatterPercent: Number(foreignMatter),
        colorScore: Number(colorScore)
      });
      setResult(res.data);
    } catch (e2) {
      setErr(errMsg(e2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="card space-y-4 lg:col-span-1">
        <h3 className="text-lg font-bold text-stone-800">Physical Parameters</h3>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Crop Name</label>
            <select
              className="input w-full"
              value={cropName}
              onChange={(e) => setCropName(e.target.value)}
            >
              {CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-700">Moisture (%)</label>
              <input
                type="number"
                step="0.1"
                className="input w-full"
                value={moisture}
                onChange={(e) => setMoisture(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-700">Defects / Damage (%)</label>
              <input
                type="number"
                step="0.1"
                className="input w-full"
                value={defect}
                onChange={(e) => setDefect(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-700">Size Uniformity (%)</label>
              <input
                type="number"
                step="1"
                className="input w-full"
                value={uniformity}
                onChange={(e) => setUniformity(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-700">Foreign Matter (%)</label>
              <input
                type="number"
                step="0.05"
                className="input w-full"
                value={foreignMatter}
                onChange={(e) => setForeignMatter(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-700">Visual Color & Aroma (0-100)</label>
            <input
              type="number"
              className="input w-full"
              value={colorScore}
              onChange={(e) => setColorScore(e.target.value)}
              min={0}
              max={100}
            />
          </div>

          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Evaluating...' : 'Run Quality Analysis'}
          </button>
        </form>
        {err && <ErrorBox message={err} />}
      </div>

      <div className="space-y-4 lg:col-span-2">
        {result ? (
          <div className="card space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-xl font-bold text-stone-900">{result.grade}</h3>
                <p className="text-xs text-stone-500">Commodity: {result.crop} · Confidence: {Math.round(result.confidenceScore * 100)}%</p>
              </div>
              <Badge variant={result.exportEligibility ? 'success' : 'danger'}>
                {result.exportEligibility ? 'Export Compliant' : 'Non-Exportable'}
              </Badge>
            </div>

            {/* Quality Score & Premium */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-center">
                <p className="text-xs text-stone-500">Quality Score</p>
                <p className="my-1 text-2xl font-extrabold text-leaf-700">{result.overallQualityScore} / 100</p>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-center">
                <p className="text-xs text-stone-500">Export Pricing Realization</p>
                <p className="my-1 text-xl font-extrabold text-stone-900">₹{result.suggestedExportPriceInr} / kg</p>
                <span className="text-xs text-leaf-600 font-semibold">
                  {result.pricePremiumDiscountPercent >= 0 ? `+${result.pricePremiumDiscountPercent}% Premium` : `${result.pricePremiumDiscountPercent}% Discount`}
                </span>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-center">
                <p className="text-xs text-stone-500">Storage Recommendation</p>
                <p className="my-1 text-xs font-semibold text-stone-800">{result.recommendedStorageConditions}</p>
              </div>
            </div>

            {/* Factor Checks */}
            <div>
              <h4 className="mb-2 text-sm font-bold text-stone-800">Parameter Compliance Breakdown</h4>
              <div className="grid gap-2">
                {result.analysisFactors?.map((f, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 p-2.5 text-xs">
                    <div>
                      <span className="font-semibold text-stone-800">{f.parameter}</span>: {f.value}
                      <span className="text-stone-500 ml-2">(Benchmark: {f.benchmark})</span>
                      <p className="text-[11px] text-stone-500 mt-0.5">{f.note}</p>
                    </div>
                    <Badge variant={f.status === 'optimal' ? 'success' : f.status === 'acceptable' ? 'info' : 'danger'}>
                      {f.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-stone-50 p-3 text-xs text-stone-600">
              <span className="font-bold text-stone-800">Phytosanitary Certification:</span> {result.phytosanitaryNotes}
            </div>
          </div>
        ) : (
          <div className="card flex flex-col items-center justify-center p-12 text-center text-stone-500">
            <span className="text-4xl mb-3">🔬</span>
            <p className="font-semibold text-stone-700">AI Quality Inspection</p>
            <p className="text-xs max-w-sm mt-1">Enter physical harvest parameters to determine international export grade, price adjustments, and packaging specifications.</p>
          </div>
        )}
      </div>
    </div>
  );
}
