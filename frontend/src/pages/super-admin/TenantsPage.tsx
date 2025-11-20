import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

interface Tenant {
  tenant_id: string;
  tenant_name: string;
  domain: string;
  is_active: boolean;
  created_date: string;
  user_count: number;
  custom_object_count: number;
}

const TenantsPage: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const response = await api.get('/super-admin/tenants');
      if (response.data.success) {
        setTenants(response.data.data);
      }
    } catch (err: any) {
      console.error('Error loading tenants:', err);
      alert('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleImpersonate = async (tenantId: string, tenantName: string) => {
    if (!window.confirm(`Login as ${tenantName}? You will be logged in as the admin user of this tenant.`)) {
      return;
    }

    try {
      const response = await api.post(`/super-admin/tenants/${tenantId}/impersonate`);
      if (response.data.success) {
        localStorage.setItem('authToken', response.data.data.token);
        localStorage.setItem('impersonation', JSON.stringify({
          tenantId: response.data.data.tenant.tenant_id,
          tenantName: response.data.data.tenant.tenant_name,
          originalAdmin: true,
        }));
        window.location.href = '/';
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to impersonate tenant');
    }
  };

  const filteredTenants = tenants.filter(t => {
    if (filter === 'active') return t.is_active;
    if (filter === 'inactive') return !t.is_active;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link to="/super-admin" className="text-blue-600 hover:text-blue-800 mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Tenant Management</h1>
        </div>
        <Link to="/super-admin/tenants/new" className="btn btn-primary">+ Create Tenant</Link>
      </div>

      <div className="mb-4 flex gap-2">
        {(['all', 'active', 'inactive'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-md font-medium ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'all' ? tenants.length : tenants.filter(t => f === 'active' ? t.is_active : !t.is_active).length})
          </button>
        ))}
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Tenant Name</th>
              <th>Domain</th>
              <th>Users</th>
              <th>Custom Objects</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTenants.map((tenant) => (
              <tr key={tenant.tenant_id}>
                <td className="font-medium">{tenant.tenant_name}</td>
                <td className="font-mono text-sm">{tenant.domain}</td>
                <td className="text-center">{tenant.user_count}</td>
                <td className="text-center">{tenant.custom_object_count}</td>
                <td>
                  <span className={`px-2 py-1 text-xs font-semibold rounded ${tenant.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {tenant.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="text-sm">{new Date(tenant.created_date).toLocaleDateString()}</td>
                <td>
                  <div className="flex gap-2">
                    <Link to={`/super-admin/tenants/${tenant.tenant_id}`} className="text-blue-600 hover:text-blue-800">View</Link>
                    <button onClick={() => handleImpersonate(tenant.tenant_id, tenant.tenant_name)} className="text-green-600 hover:text-green-800">Login As</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TenantsPage;
