import { useState } from 'react';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';
import api, { errMsg } from '../services/api.js';
import { PageHeader, Badge, ErrorBox } from '../components/ui.jsx';

export default function Analytics() {
  const { user } = useAuth();
  const { format } = useCurrency();
  const role = user?.role || 'admin';

  const [activeTab, setActiveTab] = useState(role === 'farmer' ? 'farmer' : role === 'buyer' ? 'buyer' : 'admin');
  const [downloading, setDownloading] = useState(false);
  const [downloadErr, setDownloadErr] = useState('');

  const { data: adminData, loading: adminLoading, error: adminErr } = useApi(
    (role === 'admin' || activeTab === 'admin') ? '/api/analytics/admin' : null
  );
  const { data: farmerData, loading: farmerLoading, error: farmerErr } = useApi(
    role === 'farmer' || activeTab === 'farmer' ? '/api/analytics/farmer' : null
  );
  const { data: buyerData, loading: buyerLoading, error: buyerErr } = useApi(
    role === 'buyer' || activeTab === 'buyer' ? '/api/analytics/buyer' : null
  );
  const { data: exporterData, loading: exporterLoading, error: exporterErr } = useApi(
    activeTab === 'exporter' ? '/api/analytics/exporter' : null
  );
  const { data: trendsData } = useApi('/api/analytics/export-trends');

  const downloadReport = async (formatType = 'csv') => {
    setDownloading(true);
    setDownloadErr('');
    try {
      const res = await api.get(`/analytics/download-report?format=${formatType}&type=${activeTab}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `agriglobal-analytics-report-${Date.now()}.${formatType}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setDownloadErr(errMsg(err));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="AgriGlobal Business Intelligence & Analytics"
          subtitle="Real-time macro export metrics, country trends, supply-demand balances, and financial performance."
        />

        {/* Download Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadReport('csv')}
            disabled={downloading}
            className="btn-outline flex items-center gap-1.5 text-xs font-semibold"
          >
            📥 Download CSV Report
          </button>
          <button
            onClick={() => downloadReport('json')}
            disabled={downloading}
            className="btn-outline flex items-center gap-1.5 text-xs font-semibold"
          >
            📄 Export JSON
          </button>
        </div>
      </div>

      {downloadErr && <ErrorBox message={downloadErr} />}

      {/* Role Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-2">
        {(role === 'admin' || role === 'public') && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === 'admin' ? 'bg-leaf-700 text-white shadow' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            🌐 Macro Export BI Dashboard
          </button>
        )}
        {(role === 'farmer' || role === 'admin') && (
          <button
            onClick={() => setActiveTab('farmer')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === 'farmer' ? 'bg-leaf-700 text-white shadow' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            🌾 Farmer Production & Earnings
          </button>
        )}
        {(role === 'buyer' || role === 'admin') && (
          <button
            onClick={() => setActiveTab('buyer')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === 'buyer' ? 'bg-leaf-700 text-white shadow' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            🚢 Buyer Procurement Analytics
          </button>
        )}
        <button
          onClick={() => setActiveTab('exporter')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'exporter' ? 'bg-leaf-700 text-white shadow' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          ⚓ Exporter & Logistics Performance
        </button>
        <button
          onClick={() => setActiveTab('trends')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'trends' ? 'bg-leaf-700 text-white shadow' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          📊 Commodity Export Trends
        </button>
      </div>

      {/* ADMIN BI DASHBOARD TAB */}
      {activeTab === 'admin' && (
        <div className="space-y-6">
          {adminLoading && <p className="text-stone-500">Loading business intelligence metrics...</p>}
          {adminErr && <ErrorBox message={adminErr} />}
          {adminData && (
            <>
              {/* Macro KPIs */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="card p-4">
                  <p className="text-xs uppercase text-stone-500">Aggregated Export Volume</p>
                  <p className="mt-1 text-2xl font-black text-leaf-800">
                    {adminData.overview?.totalAggregatedVolumeMt?.toLocaleString()} <span className="text-sm font-normal text-stone-500">MT</span>
                  </p>
                  <p className="text-xs text-stone-500 mt-1">Across {adminData.overview?.activeLotsCount} active lots</p>
                </div>

                <div className="card p-4">
                  <p className="text-xs uppercase text-stone-500">Gross Export Trade Value</p>
                  <p className="mt-1 text-2xl font-black text-stone-900">
                    ₹{(adminData.overview?.grossExportValueInr || 0).toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-leaf-700 font-semibold mt-1">
                    ≈ ${adminData.overview?.grossExportValueUsd?.toLocaleString()} USD
                  </p>
                </div>

                <div className="card p-4">
                  <p className="text-xs uppercase text-stone-500">Platform Facilitation Fees</p>
                  <p className="mt-1 text-2xl font-black text-leaf-700">
                    ₹{(adminData.overview?.platformCommissionInr || 0).toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-stone-500 mt-1">5% facilitation fee model</p>
                </div>

                <div className="card p-4">
                  <p className="text-xs uppercase text-stone-500">Cold Chain Integrity Rate</p>
                  <p className="mt-1 text-2xl font-black text-leaf-800">
                    {adminData.overview?.coldChainIntegrityPercent}%
                  </p>
                  <p className="text-xs text-stone-500 mt-1">{adminData.overview?.totalContainers} total containers tracked</p>
                </div>
              </div>

              {/* Country Trends & Supply vs Demand */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Country Breakdown */}
                <div className="card space-y-4">
                  <h3 className="text-lg font-bold text-stone-800">Country-wise Export Distribution</h3>
                  <div className="space-y-3">
                    {adminData.countryTrends?.map((c) => (
                      <div key={c.country} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-stone-800">{c.country}</span>
                          <span className="text-leaf-700">{c.volumeMt?.toLocaleString()} MT ({c.sharePercent}%)</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                          <div
                            className="h-full bg-leaf-600 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(5, c.sharePercent))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Supply vs Demand */}
                <div className="card space-y-4">
                  <h3 className="text-lg font-bold text-stone-800">Commodity Supply vs Export Demand</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-stone-200 text-stone-500 uppercase">
                        <tr>
                          <th className="py-2">Commodity</th>
                          <th className="py-2 text-right">Available Supply</th>
                          <th className="py-2 text-right">Active Demand</th>
                          <th className="py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {adminData.supplyVsDemand?.map((item) => (
                          <tr key={item.crop}>
                            <td className="py-2.5 font-bold text-stone-900">{item.crop}</td>
                            <td className="py-2.5 text-right font-medium">{item.supplyKg?.toLocaleString()} kg</td>
                            <td className="py-2.5 text-right font-medium text-leaf-700">{item.demandKg?.toLocaleString()} kg</td>
                            <td className="py-2.5 text-center">
                              <Badge variant={item.status.includes('High') ? 'success' : item.status.includes('Balanced') ? 'info' : 'warning'}>
                                {item.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Monthly Progression */}
              <div className="card space-y-4">
                <h3 className="text-lg font-bold text-stone-800">Monthly Trade Volume & Revenue Progression</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-stone-200 text-stone-500 uppercase">
                      <tr>
                        <th className="py-2">Month</th>
                        <th className="py-2 text-right">Export Tonnage</th>
                        <th className="py-2 text-right">Gross Trade Value</th>
                        <th className="py-2 text-right">Platform Commission</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {adminData.monthlyTrends?.map((m) => (
                        <tr key={m.month}>
                          <td className="py-2.5 font-semibold text-stone-800">{m.month}</td>
                          <td className="py-2.5 text-right">{m.exportTonnageMt} MT</td>
                          <td className="py-2.5 text-right font-bold text-stone-900">₹{m.grossValueInr?.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 text-right font-bold text-leaf-700">₹{m.commissionInr?.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* FARMER PRODUCTION & EARNINGS TAB */}
      {activeTab === 'farmer' && (
        <div className="space-y-6">
          {farmerLoading && <p className="text-stone-500">Loading farmer earnings analytics...</p>}
          {farmerErr && <ErrorBox message={farmerErr} />}
          {farmerData && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="card p-4">
                  <p className="text-xs uppercase text-stone-500">Total Produce Listed</p>
                  <p className="mt-1 text-2xl font-bold text-stone-900">
                    {farmerData.summary?.totalListedProduceKg?.toLocaleString()} <span className="text-sm font-normal text-stone-500">kg</span>
                  </p>
                  <p className="text-xs text-stone-500 mt-1">{farmerData.summary?.totalCropsListed} active listings</p>
                </div>

                <div className="card p-4">
                  <p className="text-xs uppercase text-stone-500">Accepted Export Produce</p>
                  <p className="mt-1 text-2xl font-bold text-leaf-800">
                    {farmerData.summary?.totalAcceptedKg?.toLocaleString()} <span className="text-sm font-normal text-stone-500">kg</span>
                  </p>
                  <p className="text-xs text-stone-500 mt-1">Aggregated into verified lots</p>
                </div>

                <div className="card p-4">
                  <p className="text-xs uppercase text-stone-500">Disbursed Earnings (Net)</p>
                  <p className="mt-1 text-2xl font-bold text-leaf-700">
                    ₹{(farmerData.summary?.totalSettledEarningsInr || 0).toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-stone-500 mt-1">Directly settled via UPI/NEFT</p>
                </div>

                <div className="card p-4">
                  <p className="text-xs uppercase text-stone-500">Average Price Realized</p>
                  <p className="mt-1 text-2xl font-bold text-stone-900">
                    ₹{farmerData.summary?.avgRealizationPerKg} <span className="text-sm font-normal text-stone-500">/ kg</span>
                  </p>
                  <p className="text-xs text-leaf-600 font-semibold mt-1">15-20% higher than local mandi</p>
                </div>
              </div>

              {/* Earnings by Crop */}
              <div className="card space-y-4">
                <h3 className="text-lg font-bold text-stone-800">Earnings Breakdown by Commodity</h3>
                {farmerData.earningsByCrop?.length > 0 ? (
                  <div className="space-y-3">
                    {farmerData.earningsByCrop.map((item) => (
                      <div key={item.crop} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span>{item.crop}</span>
                          <span className="text-leaf-700">₹{item.amountInr?.toLocaleString('en-IN')} ({item.sharePercent}%)</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                          <div
                            className="h-full bg-leaf-600 rounded-full"
                            style={{ width: `${Math.min(100, item.sharePercent || 20)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-500">No settlement history yet. Schedule collections for your listed crops to see earnings analytics.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* BUYER PROCUREMENT ANALYTICS TAB */}
      {activeTab === 'buyer' && (
        <div className="space-y-6">
          {buyerLoading && <p className="text-stone-500">Loading procurement analytics...</p>}
          {buyerErr && <ErrorBox message={buyerErr} />}
          {buyerData && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="card p-4">
                  <p className="text-xs uppercase text-stone-500">Total Procurement Spend</p>
                  <p className="mt-1 text-2xl font-bold text-stone-900">
                    ₹{(buyerData.summary?.totalSpendInr || 0).toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-leaf-700 font-semibold mt-1">≈ ${buyerData.summary?.totalSpendUsd?.toLocaleString()} USD</p>
                </div>

                <div className="card p-4">
                  <p className="text-xs uppercase text-stone-500">Procured Volume</p>
                  <p className="mt-1 text-2xl font-bold text-leaf-800">
                    {buyerData.summary?.totalProcuredMt} <span className="text-sm font-normal text-stone-500">MT</span>
                  </p>
                  <p className="text-xs text-stone-500 mt-1">({buyerData.summary?.totalProcuredKg?.toLocaleString()} kg total)</p>
                </div>

                <div className="card p-4">
                  <p className="text-xs uppercase text-stone-500">Order Fulfillment Rate</p>
                  <p className="mt-1 text-2xl font-bold text-leaf-700">
                    {buyerData.summary?.orderFulfillmentRate}%
                  </p>
                  <p className="text-xs text-stone-500 mt-1">{buyerData.summary?.completedOrders} completed of {buyerData.summary?.totalOrdersPlaced} placed</p>
                </div>

                <div className="card p-4">
                  <p className="text-xs uppercase text-stone-500">Active RFQs</p>
                  <p className="mt-1 text-2xl font-bold text-stone-900">
                    {buyerData.summary?.activeRfqsCount}
                  </p>
                  <p className="text-xs text-stone-500 mt-1">Currently open for quotes</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* EXPORTER & LOGISTICS PERFORMANCE TAB */}
      {activeTab === 'exporter' && (
        <div className="space-y-6">
          {exporterLoading && <p className="text-stone-500">Loading exporter logistics analytics...</p>}
          {exporterErr && <ErrorBox message={exporterErr} />}
          {exporterData && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="card p-4">
                  <p className="text-xs uppercase text-stone-500">Total Shipments Managed</p>
                  <p className="mt-1 text-2xl font-bold text-stone-900">
                    {exporterData.summary?.totalShipments}
                  </p>
                  <p className="text-xs text-stone-500 mt-1">
                    {exporterData.summary?.activeShipmentsCount} in transit · {exporterData.summary?.deliveredShipmentsCount} delivered
                  </p>
                </div>

                <div className="card p-4">
                  <p className="text-xs uppercase text-stone-500">On-Time Delivery Rate</p>
                  <p className="mt-1 text-2xl font-bold text-leaf-700">
                    {exporterData.summary?.onTimeDeliveryRate}%
                  </p>
                  <p className="text-xs text-stone-500 mt-1">Maritime schedule adherence</p>
                </div>

                <div className="card p-4">
                  <p className="text-xs uppercase text-stone-500">Cold Chain Integrity Rate</p>
                  <p className="mt-1 text-2xl font-bold text-leaf-800">
                    {exporterData.summary?.coldChainCompliancePercent}%
                  </p>
                  <p className="text-xs text-stone-500 mt-1">{exporterData.summary?.totalContainersHandled} reefer containers monitored</p>
                </div>

                <div className="card p-4">
                  <p className="text-xs uppercase text-stone-500">Customs Clearance Velocity</p>
                  <p className="mt-1 text-2xl font-bold text-stone-900">
                    {exporterData.summary?.averageCustomsClearanceHours} <span className="text-sm font-normal text-stone-500">hrs</span>
                  </p>
                  <p className="text-xs text-leaf-600 font-semibold mt-1">Port documentation speed</p>
                </div>
              </div>

              {/* Shipping Lines & Ports Breakdown */}
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="card space-y-4">
                  <h3 className="text-lg font-bold text-stone-800">Shipping Line Carrier Distribution</h3>
                  {exporterData.shippingLineDistribution?.length > 0 ? (
                    <div className="space-y-3">
                      {exporterData.shippingLineDistribution.map((item) => (
                        <div key={item.line} className="flex justify-between items-center text-xs p-2 rounded bg-stone-50">
                          <span className="font-semibold text-stone-800">{item.line}</span>
                          <Badge variant="info">{item.count} Shipments</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-500">No carrier records available yet.</p>
                  )}
                </div>

                <div className="card space-y-4">
                  <h3 className="text-lg font-bold text-stone-800">Destination Port Dispatches</h3>
                  {exporterData.destinationPortDistribution?.length > 0 ? (
                    <div className="space-y-3">
                      {exporterData.destinationPortDistribution.map((item) => (
                        <div key={item.port} className="flex justify-between items-center text-xs p-2 rounded bg-stone-50">
                          <span className="font-semibold text-stone-800">{item.port}</span>
                          <Badge variant="success">{item.count} Shipments</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-500">No destination port dispatches logged yet.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* COMMODITY EXPORT TRENDS TAB */}
      {activeTab === 'trends' && trendsData && (
        <div className="space-y-4">
          <div className="card bg-leaf-50/60 p-4">
            <h3 className="text-base font-bold text-leaf-900">{trendsData.title}</h3>
            <p className="text-xs text-stone-600 mt-1">Official benchmarks powered by {trendsData.source}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trendsData.commodities?.map((item) => (
              <div key={item.name} className="card p-4 space-y-2">
                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <h4 className="font-bold text-stone-900 capitalize">{item.name}</h4>
                  <Badge variant="info">HS {item.hsCode}</Badge>
                </div>

                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Base Price (USD):</span>
                    <span className="font-semibold text-stone-800">${item.basePriceUsdPerMt} / MT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Base Price (INR):</span>
                    <span className="font-semibold text-stone-800">₹{item.basePriceInrPerKg} / kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Annual Growth:</span>
                    <span className="font-semibold text-leaf-700">{item.annualGrowthRate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Logistics Requirement:</span>
                    <span className="font-semibold text-stone-800">{item.containerType}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-100 text-xs">
                  <span className="text-stone-500">Primary Export Corridors:</span>
                  <p className="font-medium text-stone-700 mt-0.5">{item.primaryMarkets?.join(', ')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
