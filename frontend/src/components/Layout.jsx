import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { CURRENCIES } from '../utils/format.js';
import { useApi } from '../hooks/useApi.js';

const LINKS = {
  public: [
    ['/', 'Home'],
    ['/login', 'Login'],
    ['/register', 'Register']
  ],
  farmer: [
    ['/farmer/dashboard', 'Dashboard'],
    ['/farmer/add-crop', 'Add Crop'],
    ['/farmer/inventory', 'My Produce'],
    ['/farmer/collections', 'Collection Tracking'],
    ['/farmer/payments', 'Payment History'],
    ['/farmer/profile', 'Farm Profile']
  ],
  buyer: [
    ['/buyer/dashboard', 'Dashboard'],
    ['/buyer/create-requirement', 'Post Requirement'],
    ['/buyer/requirements', 'My Requirements'],
    ['/buyer/aggregation', 'Aggregation'],
    ['/buyer/deliveries', 'Deliveries'],
    ['/buyer/profile', 'Company Profile']
  ],
  admin: [
    ['/admin/dashboard', 'Dashboard'],
    ['/admin/farmers', 'Farmers'],
    ['/admin/buyers', 'Buyers'],
    ['/admin/inventory', 'Inventory'],
    ['/admin/procurement', 'Procurement'],
    ['/admin/vehicles', 'Fleet'],
    ['/admin/quality-control', 'Quality Control'],
    ['/admin/payments', 'Payments'],
    ['/admin/reports', 'Reports'],
    ['/admin/settings', 'Settings']
  ]
};

function Bell() {
  const { data } = useApi('/notifications');
  return (
    <NavLink to="/notifications" className="relative rounded-lg px-2 py-1 text-sm hover:bg-stone-100" aria-label="Notifications">
      🔔
      {data?.unread > 0 && (
        <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] text-white">
          {data.unread}
        </span>
      )}
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  const links = LINKS[user?.role || 'public'];

  const homePath = user
    ? user.role === 'farmer'
      ? '/farmer/dashboard'
      : user.role === 'buyer'
      ? '/buyer/dashboard'
      : '/admin/dashboard'
    : '/';

  const item = ([to, label]) => (
    <NavLink
      key={to}
      to={to}
      onClick={() => setOpen(false)}
      className={({ isActive }) =>
        `block rounded-xl px-3 py-1.5 text-xs font-bold transition ${
          isActive
            ? 'bg-leaf-700 text-white shadow-xs'
            : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
        }`
      }
    >
      {label}
    </NavLink>
  );

  return (
    <div className="flex min-h-screen flex-col bg-stone-50/50">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link to={homePath} className="flex items-center gap-2 font-black text-leaf-800 text-lg">
            <span className="text-2xl">🌾</span>
            <span>AgriGlobal</span>
            {user?.role && (
              <span className="ml-1 rounded-md bg-leaf-100 px-2 py-0.5 text-[11px] font-bold uppercase text-leaf-900">
                {user.role} Portal
              </span>
            )}
          </Link>

          <nav className="hidden flex-wrap items-center gap-1 xl:flex" aria-label="Main Navigation">
            {links.map(item)}
          </nav>

          <div className="flex items-center gap-2">
            <select
              aria-label="Currency"
              className="rounded-lg border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>

            {user ? (
              <>
                <Bell />
                <span className="hidden text-xs font-bold text-stone-700 sm:inline-block">
                  {user.name.split(' ')[0]}
                </span>
                <button
                  className="rounded-xl border border-stone-300 bg-white px-3 py-1 text-xs font-bold text-stone-700 hover:bg-stone-100"
                  onClick={() => {
                    logout();
                    nav('/');
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="rounded-xl border border-stone-300 px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-100">
                  Login
                </Link>
                <Link to="/register" className="rounded-xl bg-leaf-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-leaf-800">
                  Register
                </Link>
              </>
            )}

            <button
              className="rounded-xl border border-stone-300 p-1.5 text-stone-700 xl:hidden"
              aria-label="Menu"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              ☰
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <nav className="border-t border-stone-200 bg-white px-4 py-3 xl:hidden space-y-1" aria-label="Mobile Navigation">
            {links.map(item)}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-stone-200 bg-white py-4 text-center text-xs text-stone-500">
        AgriGlobal Marketplace — Automated Agricultural Procurement, Collection & Aggregation Platform.
      </footer>
    </div>
  );
}
