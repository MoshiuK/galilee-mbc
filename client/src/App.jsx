import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore';
import DashboardLayout from './components/layout/DashboardLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ExtensionsPage from './pages/ExtensionsPage';
import PhoneNumbersPage from './pages/PhoneNumbersPage';
import IvrPage from './pages/IvrPage';
import RingGroupsPage from './pages/RingGroupsPage';
import CallQueuesPage from './pages/CallQueuesPage';
import CallLogsPage from './pages/CallLogsPage';
import VoicemailPage from './pages/VoicemailPage';
import ContactsPage from './pages/ContactsPage';
import TimeConditionsPage from './pages/TimeConditionsPage';
import BrandingPage from './pages/BrandingPage';
import SettingsPage from './pages/SettingsPage';
import PlatformAdminPage from './pages/PlatformAdminPage';
import TenantFormPage from './pages/TenantFormPage';
import NotificationsPage from './pages/NotificationsPage';
import UsageStatsPage from './pages/UsageStatsPage';
import ProvisioningPage from './pages/ProvisioningPage';
import AdminTenantExtensionsPage from './pages/AdminTenantExtensionsPage';
import AdminTenantPhoneNumbersPage from './pages/AdminTenantPhoneNumbersPage';
import AdminAiSettingsPage from './pages/AdminAiSettingsPage';

function ProtectedRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="extensions" element={<ExtensionsPage />} />
          <Route path="phone-numbers" element={<PhoneNumbersPage />} />
          <Route path="ivr" element={<IvrPage />} />
          <Route path="ring-groups" element={<RingGroupsPage />} />
          <Route path="call-queues" element={<CallQueuesPage />} />
          <Route path="call-logs" element={<CallLogsPage />} />
          <Route path="voicemail" element={<VoicemailPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="time-conditions" element={<TimeConditionsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="usage-stats" element={<UsageStatsPage />} />
          <Route path="provisioning" element={<ProvisioningPage />} />
          <Route path="branding" element={<BrandingPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin/tenants" element={<PlatformAdminPage />} />
          <Route path="admin/tenants/new" element={<TenantFormPage />} />
          <Route path="admin/tenant/:tenantId/extensions" element={<AdminTenantExtensionsPage />} />
          <Route path="admin/tenant/:tenantId/phone-numbers" element={<AdminTenantPhoneNumbersPage />} />
          <Route path="admin/tenant/:tenantId/ivr" element={<IvrPage />} />
          <Route path="admin/tenant/:tenantId/voicemail" element={<VoicemailPage />} />
          <Route path="admin/tenant/:tenantId/ai-settings" element={<AdminAiSettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
