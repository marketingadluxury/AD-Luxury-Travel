import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import DepartureCalendar from './pages/DepartureCalendar';
import ToursManagement from './pages/ToursManagement';
import OrdersManagement from './pages/OrdersManagement';
import VisaProcessing from './pages/VisaProcessing';
import VisaOrders from './pages/VisaOrders';
import VisaServices from './pages/VisaServices';
import AccountingInvoice from './pages/AccountingInvoice';
import CustomersManagement from './pages/CustomersManagement';
import PassengersManagement from './pages/PassengersManagement';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Auth from './pages/Auth';
import { CRMProvider } from './context/CRMContext';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppContent() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Đang tải...</div>;
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <CRMProvider initialRole={profile?.role || 'CTV'}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<DepartureCalendar />} />
            <Route path="/tours" element={<ToursManagement />} />
            <Route path="/visa-services" element={<VisaServices />} />
            <Route path="/visa-orders" element={<VisaOrders />} />
            <Route path="/orders" element={<OrdersManagement />} />
            <Route path="/visa" element={<VisaProcessing />} />
            <Route path="/accounting" element={<AccountingInvoice />} />
            <Route path="/customers" element={<CustomersManagement />} />
            <Route path="/passengers" element={<PassengersManagement />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
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
    </AuthProvider>
  );
}
