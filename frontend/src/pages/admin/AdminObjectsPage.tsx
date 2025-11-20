import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

interface ObjectMeta {
  object_id: string;
  object_name: string;
  label: string;
  plural_label: string;
  is_custom: boolean;
  is_active: boolean;
  description?: string;
  created_date: string;
  modified_date: string;
}

const AdminObjectsPage: React.FC = () => {
  const [objects, setObjects] = useState<ObjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadObjects();
  }, []);

  const loadObjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/admin/objects');
      if (response.data.success) {
        setObjects(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load objects');
      console.error('Error loading objects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (objectId: string, objectName: string) => {
    if (!window.confirm(`Are you sure you want to delete the object "${objectName}"? This cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/admin/objects/${objectId}`);
      loadObjects(); // Reload the list
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete object');
      console.error('Error deleting object:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading objects...</div>
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

  const standardObjects = objects.filter(obj => !obj.is_custom);
  const customObjects = objects.filter(obj => obj.is_custom);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Object Manager</h1>
          <p className="text-gray-600 mt-1">Manage custom objects, fields, and relationships</p>
        </div>
        <Link
          to="/admin/objects/new"
          className="btn btn-primary"
        >
          + New Custom Object
        </Link>
      </div>

      {/* Standard Objects */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Standard Objects</h2>
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Label</th>
                <th>API Name</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {standardObjects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-gray-500 py-8">
                    No standard objects found
                  </td>
                </tr>
              ) : (
                standardObjects.map((obj) => (
                  <tr key={obj.object_id}>
                    <td className="font-medium">{obj.label}</td>
                    <td className="font-mono text-sm text-gray-600">{obj.object_name}</td>
                    <td className="text-gray-600">{obj.description || '-'}</td>
                    <td>
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        obj.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {obj.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/admin/objects/${obj.object_id}`}
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
      </div>

      {/* Custom Objects */}
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Custom Objects</h2>
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Label</th>
                <th>API Name</th>
                <th>Description</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customObjects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray-500 py-8">
                    No custom objects yet. Create your first custom object to get started!
                  </td>
                </tr>
              ) : (
                customObjects.map((obj) => (
                  <tr key={obj.object_id}>
                    <td className="font-medium">{obj.label}</td>
                    <td className="font-mono text-sm text-gray-600">{obj.object_name}</td>
                    <td className="text-gray-600">{obj.description || '-'}</td>
                    <td>
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        obj.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {obj.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-sm text-gray-600">
                      {new Date(obj.created_date).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Link
                          to={`/admin/objects/${obj.object_id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Manage
                        </Link>
                        <button
                          onClick={() => handleDelete(obj.object_id, obj.label)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminObjectsPage;
