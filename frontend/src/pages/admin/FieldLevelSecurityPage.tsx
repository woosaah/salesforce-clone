import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';

const FieldLevelSecurityPage: React.FC = () => {
  const { permissionSetId, objectId } = useParams<{ permissionSetId: string; objectId: string }>();

  const [permissionSet, setPermissionSet] = useState<any>(null);
  const [object, setObject] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [fieldPerms, setFieldPerms] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load permission set
      const psRes = await api.get(`/permission-sets/${permissionSetId}`);
      if (psRes.data.success) {
        setPermissionSet(psRes.data.data.permissionSet);

        // Convert field permissions to map
        const permsMap: Record<string, any> = {};
        psRes.data.data.fieldPermissions.forEach((perm: any) => {
          permsMap[perm.field_id] = perm;
        });
        setFieldPerms(permsMap);
      }

      // Load object and fields
      const objRes = await api.get(`/admin/objects/${objectId}`);
      if (objRes.data.success) {
        setObject(objRes.data.data.object);
        setFields(objRes.data.data.fields);
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePermChange = async (fieldId: string, permType: 'can_read' | 'can_edit', value: boolean) => {
    const updated = {
      ...fieldPerms[fieldId],
      [permType]: value,
    };

    // If setting edit, must also have read
    if (permType === 'can_edit' && value) {
      updated.can_read = true;
    }

    setFieldPerms({ ...fieldPerms, [fieldId]: updated });

    // Save to server
    try {
      await api.put(`/permission-sets/${permissionSetId}/field-permissions/${fieldId}`, {
        can_read: updated.can_read || false,
        can_edit: updated.can_edit || false,
      });
    } catch (err: any) {
      console.error('Error saving permission:', err);
      alert('Failed to save permission');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          to={`/admin/permission-sets/${permissionSetId}`}
          className="text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          ← Back to {permissionSet?.label}
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Field-Level Security</h1>
        <p className="text-gray-600 mt-1">
          {object?.label} - {permissionSet?.label}
        </p>
      </div>

      <div className="card">
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Configure field-level permissions for this object. Users with this permission set will only
            be able to see and edit the fields you specify below.
          </p>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Field</th>
              <th>API Name</th>
              <th>Type</th>
              <th className="text-center">Read Access</th>
              <th className="text-center">Edit Access</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => {
              const perms = fieldPerms[field.field_id] || {};
              return (
                <tr key={field.field_id}>
                  <td className="font-medium">{field.label}</td>
                  <td className="font-mono text-sm text-gray-600">{field.field_name}</td>
                  <td>
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                      {field.field_type}
                    </span>
                  </td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      checked={perms.can_read || false}
                      onChange={(e) => handlePermChange(field.field_id, 'can_read', e.target.checked)}
                    />
                  </td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      checked={perms.can_edit || false}
                      onChange={(e) => handlePermChange(field.field_id, 'can_edit', e.target.checked)}
                      disabled={field.field_type === 'formula' || field.field_type === 'rollup_summary' || field.field_type === 'auto_number'}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <h3 className="font-semibold text-blue-900 mb-2">About Field-Level Security</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Read Access: User can see the field value</li>
          <li>• Edit Access: User can modify the field value (requires Read Access)</li>
          <li>• Formula and calculated fields cannot be edited</li>
          <li>• Field permissions work in conjunction with object permissions</li>
        </ul>
      </div>
    </div>
  );
};

export default FieldLevelSecurityPage;
