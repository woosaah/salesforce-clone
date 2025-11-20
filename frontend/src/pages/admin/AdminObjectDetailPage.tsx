import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';

interface ObjectMeta {
  object_id: string;
  object_name: string;
  label: string;
  plural_label: string;
  is_custom: boolean;
  is_active: boolean;
  description?: string;
}

interface FieldMeta {
  field_id: string;
  field_name: string;
  label: string;
  field_type: string;
  is_required: boolean;
  is_unique: boolean;
  default_value?: string;
  description?: string;
  max_length?: number;
  min_value?: number;
  max_value?: number;
  picklist_values?: any[];
  lookup_object_id?: string;
  lookup_object_name?: string;
  lookup_object_label?: string;
  formula_expression?: string;
}

interface RecordType {
  record_type_id: string;
  record_type_name: string;
  label: string;
  description?: string;
  is_default: boolean;
}

type TabType = 'details' | 'fields' | 'recordTypes';

const AdminObjectDetailPage: React.FC = () => {
  const { objectId } = useParams<{ objectId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('details');

  const [object, setObject] = useState<ObjectMeta | null>(null);
  const [fields, setFields] = useState<FieldMeta[]>([]);
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode for object details
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    label: '',
    plural_label: '',
    description: '',
    is_active: true,
  });

  // New record type form
  const [showRecordTypeForm, setShowRecordTypeForm] = useState(false);
  const [recordTypeForm, setRecordTypeForm] = useState({
    record_type_name: '',
    label: '',
    description: '',
    is_default: false,
  });

  useEffect(() => {
    if (objectId && objectId !== 'new') {
      loadObjectData();
    } else if (objectId === 'new') {
      setLoading(false);
      setEditMode(true);
    }
  }, [objectId]);

  const loadObjectData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get(`/admin/objects/${objectId}`);
      if (response.data.success) {
        const objData = response.data.data.object;
        const fieldsData = response.data.data.fields;

        setObject(objData);
        setFields(fieldsData);
        setFormData({
          label: objData.label,
          plural_label: objData.plural_label,
          description: objData.description || '',
          is_active: objData.is_active,
        });
      }

      // Load record types
      const rtResponse = await api.get(`/admin/objects/${objectId}/record-types`);
      if (rtResponse.data.success) {
        setRecordTypes(rtResponse.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load object data');
      console.error('Error loading object:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveObject = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (objectId === 'new') {
        // Create new object
        const objectNameInput = (document.getElementById('object_name') as HTMLInputElement)?.value;
        const response = await api.post('/admin/objects', {
          object_name: objectNameInput,
          ...formData,
        });

        if (response.data.success) {
          navigate(`/admin/objects/${response.data.data.object_id}`);
        }
      } else {
        // Update existing object
        const response = await api.put(`/admin/objects/${objectId}`, formData);
        if (response.data.success) {
          setObject(response.data.data);
          setEditMode(false);
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save object');
      console.error('Error saving object:', err);
    }
  };

  const handleDeleteField = async (fieldId: string, fieldLabel: string) => {
    if (!window.confirm(`Are you sure you want to delete the field "${fieldLabel}"?`)) {
      return;
    }

    try {
      await api.delete(`/admin/objects/${objectId}/fields/${fieldId}`);
      loadObjectData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete field');
      console.error('Error deleting field:', err);
    }
  };

  const handleCreateRecordType = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await api.post(`/admin/objects/${objectId}/record-types`, recordTypeForm);
      setShowRecordTypeForm(false);
      setRecordTypeForm({
        record_type_name: '',
        label: '',
        description: '',
        is_default: false,
      });
      loadObjectData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create record type');
      console.error('Error creating record type:', err);
    }
  };

  const handleDeleteRecordType = async (recordTypeId: string, label: string) => {
    if (!window.confirm(`Are you sure you want to delete the record type "${label}"?`)) {
      return;
    }

    try {
      await api.delete(`/admin/objects/${objectId}/record-types/${recordTypeId}`);
      loadObjectData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete record type');
      console.error('Error deleting record type:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
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
        <Link to="/admin/objects" className="text-blue-600 hover:text-blue-800 mb-2 inline-block">
          ← Back to Objects
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">
          {objectId === 'new' ? 'New Custom Object' : object?.label}
        </h1>
        {object && (
          <p className="text-gray-600 mt-1">
            API Name: <span className="font-mono">{object.object_name}</span>
          </p>
        )}
      </div>

      {objectId !== 'new' && (
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'details'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('fields')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'fields'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Fields ({fields.length})
            </button>
            <button
              onClick={() => setActiveTab('recordTypes')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'recordTypes'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Record Types ({recordTypes.length})
            </button>
          </nav>
        </div>
      )}

      {/* DETAILS TAB */}
      {(activeTab === 'details' || objectId === 'new') && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Object Information</h2>
            {!editMode && objectId !== 'new' && (
              <button
                onClick={() => setEditMode(true)}
                className="btn btn-primary"
              >
                Edit
              </button>
            )}
          </div>

          {editMode ? (
            <form onSubmit={handleSaveObject} className="space-y-4">
              {objectId === 'new' && (
                <div>
                  <label htmlFor="object_name" className="label">
                    API Name *
                  </label>
                  <input
                    type="text"
                    id="object_name"
                    className="input"
                    required
                    pattern="[a-zA-Z][a-zA-Z0-9_]*"
                    title="Must start with a letter and contain only letters, numbers, and underscores"
                    placeholder="MyCustomObject"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Must start with a letter and contain only alphanumeric characters and underscores
                  </p>
                </div>
              )}

              <div>
                <label htmlFor="label" className="label">
                  Label *
                </label>
                <input
                  type="text"
                  id="label"
                  className="input"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  required
                />
              </div>

              <div>
                <label htmlFor="plural_label" className="label">
                  Plural Label *
                </label>
                <input
                  type="text"
                  id="plural_label"
                  className="input"
                  value={formData.plural_label}
                  onChange={(e) => setFormData({ ...formData, plural_label: e.target.value })}
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="label">
                  Description
                </label>
                <textarea
                  id="description"
                  className="input"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {objectId !== 'new' && (
                <div>
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

              <div className="flex gap-2 pt-4">
                <button type="submit" className="btn btn-primary">
                  {objectId === 'new' ? 'Create Object' : 'Save Changes'}
                </button>
                {objectId !== 'new' && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditMode(false);
                      if (object) {
                        setFormData({
                          label: object.label,
                          plural_label: object.plural_label,
                          description: object.description || '',
                          is_active: object.is_active,
                        });
                      }
                    }}
                    className="btn"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-500">Label</div>
                <div className="text-gray-900">{object?.label}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Plural Label</div>
                <div className="text-gray-900">{object?.plural_label}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Description</div>
                <div className="text-gray-900">{object?.description || '-'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Status</div>
                <span className={`px-2 py-1 text-xs font-semibold rounded ${
                  object?.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {object?.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FIELDS TAB */}
      {activeTab === 'fields' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Fields</h2>
            <Link
              to={`/admin/objects/${objectId}/fields/new`}
              className="btn btn-primary"
            >
              + New Field
            </Link>
          </div>

          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>API Name</th>
                  <th>Data Type</th>
                  <th>Required</th>
                  <th>Unique</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fields.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-500 py-8">
                      No fields yet. Create your first field to get started!
                    </td>
                  </tr>
                ) : (
                  fields.map((field) => (
                    <tr key={field.field_id}>
                      <td className="font-medium">{field.label}</td>
                      <td className="font-mono text-sm text-gray-600">{field.field_name}</td>
                      <td>
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                          {field.field_type}
                        </span>
                        {(field.field_type === 'lookup' || field.field_type === 'master_detail') && (
                          <div className="text-xs text-gray-500 mt-1">
                            → {field.lookup_object_label || field.lookup_object_name}
                          </div>
                        )}
                      </td>
                      <td>
                        {field.is_required ? (
                          <span className="text-red-600 font-medium">✓</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td>
                        {field.is_unique ? (
                          <span className="text-blue-600 font-medium">✓</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <Link
                            to={`/admin/objects/${objectId}/fields/${field.field_id}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </Link>
                          {field.field_name !== 'Name' && (
                            <button
                              onClick={() => handleDeleteField(field.field_id, field.label)}
                              className="text-red-600 hover:text-red-800 font-medium"
                            >
                              Delete
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
        </div>
      )}

      {/* RECORD TYPES TAB */}
      {activeTab === 'recordTypes' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Record Types</h2>
            <button
              onClick={() => setShowRecordTypeForm(true)}
              className="btn btn-primary"
            >
              + New Record Type
            </button>
          </div>

          {showRecordTypeForm && (
            <div className="card mb-4">
              <h3 className="text-lg font-semibold mb-4">Create Record Type</h3>
              <form onSubmit={handleCreateRecordType} className="space-y-4">
                <div>
                  <label htmlFor="rt_name" className="label">
                    Record Type Name *
                  </label>
                  <input
                    type="text"
                    id="rt_name"
                    className="input"
                    value={recordTypeForm.record_type_name}
                    onChange={(e) => setRecordTypeForm({ ...recordTypeForm, record_type_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="rt_label" className="label">
                    Label *
                  </label>
                  <input
                    type="text"
                    id="rt_label"
                    className="input"
                    value={recordTypeForm.label}
                    onChange={(e) => setRecordTypeForm({ ...recordTypeForm, label: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="rt_description" className="label">
                    Description
                  </label>
                  <textarea
                    id="rt_description"
                    className="input"
                    rows={2}
                    value={recordTypeForm.description}
                    onChange={(e) => setRecordTypeForm({ ...recordTypeForm, description: e.target.value })}
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={recordTypeForm.is_default}
                      onChange={(e) => setRecordTypeForm({ ...recordTypeForm, is_default: e.target.checked })}
                    />
                    <span className="font-medium">Make this the default record type</span>
                  </label>
                </div>

                <div className="flex gap-2">
                  <button type="submit" className="btn btn-primary">
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRecordTypeForm(false);
                      setRecordTypeForm({
                        record_type_name: '',
                        label: '',
                        description: '',
                        is_default: false,
                      });
                    }}
                    className="btn"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>API Name</th>
                  <th>Description</th>
                  <th>Default</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recordTypes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-500 py-8">
                      No record types yet. Create your first record type!
                    </td>
                  </tr>
                ) : (
                  recordTypes.map((rt) => (
                    <tr key={rt.record_type_id}>
                      <td className="font-medium">{rt.label}</td>
                      <td className="font-mono text-sm text-gray-600">{rt.record_type_name}</td>
                      <td className="text-gray-600">{rt.description || '-'}</td>
                      <td>
                        {rt.is_default && (
                          <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded">
                            Default
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => handleDeleteRecordType(rt.record_type_id, rt.label)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminObjectDetailPage;
