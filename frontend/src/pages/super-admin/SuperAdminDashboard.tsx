import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

interface SystemStats {
  total_tenants: number;
  active_tenants: number;
  total_users: number;
  active_users: number;
  tenants_active_week: number;
  users_active_week: number;
  total_custom_objects: number;
  total_fields: number;
}

interface RecentTenant {
  tenant_id: string;
  tenant_name: string;
  domain: string;
  is_active: boolean;
  created_date: string;
}

const SuperAdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [recentTenants, setRecentTenants] = useState<RecentTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get('/super-admin/system/stats');
      if (response.data.success) {
        setStats(response.data.data.statistics);
        setRecentTenants(response.data.data.recentTenants);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load dashboard');
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">Manage all tenants and system-wide settings</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Link
          to="/super-admin/tenants"
          className="card hover:shadow-lg transition-shadow cursor-pointer group"
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl">🏢</div>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
                Manage Tenants
              </h3>
              <p className="text-sm text-gray-600">View and configure all tenants</p>
            </div>
          </div>
        </Link>

        <Link
          to="/super-admin/system"
          className="card hover:shadow-lg transition-shadow cursor-pointer group"
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl">📊</div>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
                System Overview
              </h3>
              <p className="text-sm text-gray-600">View system metrics and usage</p>
            </div>
          </div>
        </Link>

        <Link
          to="/super-admin/tenants/new"
          className="card hover:shadow-lg transition-shadow cursor-pointer group bg-blue-50"
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl">➕</div>
            <div>
              <h3 className="font-semibold text-blue-900 group-hover:text-blue-700">
                Create New Tenant
              </h3>
              <p className="text-sm text-blue-700">Add a new organization</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="text-sm opacity-90">Total Tenants</div>
          <div className="text-3xl font-bold mt-2">{stats?.total_tenants || 0}</div>
          <div className="text-sm opacity-75 mt-1">
            {stats?.active_tenants || 0} active
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="text-sm opacity-90">Total Users</div>
          <div className="text-3xl font-bold mt-2">{stats?.total_users || 0}</div>
          <div className="text-sm opacity-75 mt-1">
            {stats?.active_users || 0} active
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="text-sm opacity-90">Active This Week</div>
          <div className="text-3xl font-bold mt-2">{stats?.tenants_active_week || 0}</div>
          <div className="text-sm opacity-75 mt-1">tenants</div>
        </div>

        <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="text-sm opacity-90">Custom Objects</div>
          <div className="text-3xl font-bold mt-2">{stats?.total_custom_objects || 0}</div>
          <div className="text-sm opacity-75 mt-1">
            {stats?.total_fields || 0} total fields
          </div>
        </div>
      </div>

      {/* Recent Tenants */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Recently Created Tenants</h2>
          <Link to="/super-admin/tenants" className="text-blue-600 hover:text-blue-800">
            View All →
          </Link>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Tenant Name</th>
              <th>Domain</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {recentTenants.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-gray-500 py-8">
                  No tenants found
                </td>
              </tr>
            ) : (
              recentTenants.map((tenant) => (
                <tr key={tenant.tenant_id}>
                  <td className="font-medium">{tenant.tenant_name}</td>
                  <td className="font-mono text-sm text-gray-600">{tenant.domain}</td>
                  <td>
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${
                        tenant.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {tenant.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="text-sm text-gray-600">
                    {new Date(tenant.created_date).toLocaleDateString()}
                  </td>
                  <td>
                    <Link
                      to={`/super-admin/tenants/${tenant.tenant_id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* System Health Indicators */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card bg-gray-50">
          <h3 className="font-semibold text-gray-900 mb-3">System Health</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Database</span>
              <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded">
                Healthy
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">API Server</span>
              <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded">
                Running
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Storage</span>
              <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded">
                Available
              </span>
            </div>
          </div>
        </div>

        <div className="card bg-gray-50">
          <h3 className="font-semibold text-gray-900 mb-3">Quick Stats</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Avg Users per Tenant</span>
              <span className="font-semibold text-gray-900">
                {stats && stats.total_tenants > 0
                  ? Math.round(stats.total_users / stats.total_tenants)
                  : 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Active User Rate</span>
              <span className="font-semibold text-gray-900">
                {stats && stats.total_users > 0
                  ? Math.round((stats.active_users / stats.total_users) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Weekly Active Rate</span>
              <span className="font-semibold text-gray-900">
                {stats && stats.total_tenants > 0
                  ? Math.round((stats.tenants_active_week / stats.total_tenants) * 100)
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
