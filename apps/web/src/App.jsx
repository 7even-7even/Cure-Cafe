import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import PatientsPage from './pages/PatientsPage';
import DietsPage from './pages/DietsPage';
import MealsPage from './pages/MealsPage';
import MenuPage from './pages/MenuPage';
import OrdersPage from './pages/OrdersPage';
import KitchenPage from './pages/KitchenPage';
import DeliveriesPage from './pages/DeliveriesPage';
import InventoryPage from './pages/InventoryPage';
import BillingPage from './pages/BillingPage';
import ReportsPage from './pages/ReportsPage';
import NotificationsPage from './pages/NotificationsPage';
import FeedbackPage from './pages/FeedbackPage';
import { ROLES } from './utils/format';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route element={<ProtectedRoute roles={[ROLES.ADMIN]} />}><Route path="users" element={<UsersPage />} /></Route>
            <Route path="patients" element={<PatientsPage />} />
            <Route path="diets" element={<DietsPage />} />
            <Route path="meals" element={<MealsPage />} />
            <Route path="menu" element={<MenuPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="kitchen" element={<KitchenPage />} />
            <Route path="deliveries" element={<DeliveriesPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="feedback" element={<FeedbackPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
