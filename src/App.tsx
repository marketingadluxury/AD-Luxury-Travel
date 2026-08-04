import { Toaster } from 'react-hot-toast';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import DepartureCalendar from './pages/DepartureCalendar';
import ToursManagement from './pages/ToursManagement';
import OrdersManagement from './pages/OrdersManagement';
import VisaProcessing from './pages/VisaProcessing';
import VisaOrders from './pages/VisaOrders';
import VisaServices from './pages/VisaServices';
import AccountingInvoice from './pages/AccountingInvoice';
import PaymentProposals from './pages/PaymentProposals';
import CustomersManagement from './pages/CustomersManagement';
import PassengersManagement from './pages/PassengersManagement';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import ActivityLogs from './pages/ActivityLogs';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import ExecutiveDashboard from './pages/ExecutiveDashboard';
import TourMediaManagement from './pages/TourMediaManagement';
import { GuestPhotoUploadPage } from './pages/GuestPhotoUploadPage';
import { CRMProvider } from './context/CRMContext';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const isRecoveryInUrl = typeof window !== 'undefined' && (window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery'));

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const guestTourId = searchParams.get('uploadTourId') || searchParams.get('tourId');
  const isGuestUploadRoute = typeof window !== 'undefined' && (
    window.location.pathname === '/guest-upload' ||
    searchParams.has('uploadTourId') ||
    searchParams.has('tourId')
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500 font-medium">Đang tải...</div>;
  }

  // If unauthenticated guest accesses via QR code / quick link with uploadTourId, open guest upload page directly without login!
  if (!user && (guestTourId || isGuestUploadRoute)) {
    return (
      <CRMProvider initialRole="tour_guide">
        <GuestPhotoUploadPage defaultTourId={guestTourId || undefined} />
      </CRMProvider>
    );
  }

  if (!user || isRecoveryInUrl) {
    return <Auth initialIsUpdatePassword={isRecoveryInUrl} />;
  }

  return (
    <CRMProvider initialRole={profile?.role || 'agent'}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<DepartureCalendar />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/executive" element={<ExecutiveDashboard />} />
            <Route path="/tours" element={<ToursManagement />} />
            <Route path="/tour-media" element={<TourMediaManagement />} />
            <Route path="/guest-upload" element={<GuestPhotoUploadPage />} />
            <Route path="/visa-services" element={<VisaServices />} />
            <Route path="/visa-orders" element={<VisaOrders />} />
            <Route path="/orders" element={<OrdersManagement />} />
            <Route path="/visa" element={<VisaProcessing />} />
            <Route path="/accounting" element={<AccountingInvoice />} />
            <Route path="/payment-proposals" element={<PaymentProposals />} />
            <Route path="/customers" element={<CustomersManagement />} />
            <Route path="/passengers" element={<PassengersManagement />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/activity-logs" element={<ActivityLogs />} />
          </Routes>
        </Layout>
      </Router>
    </CRMProvider>
  );
}


export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster position="top-right" />
    </AuthProvider>
  );
}
