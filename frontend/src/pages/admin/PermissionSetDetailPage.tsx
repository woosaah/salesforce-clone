import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';

const PermissionSetDetailPage: React.FC = () => {
  const { permissionSetId } = useParams<{ permissionSetId: string }>();
  const navigate = useNavigate();
  const isNew = permissionSetId === 'new';

  const [formData, setFormData] = useState({
    permission_set_name: '',
    label: '',
    description: '',
  });

  const [objects, setObjects] = useState<any[]>([]);
  const [objectPerms, setObjectPerms] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [permissionSetId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load objects
      const objRes = await api.get('/admin/objects');
      if (objRes.data.success) {
        setObjects(objRes.data.data);
      }

      // Load permission set data if editing
      if (!isNew) {
        const psRes = await api.get(`/permission-sets/${permissionSetId}`);
        if (psRes.data.success) {
          const ps = psRes.data.data.permissionSet;
          setFormData({
            permission_set_name: ps.permission_set_name,
            label: ps.label,
            description: ps.description || '',
          });

          // Convert object permissions to map
          const permsMap: Record<string, any> = {};
          psRes.data.data.objectPermissions.forEach((perm: any) => {
            permsMap[perm.object_id] = perm;
          });
          setObjectPerms(permsMap);
        }
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isNew) {
        const response = await api.post('/permission-sets', formData);
        if (response.data.success) {
          navigate(`/admin/permission-sets/${response.data.data.permission_set_id}`);
        }
      } else {
        await api.put(`/permission-sets/${permissionSetId}`, formData);
        alert('Saved successfully!');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save');
    }
  };

  const handleObjectPermChange = async (objectId: string, field: string, value: boolean) => {
    const updated = {
      ...objectPerms[objectId],
      [field]: value,
    };

    // Ensure read is enabled if create/edit/delete is enabled
    if ((field === 'can_create' || field === 'can_edit' || field === 'can_delete') && value) {
      updated.can_read = true;
    }

    setObjectPerms({ ...objectPerms, [objectId]: updated });

    // Save to server if not new
    if (!isNew) {
      try {
        await api.put(`/permission-sets/${permissionSetId}/object-permissions/${objectId}`, {
          can_read: updated.can_read || false,
          can_create: updated.can_create || false,
          can_edit: updated.can_edit || false,
          can_delete: updated.can_delete || false,
          can_view_all: updated.can_view_all || false,
          can_modify_all: updated.can_modify_all || false,
        });
      } catch (err: any) {
        console.error('Error saving permission:', err);
        alert('Failed to save permission');
      }
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link to="/admin/permission-sets" className="text-blue-600 hover:text-blue-800 mb-2 inline-block">← Back</Link>
        <h1 className="text-3xl font-bold text-gray-900">{isNew ? 'New Permission Set' : formData.label}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Information</h2>
          <div className="space-y-4">
            {isNew && (
              <div>
                <label className="label">API Name *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.permission_set_name}
                  onChange={(e) => setFormData({ ...formData, permission_set_name: e.target.value })}
                  required
                  pattern="[a-zA-Z][a-zA-Z0-9_]*"
                />
              </div>
            )}
            <div>
              <label className="label">Label *</label>
              <input
                type="text"
                className="input"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                className="input"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4">
            <button type="submit" className="btn btn-primary">Save</button>
          </div>
        </div>
      </form>

      {!isNew && (
        <div className="card mt-6">
          <h2 className="text-xl font-semibold mb-4">Object Permissions</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Object</th>
                  <th>Read</th>
                  <th>Create</th>
                  <th>Edit</th>
                  <th>Delete</th>
                  <th>View All</th>
                  <th>Modify All</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {objects.map((obj) => {
                  const perms = objectPerms[obj.object_id] || {};
                  return (
                    <tr key={obj.object_id}>
                      <td className="font-medium">{obj.label}</td>
                      <td>
                        <input
                          type="checkbox"
                          checked={perms.can_read || false}
                          onChange={(e) => handleObjectPermChange(obj.object_id, 'can_read', e.target.checked)}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={perms.can_create || false}
                          onChange={(e) => handleObjectPermChange(obj.object_id, 'can_create', e.target.checked)}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={perms.can_edit || false}
                          onChange={(e) => handleObjectPermChange(obj.object_id, 'can_edit', e.target.checked)}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={perms.can_delete || false}
                          onChange={(e) => handleObjectPermChange(obj.object_id, 'can_delete', e.target.checked)}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={perms.can_view_all || false}
                          onChange={(e) => handleObjectPermChange(obj.object_id, 'can_view_all', e.target.checked)}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={perms.can_modify_all || false}
                          onChange={(e) => handleObjectPermChange(obj.object_id, 'can_modify_all', e.target.checked)}
                        />
                      </td>
                      <td>
                        <Link
                          to={`/admin/permission-sets/${permissionSetId}/fields/${obj.object_id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Field Permissions →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PermissionSetDetailPage;
