import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { PageHeader } from '../components/ui.jsx';

const CROPS = [
  { name: 'Ragi (Finger Millet)', icon: '🌾', desc: 'Native Karnataka finger millet, rich in calcium, export grade moisture compliant.' },
  { name: 'Rice (Sona Masoori)', icon: '🍚', desc: 'Premium aged single boiled raw rice, machine sortexed and packaged.' },
  { name: 'Jowar (Sorghum)', icon: '🌽', desc: 'White Maldandi sorghum, high nutrition grain, suitable for bulk food processing.' }
];

const WORKFLOW = [
  { step: '1', title: 'Farmers Upload Harvest', desc: 'Farmers enter available quantity (kg, quintal, tonne), grade, and live GPS farm pin. Zero complex negotiations.' },
  { step: '2', title: 'Buyers Post Bulk Demands', desc: 'Institutional buyers specify required metric tons of Ragi, Rice, or Jowar with budget and destination facility.' },
  { step: '3', title: 'Automated Platform Matching', desc: 'The middleman engine instantly splits and atomically allocates volume across 2–3 compatible nearby farmers.' },
  { step: '4', title: 'Fleet Collection & Farm Weighing', desc: 'A dedicated carrier truck follows the multi-farm route, weighs produce on-site, logs QC, and dispatches to buyer.' },
  { step: '5', title: 'Buyer Receipt & Settlement', desc: 'Buyer confirms dock delivery; platform immediately releases transparent farmer payouts via direct UPI / NEFT.' }
];

export function Home() {
  const { user } = useAuth();

  return (
    <div className="space-y-12">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-800 to-leaf-950 px-6 py-20 text-white sm:px-12 shadow-md">
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 text-[14rem] opacity-10">🌾</div>
        <p className="mb-3 inline-block rounded-full bg-leaf-500/20 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-leaf-300">
          Automated Agricultural Procurement & Aggregation Platform
        </p>
        <h1 className="max-w-3xl text-3xl font-black leading-tight sm:text-5xl">
          Automated Farm-to-Buyer Procurement, Multi-Farm Consolidation & Logistics
        </h1>
        <p className="mt-4 max-w-2xl text-stone-300 text-base leading-relaxed">
          The platform operates as the central procurement intermediary. Farmers register their harvest, bulk buyers place volume demands, and our automated engine coordinates atomic stock reservation, multi-farm vehicle collection, weighbridge QC, and instant bank settlements.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {user ? (
            <Link
              to={user.role === 'farmer' ? '/farmer/dashboard' : user.role === 'buyer' ? '/buyer/dashboard' : '/admin/dashboard'}
              className="rounded-xl bg-leaf-600 px-6 py-3 font-bold text-white shadow-sm hover:bg-leaf-500 transition"
            >
              Go to Your {user.role.toUpperCase()} Portal &rarr;
            </Link>
          ) : (
            <>
              <Link to="/login" className="rounded-xl bg-white px-6 py-3 font-bold text-stone-900 shadow-sm hover:bg-stone-100 transition">
                Sign In to Portal
              </Link>
              <Link to="/register" className="rounded-xl border border-stone-600 bg-stone-800 px-6 py-3 font-bold text-white hover:bg-stone-700 transition">
                Create Free Account
              </Link>
            </>
          )}
        </div>
      </section>

      {/* 3 Dedicated Portals Overview */}
      <section className="space-y-4">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-black text-stone-900">Three Dedicated Operational Portals</h2>
          <p className="mt-1 text-sm text-stone-600">
            Tailored interfaces designed for streamlined agricultural procurement without clutter.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-3">
            <span className="text-4xl">👨‍🌾</span>
            <h3 className="text-lg font-bold text-stone-900">1. Farmer Portal</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Upload available Ragi, Rice, and Jowar produce with live GPS farm coordinates. Monitor automated buyer allocations, track scheduled truck pickups, and view transparent UPI/NEFT earnings. <em>No accept/reject hassles.</em>
            </p>
            <div className="pt-2">
              <Link to="/login" className="text-xs font-bold text-leaf-700 hover:underline">
                Open Farmer Portal &rarr;
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-3">
            <span className="text-4xl">🏢</span>
            <h3 className="text-lg font-bold text-stone-900">2. Buyer Portal</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Post bulk procurement requirements (MT) with grade specifications and destination warehouses. Sourcing engine instantly reserves quantities across 2–3 farmers. Inspect and confirm delivery receipts.
            </p>
            <div className="pt-2">
              <Link to="/login" className="text-xs font-bold text-leaf-700 hover:underline">
                Open Buyer Portal &rarr;
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-3">
            <span className="text-4xl">🏛️</span>
            <h3 className="text-lg font-bold text-stone-900">3. Admin Portal</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Complete oversight of farmers, buyers, centralized inventory, vehicle capacity allocation, multi-farm pickup routes, on-farm electronic weighbridge QC, and financial ledger release.
            </p>
            <div className="pt-2">
              <Link to="/login" className="text-xs font-bold text-leaf-700 hover:underline">
                Open Admin Portal &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Allowed Crops */}
      <section className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm space-y-6">
        <div>
          <h2 className="text-xl font-black text-stone-900">Specialized Crop Focus</h2>
          <p className="mt-1 text-sm text-stone-600">
            Platform operations are strictly focused on Karnataka's staple grain and millet procurement:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CROPS.map((crop) => (
            <div key={crop.name} className="rounded-xl border border-stone-100 bg-stone-50/70 p-4 space-y-1">
              <span className="text-3xl">{crop.icon}</span>
              <h4 className="font-bold text-stone-900 text-sm">{crop.name}</h4>
              <p className="text-xs text-stone-600">{crop.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* End-to-End Workflow */}
      <section className="space-y-4">
        <h2 className="text-xl font-black text-stone-900 text-center">How the Platform Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {WORKFLOW.map((w) => (
            <div key={w.step} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-leaf-700 text-xs font-black text-white">
                {w.step}
              </span>
              <h4 className="text-sm font-bold text-stone-900">{w.title}</h4>
              <p className="text-xs text-stone-600 leading-relaxed">{w.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function About() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="About AgriGlobal" subtitle="Automated Agricultural Procurement, Collection & Aggregation Platform" />
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4 text-sm leading-relaxed text-stone-700">
        <p>
          Traditional agricultural supply chains are fragmented, forcing farmers into unfavorable price discovery and burdening bulk buyers with logistical uncertainty. AgriGlobal solves this by transforming the marketplace into an automated procurement and collection platform.
        </p>
        <h3 className="font-bold text-stone-900 text-base">Key Architectural Principles</h3>
        <ul className="list-disc pl-5 space-y-1.5 text-xs text-stone-600">
          <li><strong>Platform as Intermediary:</strong> Sourcing, allocation, collection, and settlements are managed systematically by the platform engine.</li>
          <li><strong>Zero Negotiation Friction:</strong> Farmers upload produce with GPS coordinates and expected price; matching is automated without individual accept/reject delays.</li>
          <li><strong>Strict Crop Focus:</strong> Specialized strictly for Karnataka's staple staples: Ragi, Rice, and Jowar.</li>
          <li><strong>Automated Logistics & Capacity Checks:</strong> Fleet assignments ensure cargo weight never exceeds vehicle payload capacity.</li>
          <li><strong>Electronic Weighbridge & QC:</strong> Actual on-farm weighed weights determine fair payouts, returning any rejected grain back to farmer inventory.</li>
        </ul>
      </div>
    </div>
  );
}

export function Contact() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Contact Operations" subtitle="Platform Administration & Academic Research" />
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm text-sm leading-relaxed text-stone-700 space-y-2">
        <p className="font-bold text-stone-900">Maharaja Institute of Technology Thandavapura</p>
        <p className="text-xs text-stone-600">Department of Artificial Intelligence and Data Science</p>
        <p className="text-xs text-stone-600">NH 766, Nanjangud Taluk, Mysuru - 571 302, Karnataka, India</p>
        <p className="mt-4 text-xs text-stone-400">
          AgriGlobal Automated Agricultural Procurement, Collection & Aggregation Engine.
        </p>
      </div>
    </div>
  );
}
