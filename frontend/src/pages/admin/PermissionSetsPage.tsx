import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

interface PermissionSet {
  permission_set_id: string;
  permission_set_name: string;
  label: string;
  description?: string;
  assignment_count: number;
}

const PermissionSetsPage: React.FC = () => {
  const [permissionSets, setPermissionSets] = useState<PermissionSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPermissionSets();
  }, []);

  const loadPermissionSets = async () => {
    try {
      const response = await api.get('/permission-sets');
      if (response.data.success) {
        setPermissionSets(response.data.data);
      }
    } catch (err: any) {
      console.error('Error loading permission sets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (psId: string, name: string) => {
    if (!window.confirm(`Delete permission set "${name}"?`)) return;
    try {
      await api.delete(`/permission-sets/${psId}`);
      loadPermissionSets();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Permission Sets</h1>
          <p className="text-gray-600 mt-1">Grant additional permissions to users</p>
        </div>
        <Link to="/admin/permission-sets/new" className="btn btn-primary">+ New Permission Set</Link>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Label</th>
              <th>API Name</th>
              <th>Description</th>
              <th>Assignments</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {permissionSets.map((ps) => (
              <tr key={ps.permission_set_id}>
                <td className="font-medium">{ps.label}</td>
                <td className="font-mono text-sm">{ps.permission_set_name}</td>
                <td className="text-gray-600">{ps.description || '-'}</td>
                <td>{ps.assignment_count}</td>
                <td>
                  <div className="flex gap-2">
                    <Link to={`/admin/permission-sets/${ps.permission_set_id}`} className="text-blue-600 hover:text-blue-800">Edit</Link>
                    <button onClick={() => handleDelete(ps.permission_set_id, ps.label)} className="text-red-600 hover:text-red-800">Delete</button>
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

export default PermissionSetsPage;
