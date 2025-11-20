import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';

const TenantDetailPage: React.FC = () => {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTenant();
  }, [tenantId]);

  const loadTenant = async () => {
    try {
      const response = await api.get(`/super-admin/tenants/${tenantId}`);
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (err) {
      console.error('Error loading tenant:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async () => {
    try {
      await api.put(`/super-admin/tenants/${tenantId}`, {
        is_active: !data.tenant.is_active,
      });
      loadTenant();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update tenant');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;
  if (!data) return <div>Tenant not found</div>;

  return (
    <div className="p-6">
      <Link to="/super-admin/tenants" className="text-blue-600 hover:text-blue-800 mb-2 inline-block">
        ← Back to Tenants
      </Link>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">{data.tenant.tenant_name}</h1>
          <p className="text-gray-600">{data.tenant.domain}</p>
        </div>
        <button onClick={handleToggleActive} className={`btn ${data.tenant.is_active ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}>
          {data.tenant.is_active ? 'Deactivate' : 'Activate'}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="text-sm text-gray-600">Total Users</div>
          <div className="text-2xl font-bold">{data.statistics.user_count}</div>
          <div className="text-sm text-gray-500">{data.statistics.active_user_count} active</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-600">Objects</div>
          <div className="text-2xl font-bold">{data.statistics.total_objects}</div>
          <div className="text-sm text-gray-500">{data.statistics.custom_objects} custom</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-600">Fields</div>
          <div className="text-2xl font-bold">{data.statistics.total_fields}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-600">Roles</div>
          <div className="text-2xl font-bold">{data.statistics.role_count}</div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Recent Users</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Created</th>
              <th>Last Login</th>
            </tr>
          </thead>
          <tbody>
            {data.recentUsers.map((user: any) => (
              <tr key={user.user_id}>
                <td>{user.first_name} {user.last_name}</td>
                <td>{user.email}</td>
                <td>
                  <span className={`px-2 py-1 text-xs rounded ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="text-sm">{new Date(user.created_date).toLocaleDateString()}</td>
                <td className="text-sm">{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TenantDetailPage;
