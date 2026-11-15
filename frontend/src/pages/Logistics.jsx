import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api, { errMsg } from '../services/api.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { Spinner, Empty, PageHeader } from '../components/ui.jsx';
import { fmtDate } from '../utils/format.js';

const CONTAINER_SPECS = {
  '20ft Reefer': { maxCapacityKg: 22000, volumeCbm: 28, teu: 1.0, defaultTemp: 4.0 },
  '40ft Reefer': { maxCapacityKg: 26000, volumeCbm: 58, teu: 2.0, defaultTemp: 4.0 },
  '40ft High Cube Reefer': { maxCapacityKg: 29000, volumeCbm: 67, teu: 2.0, defaultTemp: 4.0 }
};

const MILESTONES = [
  'booked',
  'container_allocated',
  'loaded_at_port',
  'in_transit',
  'customs_clearance',
  'arrived_at_destination',
  'delivered'
];

export default function Logistics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState('Shipments & Tracking');
  const [selectedShipment, setSelectedShipment] = useState(null);

  // Modals
  const [showBookModal, setShowBookModal] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showContainerModal, setShowContainerModal] = useState(false);
  const [showTelemetryModal, setShowTelemetryModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showCustomsModal, setShowCustomsModal] = useState(false);
  const [showPodModal, setShowPodModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Data fetching
  const shipmentsApi = useApi('/logistics/shipments');
  const analyticsApi = useApi('/logistics/analytics');

  const reloadAll = () => {
    shipmentsApi.reload();
    analyticsApi.reload();
    if (selectedShipment) {
      api.get(`/logistics/shipments/${selectedShipment._id || selectedShipment.shipmentNumber}`)
        .then((res) => setSelectedShipment(res.data.shipment))
        .catch(() => {});
    }
  };

  // Booking Form State
  const [bookCrop, setBookCrop] = useState('Fresh Table Grapes');
  const [bookGrade, setBookGrade] = useState('A');
  const [bookWeight, setBookWeight] = useState('22000');
  const [bookContainerType, setBookContainerType] = useState('40ft High Cube Reefer');
  const [bookShippingLine, setBookShippingLine] = useState('Maersk Line');
  const [bookVessel, setBookVessel] = useState('Maersk Mc-Kinney');
  const [bookVoyage, setBookVoyage] = useState('2611W');
  const [bookOriginPort, setBookOriginPort] = useState('JNPT Mumbai (Nhava Sheva)');
  const [bookDestPort, setBookDestPort] = useState('Jebel Ali Port, Dubai (UAE)');
  const [bookDestCountry, setBookDestCountry] = useState('UAE');
  const [bookTemp, setBookTemp] = useState('4.0');
  const [bookHumidity, setBookHumidity] = useState('85');

  // Milestone Form State
  const [nextMilestone, setNextMilestone] = useState('in_transit');
  const [milestoneLocation, setMilestoneLocation] = useState('');
  const [milestoneNotes, setMilestoneNotes] = useState('');

  // Container Form State
  const [contId, setContId] = useState('');
  const [sealNo, setSealNo] = useState('');
  const [contAllocWeight, setContAllocWeight] = useState('');
  const [contType, setContType] = useState('40ft High Cube Reefer');

  // Telemetry Form State
  const [telTemp, setTelTemp] = useState('4.2');
  const [telHum, setTelHum] = useState('85');
  const [telPower, setTelPower] = useState('connected');
  const [telLocation, setTelLocation] = useState('Ocean Transit - Arabian Sea');
  const [telSensor, setTelSensor] = useState('REEFER-IOT-01');

  // Doc Form State
  const [docType, setDocType] = useState('phytosanitary_certificate');
  const [docTitle, setDocTitle] = useState('Phytosanitary Certificate of India');
  const [docNumber, setDocNumber] = useState('');
  const [docAuthority, setDocAuthority] = useState('National Plant Protection / APEDA');
  const [docUrl, setDocUrl] = useState('');

  // Customs Form State
  const [originSb, setOriginSb] = useState('');
  const [originStat, setOriginStat] = useState('cleared');
  const [destBoe, setDestBoe] = useState('');
  const [destStat, setDestStat] = useState('cleared');
  const [destDuty, setDestDuty] = useState('0');

  // POD Form State
  const [podRecipient, setPodRecipient] = useState(user?.name || 'Authorized Receiving Agent');
  const [podQuantity, setPodQuantity] = useState('');
  const [podCondition, setPodCondition] = useState('Excellent - Cold Chain Maintained');
  const [podRemarks, setPodRemarks] = useState('Cold chain maintained throughout transit; zero temperature excursions.');

  const shipments = shipmentsApi.data?.shipments || [];
  const analytics = analyticsApi.data || {};
  const fleet = analytics.fleet || {};
  const coldHealth = analytics.coldChainHealth || {};

  // Handlers
  const handleBookShipment = async (e) => {
    e.preventDefault();
    const weight = Number(bookWeight);
    const maxCap = CONTAINER_SPECS[bookContainerType]?.maxCapacityKg || 29000;
    if (weight > maxCap) {
      toast(`Container capacity exceeded: maximum for ${bookContainerType} is ${maxCap.toLocaleString()} kg! Over-allocation prevented.`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/logistics/shipments', {
        cropName: bookCrop,
        grade: bookGrade,
        allocatedWeightKg: weight,
        containerType: bookContainerType,
        shippingLine: bookShippingLine,
        vesselName: bookVessel,
        voyageNumber: bookVoyage,
        originPort: bookOriginPort,
        destinationPort: bookDestPort,
        destinationCountry: bookDestCountry,
        temperatureSetpoint: Number(bookTemp),
        humiditySetpoint: Number(bookHumidity)
      });
      toast(`International Shipment ${res.data.shipment.shipmentNumber} booked successfully!`);
      setShowBookModal(false);
      reloadAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateMilestone = async (e) => {
    e.preventDefault();
    if (!selectedShipment) return;
    setSubmitting(true);
    try {
      await api.patch(`/logistics/shipments/${selectedShipment._id}/milestone`, {
        status: nextMilestone,
        location: milestoneLocation || selectedShipment.destinationPort,
        description: milestoneNotes || `Advanced milestone to ${nextMilestone.replace(/_/g, ' ')}`
      });
      toast(`Milestone updated to ${nextMilestone.replace(/_/g, ' ')}`);
      setShowMilestoneModal(false);
      reloadAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateContainer = async (e) => {
    e.preventDefault();
    if (!selectedShipment) return;
    const maxCap = CONTAINER_SPECS[contType]?.maxCapacityKg || 29000;
    const weight = Number(contAllocWeight || selectedShipment.allocatedWeightKg);
    if (weight > maxCap) {
      toast(`Cannot allocate ${weight} kg to ${contType}. Max capacity is ${maxCap} kg. Over-allocation prevented.`, 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/logistics/shipments/${selectedShipment._id}/container`, {
        containerType: contType,
        containerId: contId,
        sealNumber: sealNo,
        allocatedWeightKg: weight
      });
      toast('Container and seal specifications updated successfully');
      setShowContainerModal(false);
      reloadAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordTelemetry = async (e) => {
    e.preventDefault();
    if (!selectedShipment) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/logistics/shipments/${selectedShipment._id}/cold-chain-log`, {
        temperature: Number(telTemp),
        humidity: Number(telHum),
        powerStatus: telPower,
        location: telLocation,
        sensorId: telSensor
      });
      if (res.data.newAlertsCount > 0) {
        toast(`⚠️ Recorded telemetry: ${res.data.newAlertsCount} cold chain excursion alert(s) triggered!`, 'error');
      } else {
        toast('Cold chain telemetry logged within safe temperature parameters');
      }
      setShowTelemetryModal(false);
      reloadAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveAlert = async (alertId) => {
    if (!selectedShipment) return;
    try {
      await api.patch(`/logistics/shipments/${selectedShipment._id}/cold-chain-alerts/${alertId}/resolve`, {
        resolutionNotes: 'Inspected reefer unit; compressor and setpoint operating normally.'
      });
      toast('Cold chain alert marked resolved');
      reloadAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleSaveDoc = async (e) => {
    e.preventDefault();
    if (!selectedShipment) return;
    setSubmitting(true);
    try {
      await api.post(`/logistics/shipments/${selectedShipment._id}/documents`, {
        docType,
        title: docTitle,
        docNumber,
        issuingAuthority: docAuthority,
        fileUrl: docUrl
      });
      toast('Export document attached to shipment');
      setShowDocModal(false);
      reloadAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyDoc = async (docId) => {
    if (!selectedShipment) return;
    try {
      await api.patch(`/logistics/shipments/${selectedShipment._id}/documents/${docId}/verify`, {
        status: 'verified',
        verificationNotes: 'Port Authority validated and signed'
      });
      toast('Document verified successfully');
      reloadAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const handleSaveCustoms = async (e) => {
    e.preventDefault();
    if (!selectedShipment) return;
    setSubmitting(true);
    try {
      await api.patch(`/logistics/shipments/${selectedShipment._id}/customs`, {
        originShippingBillNumber: originSb,
        originStatus: originStat,
        destBillOfEntryNumber: destBoe,
        destStatus: destStat,
        destDutyAmountPaid: Number(destDuty)
      });
      toast('Customs clearance records updated');
      setShowCustomsModal(false);
      reloadAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPod = async (e) => {
    e.preventDefault();
    if (!selectedShipment) return;
    setSubmitting(true);
    try {
      await api.post(`/logistics/shipments/${selectedShipment._id}/proof-of-delivery`, {
        recipientName: podRecipient,
        receivedQuantityKg: Number(podQuantity || selectedShipment.allocatedWeightKg),
        conditionOnArrival: podCondition,
        remarks: podRemarks
      });
      toast('Proof of Delivery (POD) confirmed! Shipment marked DELIVERED.');
      setShowPodModal(false);
      reloadAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (shipmentsApi.loading && !shipments.length) return <Spinner />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="International Logistics & Reefer Fleet Management"
          subtitle="Reefer container tracking, cold chain monitoring, ocean carrier bookings, and export customs clearance"
        />
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => setShowBookModal(true)}>
            🚢 Book Ocean Shipment
          </button>
          <button className="btn-outline" onClick={reloadAll}>
            🔄 Refresh Telemetry
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="card border-l-4 border-l-blue-600">
          <p className="text-xs font-bold uppercase text-stone-500">Active Shipments</p>
          <p className="mt-1 text-2xl font-black text-blue-900">{fleet.activeShipments || 0}</p>
          <p className="text-xs text-stone-500">{fleet.totalTeus || 0} TEUs ocean transit</p>
        </div>
        <div className="card border-l-4 border-l-emerald-600">
          <p className="text-xs font-bold uppercase text-stone-500">Fleet Utilization</p>
          <p className="mt-1 text-2xl font-black text-emerald-900">{fleet.overallUtilizationPercent || 0}%</p>
          <p className="text-xs text-stone-500">
            {((fleet.totalAllocatedWeightKg || 0) / 1000).toFixed(1)} MT / {((fleet.totalContainerCapacityKg || 0) / 1000).toFixed(1)} MT cap
          </p>
        </div>
        <div className="card border-l-4 border-l-purple-600">
          <p className="text-xs font-bold uppercase text-stone-500">In Transit (Sea)</p>
          <p className="mt-1 text-2xl font-black text-purple-900">{analytics.statusBreakdown?.in_transit || 0}</p>
          <p className="text-xs text-stone-500">Vessels en route to destination</p>
        </div>
        <div className={`card border-l-4 ${coldHealth.activeAlerts > 0 ? 'border-l-red-600 bg-red-50/30' : 'border-l-leaf-600'}`}>
          <p className="text-xs font-bold uppercase text-stone-500">Cold Chain Health</p>
          <p className={`mt-1 text-2xl font-black ${coldHealth.activeAlerts > 0 ? 'text-red-700' : 'text-leaf-800'}`}>
            {coldHealth.avgTransitTemperature || 4.2}°C
          </p>
          <p className="text-xs font-semibold text-stone-500">
            {coldHealth.activeAlerts > 0 ? `⚠️ ${coldHealth.activeAlerts} active alarm(s)` : '✅ Optimal setpoint'}
          </p>
        </div>
        <div className="card border-l-4 border-l-amber-600">
          <p className="text-xs font-bold uppercase text-stone-500">Delivered (POD)</p>
          <p className="mt-1 text-2xl font-black text-amber-900">{analytics.statusBreakdown?.delivered || 0}</p>
          <p className="text-xs text-stone-500">Customs cleared & signed POD</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-2">
        {['Shipments & Tracking', 'Container Fleet & Utilization', 'Cold Chain Telemetry', 'Export Trade Documentation', 'Customs & Delivery Confirmation'].map((t) => (
          <button
            key={t}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
              activeTab === t
                ? 'bg-leaf-700 text-white shadow-sm'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* TAB 1: SHIPMENTS & TRACKING */}
      {activeTab === 'Shipments & Tracking' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-800 text-sm">Ocean Reefer Shipments ({shipments.length})</h3>
            <button className="btn-primary text-xs" onClick={() => setShowBookModal(true)}>
              + New Ocean Booking
            </button>
          </div>

          {!shipments.length ? (
            <Empty
              title="No active ocean shipments"
              hint="Book an international reefer container shipment to begin live sea tracking, container allocation and cold-chain logging."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="border-b bg-stone-50 text-stone-500">
                  <tr>
                    <th className="p-3">Shipment & Carrier</th>
                    <th>Container & Seal</th>
                    <th>Cargo & Weight</th>
                    <th>Ports & Route</th>
                    <th>Status Milestone</th>
                    <th>Cold Chain</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {shipments.map((s) => (
                    <tr key={s._id} className="hover:bg-stone-50/50">
                      <td className="p-3">
                        <div className="font-mono font-bold text-stone-900">{s.shipmentNumber}</div>
                        <div className="text-xs font-semibold text-leaf-800">{s.shippingLine} · {s.vesselName}</div>
                        <div className="text-[11px] text-stone-400 font-mono">BK: {s.bookingReference}</div>
                      </td>
                      <td>
                        <div className="font-mono text-xs font-bold text-purple-900">{s.containerId || 'Unassigned'}</div>
                        <div className="text-xs text-stone-500">{s.containerType}</div>
                        {s.sealNumber && (
                          <div className="text-[10px] text-stone-600 font-mono">Seal: {s.sealNumber}</div>
                        )}
                      </td>
                      <td>
                        <div className="font-bold text-stone-800">{s.cropName} (Grade {s.grade})</div>
                        <div className="text-xs text-stone-600 font-semibold">
                          {(s.allocatedWeightKg || 0).toLocaleString()} kg
                        </div>
                        <div className="text-[10px] text-stone-400">{s.packageCount} {s.packageType}</div>
                      </td>
                      <td>
                        <div className="text-xs font-semibold text-stone-800">{s.originPort}</div>
                        <div className="text-xs text-blue-700 font-bold">➔ {s.destinationPort}</div>
                        <div className="text-[10px] text-stone-400">ETA: {new Date(s.estimatedArrivalDate).toLocaleDateString()}</div>
                      </td>
                      <td>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                          s.status === 'booked' ? 'bg-blue-100 text-blue-800' :
                          s.status === 'container_allocated' ? 'bg-indigo-100 text-indigo-800' :
                          s.status === 'loaded_at_port' ? 'bg-purple-100 text-purple-800' :
                          s.status === 'in_transit' ? 'bg-cyan-100 text-cyan-800' :
                          s.status === 'customs_clearance' ? 'bg-amber-100 text-amber-800' :
                          s.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-stone-100 text-stone-700'
                        }`}>
                          {s.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        {s.hasActiveAlerts ? (
                          <span className="rounded bg-red-100 text-red-800 px-2 py-0.5 text-xs font-bold">
                            ⚠️ Temperature Alert
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-bold">
                            ✅ {s.temperatureSetpoint}°C Normal
                          </span>
                        )}
                      </td>
                      <td className="text-right p-3">
                        <button
                          className="btn-outline text-xs px-2.5 py-1"
                          onClick={() => setSelectedShipment(s)}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CONTAINER FLEET & UTILIZATION */}
      {activeTab === 'Container Fleet & Utilization' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {Object.entries(CONTAINER_SPECS).map(([type, spec]) => {
              const typeData = fleet.containerTypeBreakdown?.[type] || { count: 0, allocatedWeightKg: 0, capacityKg: 0 };
              const cap = typeData.capacityKg || spec.maxCapacityKg;
              const alloc = typeData.allocatedWeightKg || 0;
              const pct = cap > 0 ? Math.min(100, Math.round((alloc / cap) * 100)) : 0;

              return (
                <div key={type} className="card border-t-4 border-t-leaf-600 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between">
                      <h4 className="font-bold text-stone-900">{type}</h4>
                      <span className="rounded bg-leaf-100 text-leaf-800 px-2 py-0.5 text-[10px] font-bold">
                        {spec.teu} TEU
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1">
                      Payload: <b>{(spec.maxCapacityKg / 1000).toFixed(0)} Metric Tons</b> · Volume: <b>{spec.volumeCbm} CBM</b>
                    </p>
                    <div className="mt-4">
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span>Utilization</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="w-full bg-stone-200 rounded-full h-2.5">
                        <div
                          className={`h-2.5 rounded-full ${pct > 90 ? 'bg-amber-500' : 'bg-leaf-600'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-stone-500 mt-2">
                        {alloc.toLocaleString()} kg allocated / {cap.toLocaleString()} kg capacity
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t text-xs text-stone-600 flex justify-between items-center">
                    <span>Active Containers: <b>{typeData.count}</b></span>
                    <span className="text-[11px] text-emerald-700 font-bold">Over-allocation Guard: Active</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card bg-stone-50">
            <h4 className="font-bold text-stone-800 text-sm mb-2">🛡️ Strict Container Over-Allocation Protection Rule</h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              International maritime safety rules (SOLAS Verified Gross Mass) and reefer compressor airflow requirements require that cargo weight never exceeds the certified payload limit (22,000 kg for 20ft Reefer, 26,000 kg for 40ft Reefer, and 29,000 kg for 40ft High Cube). The AgriGlobal logistics engine strictly blocks any container stuffing or allocation request exceeding the maximum certified tare-to-payload limit.
            </p>
          </div>
        </div>
      )}

      {/* TAB 3: COLD CHAIN TELEMETRY */}
      {activeTab === 'Cold Chain Telemetry' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-stone-800 text-sm">Cold Chain Reefer Monitoring & Real-Time Alerts</h3>
              <p className="text-xs text-stone-500">Live telemetry from reefer IoT data loggers and container gensets</p>
            </div>
            {selectedShipment && (
              <button className="btn-primary text-xs" onClick={() => setShowTelemetryModal(true)}>
                + Record Sensor Telemetry
              </button>
            )}
          </div>

          {!selectedShipment ? (
            <Empty
              title="Select a shipment to inspect cold chain"
              hint="Click 'View Details' on any shipment in the Shipments tab to view its real-time temperature logs and sensor telemetry."
            />
          ) : (
            <div className="space-y-6">
              {/* Selected Shipment Header */}
              <div className="card bg-stone-50 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="font-mono font-bold text-stone-900 text-base">{selectedShipment.shipmentNumber}</span>
                  <span className="ml-2 text-xs text-stone-600">Container: <b>{selectedShipment.containerId || 'Unallocated'}</b></span>
                  <p className="text-xs text-stone-500 mt-1">
                    Commodity: <b>{selectedShipment.cropName}</b> · Target Setpoint: <b>{selectedShipment.temperatureSetpoint}°C</b> (Allowed: {selectedShipment.temperatureMinAllowed}°C - {selectedShipment.temperatureMaxAllowed}°C)
                  </p>
                </div>
                <button className="btn-primary text-xs" onClick={() => setShowTelemetryModal(true)}>
                  + Log Sensor Reading
                </button>
              </div>

              {/* Active Alarms */}
              {selectedShipment.coldChainAlerts?.length > 0 && (
                <div className="card border-l-4 border-l-red-600 bg-red-50/20">
                  <h4 className="font-bold text-red-900 text-sm mb-3">⚠️ Cold Chain Alerts & Excursion Log</h4>
                  <div className="space-y-2">
                    {selectedShipment.coldChainAlerts.map((a) => (
                      <div key={a.alertId} className="flex flex-wrap items-center justify-between gap-2 p-2 bg-white rounded border border-red-200 text-xs">
                        <div>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase mr-2 ${
                            a.severity === 'critical' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                          }`}>
                            {a.severity}
                          </span>
                          <span className="font-mono font-bold text-stone-800">{a.alertId}</span>
                          <p className="text-stone-700 mt-0.5">{a.message}</p>
                          <span className="text-[10px] text-stone-400">{fmtDate(a.timestamp)}</span>
                        </div>
                        {a.resolved ? (
                          <span className="rounded bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-bold">
                            ✅ Resolved ({a.resolutionNotes})
                          </span>
                        ) : (
                          <button
                            className="btn-outline text-xs text-red-700 border-red-300 hover:bg-red-50"
                            onClick={() => handleResolveAlert(a.alertId)}
                          >
                            Resolve Alert
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Telemetry Log Table */}
              <div className="card">
                <h4 className="font-bold text-stone-800 text-sm mb-3">Telemetry Readings</h4>
                {!selectedShipment.telemetryLogs?.length ? (
                  <p className="text-xs text-stone-500">No telemetry readings recorded yet. Click 'Log Sensor Reading' to record live data.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b bg-stone-50 text-stone-500">
                        <tr>
                          <th className="p-2">Timestamp</th>
                          <th>Temperature</th>
                          <th>Humidity</th>
                          <th>Power Status</th>
                          <th>Battery</th>
                          <th>Location / Sensor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {selectedShipment.telemetryLogs.map((log) => {
                          const isExcursion = log.temperature > selectedShipment.temperatureMaxAllowed || log.temperature < selectedShipment.temperatureMinAllowed;
                          return (
                            <tr key={log._id} className={isExcursion ? 'bg-red-50/50' : ''}>
                              <td className="p-2 font-mono">{fmtDate(log.timestamp)}</td>
                              <td className={`font-bold ${isExcursion ? 'text-red-700' : 'text-emerald-700'}`}>
                                {log.temperature}°C
                              </td>
                              <td>{log.humidity}%</td>
                              <td>
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                  log.powerStatus === 'connected' ? 'bg-emerald-100 text-emerald-800' :
                                  log.powerStatus === 'genset' ? 'bg-blue-100 text-blue-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {log.powerStatus}
                                </span>
                              </td>
                              <td>{log.batteryPercent}%</td>
                              <td className="text-stone-600">{log.location} ({log.sensorId})</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: EXPORT TRADE DOCUMENTATION */}
      {activeTab === 'Export Trade Documentation' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-stone-800 text-sm">International Agro Export Trade Documents</h3>
              <p className="text-xs text-stone-500">Mandatory trade documentation checklist for customs and international clearance</p>
            </div>
            {selectedShipment && (
              <button className="btn-primary text-xs" onClick={() => setShowDocModal(true)}>
                + Upload / Attach Document
              </button>
            )}
          </div>

          {!selectedShipment ? (
            <Empty
              title="Select a shipment to inspect export documentation"
              hint="Select a shipment from the Shipments tab to view or verify its Phytosanitary Certificate, Certificate of Origin, Bill of Lading, etc."
            />
          ) : (
            <div className="space-y-4">
              <div className="card bg-stone-50">
                <span className="font-mono font-bold text-stone-900">{selectedShipment.shipmentNumber}</span>
                <span className="ml-2 text-xs text-stone-600">Commodity: <b>{selectedShipment.cropName}</b> to <b>{selectedShipment.destinationCountry || selectedShipment.destinationPort}</b></span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {selectedShipment.documents?.map((d) => (
                  <div key={d._id || d.docType} className="card flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between">
                        <h4 className="font-bold text-stone-800 text-sm">{d.title}</h4>
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          d.status === 'verified' ? 'bg-emerald-100 text-emerald-800' :
                          d.status === 'issued' ? 'bg-blue-100 text-blue-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {d.status}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 mt-1">
                        Issuing Authority: <b>{d.issuingAuthority || 'Govt Authority'}</b>
                      </p>
                      {d.docNumber && (
                        <p className="text-xs font-mono font-semibold text-stone-700 mt-2">
                          Doc #: {d.docNumber}
                        </p>
                      )}
                      {d.fileUrl && (
                        <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline mt-1 block">
                          📄 View Document PDF
                        </a>
                      )}
                    </div>
                    <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs">
                      <span className="text-stone-400 text-[10px]">
                        {d.verifiedAt ? `Verified: ${new Date(d.verifiedAt).toLocaleDateString()}` : 'Pending verification'}
                      </span>
                      {d.status !== 'verified' && user?.role === 'admin' && (
                        <button
                          className="btn-primary text-xs px-2.5 py-1"
                          onClick={() => handleVerifyDoc(d._id || d.docType)}
                        >
                          Verify Doc
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: CUSTOMS & DELIVERY CONFIRMATION */}
      {activeTab === 'Customs & Delivery Confirmation' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-stone-800 text-sm">Customs Clearances & Importer Proof of Delivery (POD)</h3>
              <p className="text-xs text-stone-500">Origin customs, destination port customs, and final buyer receipt</p>
            </div>
            {selectedShipment && (
              <div className="flex gap-2">
                <button className="btn-outline text-xs" onClick={() => setShowCustomsModal(true)}>
                  🛂 Update Customs Status
                </button>
                <button className="btn-primary text-xs" onClick={() => setShowPodModal(true)}>
                  ✍️ Confirm Delivery & Sign POD
                </button>
              </div>
            )}
          </div>

          {!selectedShipment ? (
            <Empty
              title="Select a shipment to view customs & delivery"
              hint="Select a shipment from the Shipments tab to inspect Indian customs shipping bill, destination bill of entry, and Proof of Delivery (POD)."
            />
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Origin Customs */}
                <div className="card">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-stone-800 text-sm">🇮🇳 Origin Customs (ICEGATE India)</h4>
                    <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${
                      selectedShipment.originCustoms?.status === 'cleared' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {selectedShipment.originCustoms?.status || 'Pending'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600">
                    Shipping Bill Number: <b>{selectedShipment.originCustoms?.shippingBillNumber || 'Pending Filing'}</b>
                  </p>
                  <p className="text-xs text-stone-600 mt-1">
                    Port of Export: <b>{selectedShipment.originPort}</b>
                  </p>
                  <p className="text-xs text-stone-500 mt-2">
                    Remarks: {selectedShipment.originCustoms?.inspectionRemarks || 'Export examination passed with phytosanitary inspection.'}
                  </p>
                </div>

                {/* Destination Customs */}
                <div className="card">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-stone-800 text-sm">🌐 Destination Customs ({selectedShipment.destinationCountry || 'Destination'})</h4>
                    <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${
                      selectedShipment.destinationCustoms?.status === 'cleared' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {selectedShipment.destinationCustoms?.status || 'Pending'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600">
                    Bill of Entry: <b>{selectedShipment.destinationCustoms?.billOfEntryNumber || 'Pending Arrival'}</b>
                  </p>
                  <p className="text-xs text-stone-600 mt-1">
                    Port of Discharge: <b>{selectedShipment.destinationPort}</b>
                  </p>
                  <p className="text-xs text-stone-500 mt-2">
                    Duty Assessment: {selectedShipment.destinationCustoms?.dutyAmountPaid ? `₹${selectedShipment.destinationCustoms.dutyAmountPaid} Paid` : 'Duty Exemption / Agro FTA Applied'}
                  </p>
                </div>
              </div>

              {/* Proof of Delivery (POD) */}
              <div className="card border-l-4 border-l-emerald-600">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-stone-900 text-sm">📦 Importer Proof of Delivery (POD)</h4>
                  <span className={`rounded px-2.5 py-0.5 text-xs font-bold uppercase ${
                    selectedShipment.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-700'
                  }`}>
                    {selectedShipment.status === 'delivered' ? 'Delivered & Accepted' : 'In Transit / Awaiting Arrival'}
                  </span>
                </div>
                {selectedShipment.proofOfDelivery?.deliveredAt ? (
                  <div className="grid gap-2 sm:grid-cols-2 text-xs">
                    <div>
                      <p className="text-stone-500">Recipient Consignee: <b>{selectedShipment.proofOfDelivery.recipientName}</b></p>
                      <p className="text-stone-500 mt-1">Received Volume: <b>{selectedShipment.proofOfDelivery.receivedQuantityKg?.toLocaleString()} kg</b></p>
                      <p className="text-stone-500 mt-1">Condition on Arrival: <b className="text-emerald-800">{selectedShipment.proofOfDelivery.conditionOnArrival}</b></p>
                    </div>
                    <div>
                      <p className="text-stone-500">Delivery Reference: <b className="font-mono">{selectedShipment.proofOfDelivery.acknowledgmentRef}</b></p>
                      <p className="text-stone-500 mt-1">Delivered Date: <b>{fmtDate(selectedShipment.proofOfDelivery.deliveredAt)}</b></p>
                      <p className="text-stone-500 mt-1">Consignee Notes: {selectedShipment.proofOfDelivery.remarks}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-stone-500">Consignee delivery confirmation is pending arrival at destination cold store.</p>
                    <button className="btn-primary text-xs" onClick={() => setShowPodModal(true)}>
                      Sign Proof of Delivery (POD)
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: SHIPMENT DETAILS & TRACKING TIMELINE */}
      {selectedShipment && (
        <div className="card border-2 border-leaf-700 bg-white shadow-xl">
          <div className="flex items-start justify-between border-b pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-stone-900 text-lg">{selectedShipment.shipmentNumber}</h3>
                <span className="rounded bg-leaf-100 text-leaf-800 px-2 py-0.5 text-xs font-bold uppercase">
                  {selectedShipment.status?.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Carrier: <b>{selectedShipment.shippingLine}</b> · Vessel: <b>{selectedShipment.vesselName} ({selectedShipment.voyageNumber})</b> · Booking: <b>{selectedShipment.bookingReference}</b>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="btn-primary text-xs"
                onClick={() => {
                  setNextMilestone(selectedShipment.status === 'booked' ? 'container_allocated' : 'in_transit');
                  setShowMilestoneModal(true);
                }}
              >
                Advance Milestone
              </button>
              <button
                className="btn-outline text-xs"
                onClick={() => {
                  setContId(selectedShipment.containerId || '');
                  setSealNo(selectedShipment.sealNumber || '');
                  setContAllocWeight(selectedShipment.allocatedWeightKg || '');
                  setContType(selectedShipment.containerType || '40ft High Cube Reefer');
                  setShowContainerModal(true);
                }}
              >
                Reefer Specs
              </button>
              <button className="text-stone-400 hover:text-stone-700 text-lg px-2" onClick={() => setSelectedShipment(null)}>
                ✕
              </button>
            </div>
          </div>

          {/* Milestone Pipeline */}
          <div className="my-6 overflow-x-auto pb-2">
            <div className="flex items-center min-w-[750px] justify-between">
              {MILESTONES.map((m, idx) => {
                const currentIdx = MILESTONES.indexOf(selectedShipment.status);
                const isPassed = currentIdx >= idx;
                const isCurrent = currentIdx === idx;
                return (
                  <div key={m} className="flex-1 flex items-center">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCurrent ? 'bg-leaf-700 text-white ring-4 ring-leaf-100' :
                        isPassed ? 'bg-emerald-600 text-white' :
                        'bg-stone-200 text-stone-500'
                      }`}>
                        {idx + 1}
                      </div>
                      <span className={`text-[10px] font-bold uppercase mt-1 text-center ${isPassed ? 'text-stone-800' : 'text-stone-400'}`}>
                        {m.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {idx < MILESTONES.length - 1 && (
                      <div className={`flex-1 h-1 mx-2 ${currentIdx > idx ? 'bg-emerald-600' : 'bg-stone-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline Event Log */}
          <div className="border-t pt-4">
            <h4 className="font-bold text-stone-800 text-xs uppercase mb-3">Milestone Event Log</h4>
            <div className="space-y-2">
              {selectedShipment.timeline?.map((ev) => (
                <div key={ev._id} className="flex items-start gap-3 text-xs p-2 bg-stone-50 rounded">
                  <span className="font-mono text-stone-400 min-w-[130px]">{fmtDate(ev.recordedAt)}</span>
                  <span className="font-bold uppercase text-leaf-800 min-w-[140px]">{ev.status?.replace(/_/g, ' ')}</span>
                  <span className="text-stone-600 font-medium">📍 {ev.location}</span>
                  <span className="text-stone-700 flex-1">— {ev.description}</span>
                  <span className="text-stone-400 text-[10px]">By {ev.recordedBy}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BOOK SHIPMENT */}
      {showBookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-2 mb-4">
              <h3 className="font-bold text-stone-900 text-base">🚢 Book International Ocean Shipment</h3>
              <button className="text-stone-400 hover:text-stone-700" onClick={() => setShowBookModal(false)}>✕</button>
            </div>
            <form onSubmit={handleBookShipment} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Crop Name</label>
                  <input className="input w-full" value={bookCrop} onChange={(e) => setBookCrop(e.target.value)} required />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Grade</label>
                  <select className="input w-full" value={bookGrade} onChange={(e) => setBookGrade(e.target.value)}>
                    <option value="A">Grade A (Export Prime)</option>
                    <option value="B">Grade B (Standard)</option>
                    <option value="Organic">Organic Certified</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Reefer Container Type</label>
                  <select
                    className="input w-full"
                    value={bookContainerType}
                    onChange={(e) => {
                      setBookContainerType(e.target.value);
                      const max = CONTAINER_SPECS[e.target.value]?.maxCapacityKg;
                      if (Number(bookWeight) > max) setBookWeight(String(max));
                    }}
                  >
                    <option value="20ft Reefer">20ft Reefer (Max: 22,000 kg)</option>
                    <option value="40ft Reefer">40ft Reefer (Max: 26,000 kg)</option>
                    <option value="40ft High Cube Reefer">40ft HC Reefer (Max: 29,000 kg)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">
                    Allocated Weight (kg) <span className="text-stone-400 font-normal">Max: {CONTAINER_SPECS[bookContainerType]?.maxCapacityKg} kg</span>
                  </label>
                  <input
                    type="number"
                    className="input w-full"
                    value={bookWeight}
                    max={CONTAINER_SPECS[bookContainerType]?.maxCapacityKg}
                    onChange={(e) => setBookWeight(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Shipping Line</label>
                  <select className="input w-full" value={bookShippingLine} onChange={(e) => setBookShippingLine(e.target.value)}>
                    <option value="Maersk Line">Maersk Line</option>
                    <option value="MSC">MSC</option>
                    <option value="CMA CGM">CMA CGM</option>
                    <option value="Hapag-Lloyd">Hapag-Lloyd</option>
                    <option value="ONE">ONE</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Vessel Name</label>
                  <input className="input w-full" value={bookVessel} onChange={(e) => setBookVessel(e.target.value)} required />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Voyage Number</label>
                  <input className="input w-full" value={bookVoyage} onChange={(e) => setBookVoyage(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Origin Port</label>
                  <select className="input w-full" value={bookOriginPort} onChange={(e) => setBookOriginPort(e.target.value)}>
                    <option value="JNPT Mumbai (Nhava Sheva)">JNPT Mumbai (Nhava Sheva)</option>
                    <option value="Mundra Port">Mundra Port</option>
                    <option value="Chennai Port">Chennai Port</option>
                    <option value="Cochin Port">Cochin Port</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Destination Port</label>
                  <input className="input w-full" value={bookDestPort} onChange={(e) => setBookDestPort(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Temperature Setpoint (°C)</label>
                  <input type="number" step="0.5" className="input w-full" value={bookTemp} onChange={(e) => setBookTemp(e.target.value)} required />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Humidity Setpoint (%)</label>
                  <input type="number" className="input w-full" value={bookHumidity} onChange={(e) => setBookHumidity(e.target.value)} required />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" className="btn-outline" onClick={() => setShowBookModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Booking...' : 'Confirm Ocean Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADVANCE MILESTONE */}
      {showMilestoneModal && selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md bg-white shadow-2xl">
            <h3 className="font-bold text-stone-900 text-sm mb-3">Advance Shipment Milestone</h3>
            <form onSubmit={handleUpdateMilestone} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">Next Milestone</label>
                <select className="input w-full" value={nextMilestone} onChange={(e) => setNextMilestone(e.target.value)}>
                  {MILESTONES.map((m) => (
                    <option key={m} value={m}>{m.replace(/_/g, ' ').toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Current Geographic Location</label>
                <input className="input w-full" value={milestoneLocation} onChange={(e) => setMilestoneLocation(e.target.value)} placeholder="e.g. Arabian Sea / Jebel Ali Berth 4" required />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Milestone Description / Remarks</label>
                <textarea className="input w-full" rows="3" value={milestoneNotes} onChange={(e) => setMilestoneNotes(e.target.value)} placeholder="Details regarding customs clearance, vessel departure or container discharge..." />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" className="btn-outline" onClick={() => setShowMilestoneModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Updating...' : 'Save Milestone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UPDATE CONTAINER */}
      {showContainerModal && selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md bg-white shadow-2xl">
            <h3 className="font-bold text-stone-900 text-sm mb-3">Assign Container & Customs Seal</h3>
            <form onSubmit={handleUpdateContainer} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">Container Type</label>
                <select className="input w-full" value={contType} onChange={(e) => setContType(e.target.value)}>
                  <option value="20ft Reefer">20ft Reefer (Max: 22,000 kg)</option>
                  <option value="40ft Reefer">40ft Reefer (Max: 26,000 kg)</option>
                  <option value="40ft High Cube Reefer">40ft HC Reefer (Max: 29,000 kg)</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Container ID (ISO 6346)</label>
                <input className="input w-full font-mono" value={contId} onChange={(e) => setContId(e.target.value)} placeholder="e.g. MSKU-819204-5" required />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">High Security Customs Seal Number</label>
                <input className="input w-full font-mono" value={sealNo} onChange={(e) => setSealNo(e.target.value)} placeholder="e.g. SL-CUSTOMS-9102" required />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Allocated Weight (kg)</label>
                <input type="number" className="input w-full" value={contAllocWeight} onChange={(e) => setContAllocWeight(e.target.value)} max={CONTAINER_SPECS[contType]?.maxCapacityKg} required />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" className="btn-outline" onClick={() => setShowContainerModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>Save Container</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LOG SENSOR TELEMETRY */}
      {showTelemetryModal && selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md bg-white shadow-2xl">
            <h3 className="font-bold text-stone-900 text-sm mb-3">Record Cold Chain Sensor Reading</h3>
            <form onSubmit={handleRecordTelemetry} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Temperature (°C)</label>
                  <input type="number" step="0.1" className="input w-full" value={telTemp} onChange={(e) => setTelTemp(e.target.value)} required />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Humidity (%)</label>
                  <input type="number" className="input w-full" value={telHum} onChange={(e) => setTelHum(e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Reefer Power Status</label>
                  <select className="input w-full" value={telPower} onChange={(e) => setTelPower(e.target.value)}>
                    <option value="connected">Vessel Reefer Plug (Connected)</option>
                    <option value="genset">Clip-On Genset Running</option>
                    <option value="battery">Backup Battery</option>
                    <option value="interrupted">⚠️ Power Interrupted</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Sensor ID</label>
                  <input className="input w-full font-mono" value={telSensor} onChange={(e) => setTelSensor(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Transit Location</label>
                <input className="input w-full" value={telLocation} onChange={(e) => setTelLocation(e.target.value)} required />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" className="btn-outline" onClick={() => setShowTelemetryModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>Log Reading</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UPLOAD DOC */}
      {showDocModal && selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md bg-white shadow-2xl">
            <h3 className="font-bold text-stone-900 text-sm mb-3">Attach Export Trade Document</h3>
            <form onSubmit={handleSaveDoc} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">Document Type</label>
                <select className="input w-full" value={docType} onChange={(e) => {
                  setDocType(e.target.value);
                  if (e.target.value === 'phytosanitary_certificate') setDocTitle('Phytosanitary Certificate of India');
                  if (e.target.value === 'certificate_of_origin') setDocTitle('Certificate of Origin');
                  if (e.target.value === 'bill_of_lading') setDocTitle('Ocean Bill of Lading');
                  if (e.target.value === 'commercial_invoice') setDocTitle('Commercial Export Invoice');
                  if (e.target.value === 'packing_list') setDocTitle('Export Packing List');
                  if (e.target.value === 'quality_lab_certificate') setDocTitle('SGS Quality & Residue Analysis');
                }}>
                  <option value="phytosanitary_certificate">Phytosanitary Certificate</option>
                  <option value="certificate_of_origin">Certificate of Origin</option>
                  <option value="bill_of_lading">Bill of Lading</option>
                  <option value="commercial_invoice">Commercial Invoice</option>
                  <option value="packing_list">Packing List</option>
                  <option value="quality_lab_certificate">Quality & Lab Test Certificate</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Document Number</label>
                <input className="input w-full font-mono" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="e.g. PHYTO-IN-2026-9812" required />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Issuing Authority</label>
                <input className="input w-full" value={docAuthority} onChange={(e) => setDocAuthority(e.target.value)} required />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Document File URL</label>
                <input className="input w-full" value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="https://storage.agriglobal.test/docs/doc.pdf" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" className="btn-outline" onClick={() => setShowDocModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>Attach Document</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CUSTOMS */}
      {showCustomsModal && selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md bg-white shadow-2xl">
            <h3 className="font-bold text-stone-900 text-sm mb-3">Update Customs Clearance</h3>
            <form onSubmit={handleSaveCustoms} className="space-y-3 text-xs">
              <div className="border-b pb-2">
                <h4 className="font-bold text-stone-700 mb-2">Origin Customs (ICEGATE India)</h4>
                <div className="grid grid-cols-2 gap-2">
                  <input className="input w-full font-mono" value={originSb} onChange={(e) => setOriginSb(e.target.value)} placeholder="Shipping Bill #" />
                  <select className="input w-full" value={originStat} onChange={(e) => setOriginStat(e.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="inspected">Inspected</option>
                    <option value="cleared">Cleared</option>
                    <option value="held">Held</option>
                  </select>
                </div>
              </div>
              <div>
                <h4 className="font-bold text-stone-700 mb-2">Destination Port Customs</h4>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input className="input w-full font-mono" value={destBoe} onChange={(e) => setDestBoe(e.target.value)} placeholder="Bill of Entry #" />
                  <select className="input w-full" value={destStat} onChange={(e) => setDestStat(e.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="duty_assessed">Duty Assessed</option>
                    <option value="cleared">Cleared</option>
                    <option value="held">Held</option>
                  </select>
                </div>
                <input type="number" className="input w-full" value={destDuty} onChange={(e) => setDestDuty(e.target.value)} placeholder="Duty Amount Paid (INR)" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" className="btn-outline" onClick={() => setShowCustomsModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>Save Customs Status</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: POD */}
      {showPodModal && selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md bg-white shadow-2xl">
            <h3 className="font-bold text-stone-900 text-sm mb-3">Sign Importer Proof of Delivery (POD)</h3>
            <form onSubmit={handleConfirmPod} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">Recipient Name / Consignee</label>
                <input className="input w-full" value={podRecipient} onChange={(e) => setPodRecipient(e.target.value)} required />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Received Weight (kg)</label>
                <input type="number" className="input w-full" value={podQuantity || selectedShipment.allocatedWeightKg} onChange={(e) => setPodQuantity(e.target.value)} required />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Cargo Condition upon Unloading</label>
                <select className="input w-full" value={podCondition} onChange={(e) => setPodCondition(e.target.value)}>
                  <option value="Excellent - Cold Chain Maintained">Excellent - Cold Chain Maintained</option>
                  <option value="Good">Good (Commercial Grade Accepted)</option>
                  <option value="Minor Temperature Deviation">Minor Temperature Deviation</option>
                  <option value="Damaged">Damaged</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1">Delivery Notes / Cold Chain Inspection Report</label>
                <textarea className="input w-full" rows="3" value={podRemarks} onChange={(e) => setPodRemarks(e.target.value)} required />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" className="btn-outline" onClick={() => setShowPodModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>Confirm Delivery & Sign POD</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
