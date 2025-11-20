import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

interface User {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  profile: string;
  role_name?: string;
  role_id?: string;
  created_date: string;
  last_login?: string;
}

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/users');
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load users');
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to deactivate user "${userName}"?`)) {
      return;
    }

    try {
      await api.delete(`/users/${userId}`);
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to deactivate user');
      console.error('Error deactivating user:', err);
    }
  };

  const filteredUsers = users.filter(user => {
    if (filter === 'active') return user.is_active;
    if (filter === 'inactive') return !user.is_active;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading users...</div>
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-600 mt-1">Manage user accounts and access</p>
        </div>
        <Link to="/admin/users/new" className="btn btn-primary">
          + New User
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-md font-medium ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All Users ({users.length})
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-md font-medium ${
            filter === 'active'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Active ({users.filter(u => u.is_active).length})
        </button>
        <button
          onClick={() => setFilter('inactive')}
          className={`px-4 py-2 rounded-md font-medium ${
            filter === 'inactive'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Inactive ({users.filter(u => !u.is_active).length})
        </button>
      </div>

      {/* Users Table */}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Profile</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-gray-500 py-8">
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.user_id}>
                  <td className="font-medium">
                    {user.first_name} {user.last_name}
                  </td>
                  <td>{user.email}</td>
                  <td className="text-sm text-gray-600">{user.profile}</td>
                  <td className="text-sm text-gray-600">
                    {user.role_name || '-'}
                  </td>
                  <td>
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${
                        user.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="text-sm text-gray-600">
                    {user.last_login
                      ? new Date(user.last_login).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <Link
                        to={`/admin/users/${user.user_id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Edit
                      </Link>
                      {user.is_active && (
                        <button
                          onClick={() =>
                            handleDeactivate(
                              user.user_id,
                              `${user.first_name} ${user.last_name}`
                            )
                          }
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Quick Links */}
      <div className="mt-6 card bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Related Settings</h2>
        <div className="grid grid-cols-3 gap-3">
          <Link to="/admin/roles" className="text-blue-600 hover:text-blue-800">
            Manage Roles →
          </Link>
          <Link to="/admin/permission-sets" className="text-blue-600 hover:text-blue-800">
            Permission Sets →
          </Link>
          <Link to="/admin/profiles" className="text-blue-600 hover:text-blue-800">
            Profiles →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UsersPage;
