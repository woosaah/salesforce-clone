import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';

interface Role {
  role_id: string;
  role_name: string;
}

interface PermissionSet {
  permission_set_id: string;
  permission_set_name: string;
  label: string;
  description?: string;
}

const UserDetailPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const isNew = userId === 'new';

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone: '',
    title: '',
    profile: 'Standard User',
    role_id: '',
    is_active: true,
  });

  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissionSets, setAllPermissionSets] = useState<PermissionSet[]>([]);
  const [userPermissionSets, setUserPermissionSets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load roles
      const rolesRes = await api.get('/roles');
      if (rolesRes.data.success) {
        setRoles(rolesRes.data.data);
      }

      // Load permission sets
      const psRes = await api.get('/permission-sets');
      if (psRes.data.success) {
        setAllPermissionSets(psRes.data.data);
      }

      // Load user data if editing
      if (!isNew) {
        const userRes = await api.get(`/users/${userId}`);
        if (userRes.data.success) {
          const userData = userRes.data.data.user;
          setFormData({
            first_name: userData.first_name,
            last_name: userData.last_name,
            email: userData.email,
            password: '',
            phone: userData.phone || '',
            title: userData.title || '',
            profile: userData.profile || 'Standard User',
            role_id: userData.role_id || '',
            is_active: userData.is_active,
          });

          const userPS = userRes.data.data.permissionSets || [];
          setUserPermissionSets(userPS.map((ps: any) => ps.permission_set_id));
        }
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isNew) {
        if (!formData.password || formData.password.length < 8) {
          alert('Password must be at least 8 characters');
          return;
        }

        const response = await api.post('/users', formData);
        if (response.data.success) {
          const newUserId = response.data.data.user_id;

          // Assign permission sets
          for (const psId of userPermissionSets) {
            await api.post(`/users/${newUserId}/permission-sets/${psId}`);
          }

          navigate('/admin/users');
        }
      } else {
        const { password, ...updateData } = formData;
        await api.put(`/users/${userId}`, updateData);

        // Update permission sets - this is simplified
        // In production, you'd want to calculate the difference
        navigate('/admin/users');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save user');
      console.error('Error saving user:', err);
    }
  };

  const handleResetPassword = async () => {
    const newPassword = prompt('Enter new password (min 8 characters):');
    if (!newPassword || newPassword.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    try {
      await api.post(`/users/${userId}/reset-password`, { new_password: newPassword });
      alert('Password reset successfully');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reset password');
    }
  };

  const togglePermissionSet = (psId: string) => {
    setUserPermissionSets(prev =>
      prev.includes(psId)
        ? prev.filter(id => id !== psId)
        : [...prev, psId]
    );
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
      <div className="mb-6">
        <Link to="/admin/users" className="text-blue-600 hover:text-blue-800 mb-2 inline-block">
          ← Back to Users
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">
          {isNew ? 'New User' : 'Edit User'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* User Information */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">User Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="first_name" className="label">
                First Name *
              </label>
              <input
                type="text"
                id="first_name"
                className="input"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
            </div>

            <div>
              <label htmlFor="last_name" className="label">
                Last Name *
              </label>
              <input
                type="text"
                id="last_name"
                className="input"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="label">
                Email *
              </label>
              <input
                type="email"
                id="email"
                className="input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            {isNew && (
              <div>
                <label htmlFor="password" className="label">
                  Password * (min 8 characters)
                </label>
                <input
                  type="password"
                  id="password"
                  className="input"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={isNew}
                  minLength={8}
                />
              </div>
            )}

            <div>
              <label htmlFor="phone" className="label">
                Phone
              </label>
              <input
                type="tel"
                id="phone"
                className="input"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="title" className="label">
                Title
              </label>
              <input
                type="text"
                id="title"
                className="input"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="profile" className="label">
                Profile *
              </label>
              <select
                id="profile"
                className="input"
                value={formData.profile}
                onChange={(e) => setFormData({ ...formData, profile: e.target.value })}
                required
              >
                <option value="System Administrator">System Administrator</option>
                <option value="Standard User">Standard User</option>
                <option value="Sales User">Sales User</option>
                <option value="Service User">Service User</option>
                <option value="Marketing User">Marketing User</option>
                <option value="Read Only">Read Only</option>
              </select>
            </div>

            <div>
              <label htmlFor="role_id" className="label">
                Role
              </label>
              <select
                id="role_id"
                className="input"
                value={formData.role_id}
                onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
              >
                <option value="">-- No Role --</option>
                {roles.map((role) => (
                  <option key={role.role_id} value={role.role_id}>
                    {role.role_name}
                  </option>
                ))}
              </select>
            </div>

            {!isNew && (
              <div className="col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <span className="font-medium">Active</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Permission Sets */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Permission Sets</h2>
          <div className="space-y-2">
            {allPermissionSets.map((ps) => (
              <label key={ps.permission_set_id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={userPermissionSets.includes(ps.permission_set_id)}
                  onChange={() => togglePermissionSet(ps.permission_set_id)}
                />
                <div>
                  <div className="font-medium">{ps.label}</div>
                  {ps.description && (
                    <div className="text-sm text-gray-600">{ps.description}</div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary">
            {isNew ? 'Create User' : 'Save Changes'}
          </button>
          <Link to="/admin/users" className="btn">
            Cancel
          </Link>
          {!isNew && (
            <button
              type="button"
              onClick={handleResetPassword}
              className="btn ml-auto"
            >
              Reset Password
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default UserDetailPage;
