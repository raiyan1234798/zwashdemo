import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Bookings from './pages/Bookings';
import Calendar from './pages/Calendar';
import Services from './pages/Services';
import Customers from './pages/Customers';
import Employees from './pages/Employees';
import EmployeeDetails from './pages/EmployeeDetails';
import Expenses from './pages/Expenses';
import Invoices from './pages/Invoices';
import Materials from './pages/Materials';
import MaterialUsageAnalytics from './pages/MaterialUsageAnalytics';
import Payroll from './pages/Payroll';
import Attendance from './pages/Attendance';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import CRMHistory from './pages/CRMHistory';
import AMCPlans from './pages/AMCPlans';
import AuditLog from './pages/AuditLog';
import Inspections from './pages/Inspections';
import PublicInvoice from './pages/PublicInvoice';
import DemoAccess from './pages/DemoAccess';
import TenantsManagement from './pages/TenantsManagement';
import PublicLanding from './pages/PublicLanding';
import PublicBooking from './pages/PublicBooking';
import Contact from './pages/Contact';
import PlatformEnquiries from './pages/PlatformEnquiries';
import './styles/index.css';

// Protected Route wrapper
const ProtectedRoute = ({ children, permission, superAdminOnly = false }) => {
  const { user, userProfile, loading, hasPermission, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="page-loader">
        <div className="loader"></div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return <Navigate to="/login" replace />;
  }

  if (userProfile.needsOnboarding) {
    return <Navigate to="/login" replace />;
  }

  if (userProfile.status === 'pending') {
    return (
      <div className="pending-approval" style={{ padding: '3rem', textAlign: 'center' }}>
        <h2>Account Pending Approval</h2>
        <p>Your account is waiting for admin approval. Please check back later.</p>
      </div>
    );
  }

  if (superAdminOnly && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  if (permission && !hasPermission(permission, 'view') && !hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppRoutes() {
  const hostname = window.location.hostname;
  const isBookingDomain = hostname.includes('booking') || window.location.search.includes('site=booking');

  if (isBookingDomain) {
    return (
      <Routes>
        <Route path="/" element={<PublicLanding />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/book" element={<Navigate to="/" replace />} />
        <Route path="/book/:companyId" element={<PublicBooking />} />
        <Route path="/:companyId" element={<PublicBooking />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // ERP Domain
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/invoice/:id" element={<PublicInvoice />} />

      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />

        {/* Super Admin Routes */}
        <Route path="tenants" element={<ProtectedRoute superAdminOnly><TenantsManagement /></ProtectedRoute>} />
        <Route path="platform-enquiries" element={<ProtectedRoute superAdminOnly><PlatformEnquiries /></ProtectedRoute>} />
        <Route path="demo-access" element={<ProtectedRoute superAdminOnly><DemoAccess /></ProtectedRoute>} />

        {/* Standard Routes */}
        <Route path="calendar" element={<ProtectedRoute permission="calendar"><Calendar /></ProtectedRoute>} />
        <Route path="bookings" element={<ProtectedRoute permission="bookings"><Bookings /></ProtectedRoute>} />
        <Route path="services" element={<ProtectedRoute permission="services"><Services /></ProtectedRoute>} />
        <Route path="customers" element={<ProtectedRoute permission="customers"><Customers /></ProtectedRoute>} />
        <Route path="employees" element={<ProtectedRoute permission="employees"><Employees /></ProtectedRoute>} />
        <Route path="employees/:id" element={<ProtectedRoute permission="employees"><EmployeeDetails /></ProtectedRoute>} />
        <Route path="expenses" element={<ProtectedRoute permission="expenses"><Expenses /></ProtectedRoute>} />
        <Route path="invoices" element={<ProtectedRoute permission="invoices"><Invoices /></ProtectedRoute>} />
        <Route path="payroll" element={<ProtectedRoute permission="payroll"><Payroll /></ProtectedRoute>} />
        <Route path="materials" element={<ProtectedRoute permission="materials"><Materials /></ProtectedRoute>} />
        <Route path="material-usage" element={<ProtectedRoute permission="materials"><MaterialUsageAnalytics /></ProtectedRoute>} />
        <Route path="attendance" element={<ProtectedRoute permission="attendance"><Attendance /></ProtectedRoute>} />
        <Route path="audit-log" element={<ProtectedRoute permission="audit"><AuditLog /></ProtectedRoute>} />
        <Route path="inspections" element={<ProtectedRoute permission="inspections"><Inspections /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute permission="settings"><Settings /></ProtectedRoute>} />
        <Route path="analytics" element={<ProtectedRoute permission="analytics"><Analytics /></ProtectedRoute>} />
        <Route path="crm-history" element={<ProtectedRoute permission="crm"><CRMHistory /></ProtectedRoute>} />
        <Route path="amc-plans" element={<ProtectedRoute permission="amc"><AMCPlans /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

import { ThemeProvider } from './contexts/ThemeContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';

function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.dir = dir;
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <BrowserRouter>
      <CurrencyProvider>
        <AuthProvider>
          <ThemeProvider>
            <AppRoutes />
          </ThemeProvider>
        </AuthProvider>
      </CurrencyProvider>
    </BrowserRouter>
  );
}

export default App;
