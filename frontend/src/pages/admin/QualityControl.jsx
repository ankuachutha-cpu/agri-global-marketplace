import { useState, useEffect } from 'react';
import api, { errMsg } from '../../services/api.js';

export default function QualityControl() {
  const [qcRecords, setQcRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchQC = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin-portal/quality-control');
      setQcRecords(res.data.qcRecords || []);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQC();
  }, []);

  const totalAcceptedKg = qcRecords.reduce((sum, r) => sum + (r.acceptedQuantityKg || 0), 0);
  const totalRejectedKg = qcRecords.reduce((sum, r) => sum + (r.rejectedQuantityKg || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚖️</span>
            <h1 className="text-2xl font-black text-stone-900">Quality Control & Weighbridge Inspections</h1>
          </div>
          <p className="mt-1 text-sm text-stone-600">
            Certified on-farm electronic weighbridge results, moisture compliance, grading standards, and rejection ledgers.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-bold uppercase text-stone-500">Total Inspections</span>
          <div className="mt-2 text-3xl font-black text-stone-900 font-mono">
            {qcRecords.length}
          </div>
          <p className="mt-1 text-xs text-stone-500">Farms surveyed on-site</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
          <span className="text-xs font-bold uppercase text-emerald-800">Total Produce Accepted</span>
          <div className="mt-2 text-3xl font-black text-emerald-950 font-mono">
            {totalAcceptedKg.toLocaleString()} <span className="text-xs font-normal text-emerald-700">kg</span>
          </div>
          <p className="mt-1 text-xs text-emerald-700">{(totalAcceptedKg / 1000).toFixed(1)} MT passed QC</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-bold uppercase text-stone-500">Rejected & Returned</span>
          <div className="mt-2 text-3xl font-black text-stone-700 font-mono">
            {totalRejectedKg.toLocaleString()} <span className="text-xs font-normal text-stone-500">kg</span>
          </div>
          <p className="mt-1 text-xs text-stone-500">Returned to farmer free stock</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-stone-500">Loading quality records...</div>
      ) : qcRecords.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">
          No QC inspections completed yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-stone-700">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs font-bold uppercase text-stone-600">
              <tr>
                <th className="px-6 py-4">Consignment & Crop</th>
                <th className="px-6 py-4">Farmer Origin</th>
                <th className="px-6 py-4">Actual Weighed</th>
                <th className="px-6 py-4">Accepted Quantity</th>
                <th className="px-6 py-4">Rejected Quantity</th>
                <th className="px-6 py-4">QC Grade</th>
                <th className="px-6 py-4">Driver & Vehicle</th>
                <th className="px-6 py-4">Inspection Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {qcRecords.map((r, idx) => (
                <tr key={idx} className="hover:bg-stone-50/70 transition">
                  <td className="px-6 py-4 font-bold text-stone-900">
                    <span className="font-mono text-stone-500 block text-xs">#{r.requirementId}</span>
                    {r.cropName}
                  </td>
                  <td className="px-6 py-4 font-semibold text-stone-900">
                    {r.farmerName}
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-stone-900">
                    {r.actualWeighedKg.toLocaleString()} kg
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-emerald-700">
                    {r.acceptedQuantityKg.toLocaleString()} kg
                  </td>
                  <td className="px-6 py-4 font-mono text-stone-600">
                    {r.rejectedQuantityKg.toLocaleString()} kg
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">
                      {r.qcGrade}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-stone-600">
                    <div>{r.driverName || 'Driver'}</div>
                    <div className="font-mono text-stone-400">{r.vehicleNumber}</div>
                  </td>
                  <td className="px-6 py-4 text-xs text-stone-600 max-w-[240px]">
                    {r.collectionNotes}
                    {r.collectedAt && (
                      <span className="block text-stone-400 mt-0.5">
                        {new Date(r.collectedAt).toLocaleDateString()}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
