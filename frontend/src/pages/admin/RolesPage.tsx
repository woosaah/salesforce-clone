import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

interface Role {
  role_id: string;
  role_name: string;
  parent_role_id?: string;
  parent_role_name?: string;
  description?: string;
  user_count: number;
  children?: Role[];
}

const RolesPage: React.FC = () => {
  const [hierarchy, setHierarchy] = useState<Role[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    role_name: '',
    description: '',
    parent_role_id: '',
  });
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const [hierarchyRes, rolesRes] = await Promise.all([
        api.get('/roles/hierarchy'),
        api.get('/roles'),
      ]);

      if (hierarchyRes.data.success) {
        setHierarchy(hierarchyRes.data.data);
      }
      if (rolesRes.data.success) {
        setAllRoles(rolesRes.data.data);
      }
    } catch (err: any) {
      console.error('Error loading roles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/roles', formData);
      setShowForm(false);
      setFormData({ role_name: '', description: '', parent_role_id: '' });
      loadRoles();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create role');
    }
  };

  const handleDelete = async (roleId: string, roleName: string) => {
    if (!window.confirm(`Delete role "${roleName}"? Users in this role will lose their role assignment.`)) {
      return;
    }

    try {
      await api.delete(`/roles/${roleId}`);
      loadRoles();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete role');
    }
  };

  const renderHierarchy = (roles: Role[], level: number = 0) => {
    return roles.map((role) => (
      <div key={role.role_id}>
        <div
          className="flex items-center justify-between p-3 hover:bg-gray-50 border-l-4 border-blue-500"
          style={{ marginLeft: `${level * 24}px` }}
        >
          <div className="flex-1">
            <div className="font-medium text-gray-900">{role.role_name}</div>
            {role.description && (
              <div className="text-sm text-gray-600">{role.description}</div>
            )}
            <div className="text-xs text-gray-500 mt-1">
              {role.user_count} user{role.user_count !== 1 && 's'}
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to={`/admin/roles/${role.role_id}`}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Edit
            </Link>
            {role.user_count === 0 && (
              <button
                onClick={() => handleDelete(role.role_id, role.role_name)}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Delete
              </button>
            )}
          </div>
        </div>
        {role.children && role.children.length > 0 && renderHierarchy(role.children, level + 1)}
      </div>
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Roles</h1>
          <p className="text-gray-600 mt-1">Define role hierarchy for data access</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          + New Role
        </button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4">Create New Role</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="role_name" className="label">
                Role Name *
              </label>
              <input
                type="text"
                id="role_name"
                className="input"
                value={formData.role_name}
                onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}
                required
              />
            </div>

            <div>
              <label htmlFor="parent_role_id" className="label">
                Reports To (Parent Role)
              </label>
              <select
                id="parent_role_id"
                className="input"
                value={formData.parent_role_id}
                onChange={(e) => setFormData({ ...formData, parent_role_id: e.target.value })}
              >
                <option value="">-- No Parent (Top Level) --</option>
                {allRoles.map((role) => (
                  <option key={role.role_id} value={role.role_id}>
                    {role.role_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="description" className="label">
                Description
              </label>
              <textarea
                id="description"
                className="input"
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary">
                Create
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Role Hierarchy */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Role Hierarchy</h2>
        {hierarchy.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No roles created yet. Create your first role to get started!
          </div>
        ) : (
          <div className="space-y-1">{renderHierarchy(hierarchy)}</div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <h3 className="font-semibold text-blue-900 mb-2">About Role Hierarchy</h3>
        <p className="text-sm text-blue-800">
          Users inherit data access from their subordinates in the role hierarchy. A user in a
          parent role can view and edit all data owned by users in child roles below them.
        </p>
      </div>
    </div>
  );
};

export default RolesPage;
