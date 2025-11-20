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
        <Route path="/admin/objects" element={<AdminObjectsPage />} />
        <Route path="/admin/objects/:objectId" element={<AdminObjectDetailPage />} />
        <Route path="/admin/objects/:objectId/fields/:fieldId" element={<AdminFieldFormPage />} />

        {/* Object Data Routes */}
        <Route path="/objects/:objectName" element={<ObjectListPage />} />
        <Route path="/objects/:objectName/:recordId" element={<RecordDetailPage />} />
        <Route path="/objects/:objectName/new" element={<RecordDetailPage />} />
      </Route>
    </Routes>
  );
}

export default App;
