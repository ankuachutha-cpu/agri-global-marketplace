import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth } from './context/AuthContext.jsx';

// Core Public & Auth Pages
import { Home, About, Contact } from './pages/Public.jsx';
import { Login, Register } from './pages/Auth.jsx';
import { Profile, Settings, Notifications } from './pages/Account.jsx';

// 1. Farmer Portal Pages
import FarmerDashboard from './pages/farmer/FarmerDashboard.jsx';
import AddCrop from './pages/farmer/AddCrop.jsx';
import FarmerInventory from './pages/farmer/FarmerInventory.jsx';
import FarmerCollections from './pages/farmer/FarmerCollections.jsx';
import FarmerPayments from './pages/farmer/FarmerPayments.jsx';
import FarmerProfile from './pages/farmer/FarmerProfile.jsx';

// 2. Buyer Portal Pages
import BuyerDashboard from './pages/buyer/BuyerDashboard.jsx';
import CreateRequirement from './pages/buyer/CreateRequirement.jsx';
import BuyerRequirements from './pages/buyer/BuyerRequirements.jsx';
import AggregationTracking from './pages/buyer/AggregationTracking.jsx';
import BuyerDeliveries from './pages/buyer/BuyerDeliveries.jsx';
import BuyerProfile from './pages/buyer/BuyerProfile.jsx';

// 3. Admin Portal Pages
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import FarmerManagement from './pages/admin/FarmerManagement.jsx';
import BuyerManagement from './pages/admin/BuyerManagement.jsx';
import AdminInventory from './pages/admin/AdminInventory.jsx';
import ProcurementAggregation from './pages/admin/ProcurementAggregation.jsx';
import VehicleManagement from './pages/admin/VehicleManagement.jsx';
import QualityControl from './pages/admin/QualityControl.jsx';
import PaymentManagement from './pages/admin/PaymentManagement.jsx';
import ReportsAnalytics from './pages/admin/ReportsAnalytics.jsx';
import AdminSettings from './pages/admin/AdminSettings.jsx';

const P = (roles, el) => <ProtectedRoute roles={roles}>{el}</ProtectedRoute>;
const ANY = ['farmer', 'buyer', 'admin'];

function RoleDashboardRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'farmer') return <Navigate to="/farmer/dashboard" replace />;
  if (user.role === 'buyer') return <Navigate to="/buyer/dashboard" replace />;
  return <Navigate to="/admin/dashboard" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Global /dashboard redirect by role */}
        <Route path="/dashboard" element={<RoleDashboardRedirect />} />

        {/* ========================================================= */}
        {/* 1. FARMER PORTAL (Strictly 6 Dedicated Pages)             */}
        {/* ========================================================= */}
        <Route path="/farmer" element={P(['farmer', 'admin'], <Navigate to="/farmer/dashboard" replace />)} />
        <Route path="/farmer/dashboard" element={P(['farmer', 'admin'], <FarmerDashboard />)} />
        <Route path="/farmer/add-crop" element={P(['farmer', 'admin'], <AddCrop />)} />
        <Route path="/farmer/inventory" element={P(['farmer', 'admin'], <FarmerInventory />)} />
        <Route path="/farmer/collections" element={P(['farmer', 'admin'], <FarmerCollections />)} />
        <Route path="/farmer/payments" element={P(['farmer', 'admin'], <FarmerPayments />)} />
        <Route path="/farmer/profile" element={P(['farmer', 'admin'], <FarmerProfile />)} />

        {/* ========================================================= */}
        {/* 2. BUYER PORTAL (Strictly 6 Dedicated Pages)              */}
        {/* ========================================================= */}
        <Route path="/buyer" element={P(['buyer', 'admin'], <Navigate to="/buyer/dashboard" replace />)} />
        <Route path="/buyer/dashboard" element={P(['buyer', 'admin'], <BuyerDashboard />)} />
        <Route path="/buyer/create-requirement" element={P(['buyer', 'admin'], <CreateRequirement />)} />
        <Route path="/buyer/requirements" element={P(['buyer', 'admin'], <BuyerRequirements />)} />
        <Route path="/buyer/aggregation" element={P(['buyer', 'admin'], <AggregationTracking />)} />
        <Route path="/buyer/deliveries" element={P(['buyer', 'admin'], <BuyerDeliveries />)} />
        <Route path="/buyer/profile" element={P(['buyer', 'admin'], <BuyerProfile />)} />

        {/* ========================================================= */}
        {/* 3. ADMIN PORTAL (Strictly 10 Dedicated Management Views)  */}
        {/* ========================================================= */}
        <Route path="/admin" element={P(['admin'], <Navigate to="/admin/dashboard" replace />)} />
        <Route path="/admin/dashboard" element={P(['admin'], <AdminDashboard />)} />
        <Route path="/admin/farmers" element={P(['admin'], <FarmerManagement />)} />
        <Route path="/admin/buyers" element={P(['admin'], <BuyerManagement />)} />
        <Route path="/admin/inventory" element={P(['admin'], <AdminInventory />)} />
        <Route path="/admin/procurement" element={P(['admin'], <ProcurementAggregation />)} />
        <Route path="/admin/vehicles" element={P(['admin'], <VehicleManagement />)} />
        <Route path="/admin/quality-control" element={P(['admin'], <QualityControl />)} />
        <Route path="/admin/payments" element={P(['admin'], <PaymentManagement />)} />
        <Route path="/admin/reports" element={P(['admin'], <ReportsAnalytics />)} />
        <Route path="/admin/settings" element={P(['admin'], <AdminSettings />)} />

        {/* User Account Routes */}
        <Route path="/profile" element={P(ANY, <Profile />)} />
        <Route path="/settings" element={P(ANY, <Settings />)} />
        <Route path="/notifications" element={P(ANY, <Notifications />)} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
