import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ObjectListPage from './pages/ObjectListPage';
import RecordDetailPage from './pages/RecordDetailPage';
import QueryConsolePage from './pages/QueryConsolePage';
import InvoiceListPage from './pages/InvoiceListPage';
import InvoiceDetailPage from './pages/InvoiceDetailPage';
import AssetListPage from './pages/AssetListPage';
import AssetDetailPage from './pages/AssetDetailPage';
import AdminObjectsPage from './pages/admin/AdminObjectsPage';
import AdminObjectDetailPage from './pages/admin/AdminObjectDetailPage';
import AdminFieldFormPage from './pages/admin/AdminFieldFormPage';
import SettingsPage from './pages/admin/SettingsPage';
import LeadSettingsPage from './pages/admin/LeadSettingsPage';
import OpportunitySettingsPage from './pages/admin/OpportunitySettingsPage';
import CaseSettingsPage from './pages/admin/CaseSettingsPage';
import CampaignSettingsPage from './pages/admin/CampaignSettingsPage';
import WorkflowSettingsPage from './pages/admin/WorkflowSettingsPage';
import ReportSettingsPage from './pages/admin/ReportSettingsPage';
import UsersPage from './pages/admin/UsersPage';
import UserDetailPage from './pages/admin/UserDetailPage';
import RolesPage from './pages/admin/RolesPage';
import PermissionSetsPage from './pages/admin/PermissionSetsPage';
import PermissionSetDetailPage from './pages/admin/PermissionSetDetailPage';
import FieldLevelSecurityPage from './pages/admin/FieldLevelSecurityPage';
import SuperAdminDashboard from './pages/super-admin/SuperAdminDashboard';
import TenantsPage from './pages/super-admin/TenantsPage';
import CreateTenantPage from './pages/super-admin/CreateTenantPage';
import TenantDetailPage from './pages/super-admin/TenantDetailPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="/query" element={<QueryConsolePage />} />
        <Route path="/invoices" element={<InvoiceListPage />} />
        <Route path="/invoices/:invoiceId" element={<InvoiceDetailPage />} />
        <Route path="/assets" element={<AssetListPage />} />
        <Route path="/assets/:assetId" element={<AssetDetailPage />} />

        {/* Admin Routes */}
        <Route path="/admin/settings" element={<SettingsPage />} />
        <Route path="/admin/objects" element={<AdminObjectsPage />} />
        <Route path="/admin/objects/:objectId" element={<AdminObjectDetailPage />} />
        <Route path="/admin/objects/:objectId/fields/:fieldId" element={<AdminFieldFormPage />} />
        <Route path="/admin/leads" element={<LeadSettingsPage />} />
        <Route path="/admin/opportunities" element={<OpportunitySettingsPage />} />
        <Route path="/admin/cases" element={<CaseSettingsPage />} />
        <Route path="/admin/campaigns" element={<CampaignSettingsPage />} />
        <Route path="/admin/workflows" element={<WorkflowSettingsPage />} />
        <Route path="/admin/reports" element={<ReportSettingsPage />} />
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/users/:userId" element={<UserDetailPage />} />
        <Route path="/admin/roles" element={<RolesPage />} />
        <Route path="/admin/permission-sets" element={<PermissionSetsPage />} />
        <Route path="/admin/permission-sets/:permissionSetId" element={<PermissionSetDetailPage />} />
        <Route path="/admin/permission-sets/:permissionSetId/fields/:objectId" element={<FieldLevelSecurityPage />} />

        {/* Super Admin Routes */}
        <Route path="/super-admin" element={<SuperAdminDashboard />} />
        <Route path="/super-admin/tenants" element={<TenantsPage />} />
        <Route path="/super-admin/tenants/new" element={<CreateTenantPage />} />
        <Route path="/super-admin/tenants/:tenantId" element={<TenantDetailPage />} />

        {/* Object Data Routes */}
        <Route path="/objects/:objectName" element={<ObjectListPage />} />
        <Route path="/objects/:objectName/:recordId" element={<RecordDetailPage />} />
        <Route path="/objects/:objectName/new" element={<RecordDetailPage />} />
      </Route>
    </Routes>
  );
}

export default App;
