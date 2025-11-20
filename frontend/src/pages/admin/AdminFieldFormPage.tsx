import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';

interface ObjectMeta {
  object_id: string;
  object_name: string;
  label: string;
}

interface PicklistValue {
  label: string;
  value: string;
  is_default: boolean;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text', category: 'Basic' },
  { value: 'textarea', label: 'Text Area (Long Text)', category: 'Basic' },
  { value: 'email', label: 'Email', category: 'Basic' },
  { value: 'phone', label: 'Phone', category: 'Basic' },
  { value: 'url', label: 'URL', category: 'Basic' },
  { value: 'number', label: 'Number', category: 'Numeric' },
  { value: 'currency', label: 'Currency', category: 'Numeric' },
  { value: 'percent', label: 'Percent', category: 'Numeric' },
  { value: 'date', label: 'Date', category: 'Date/Time' },
  { value: 'datetime', label: 'Date/Time', category: 'Date/Time' },
  { value: 'time', label: 'Time', category: 'Date/Time' },
  { value: 'checkbox', label: 'Checkbox', category: 'Selection' },
  { value: 'picklist', label: 'Picklist', category: 'Selection' },
  { value: 'multipicklist', label: 'Multi-Select Picklist', category: 'Selection' },
  { value: 'lookup', label: 'Lookup Relationship', category: 'Relationship' },
  { value: 'master_detail', label: 'Master-Detail Relationship', category: 'Relationship' },
  { value: 'formula', label: 'Formula', category: 'Advanced' },
  { value: 'rollup_summary', label: 'Roll-Up Summary', category: 'Advanced' },
  { value: 'auto_number', label: 'Auto Number', category: 'Advanced' },
];

const AdminFieldFormPage: React.FC = () => {
  const { objectId, fieldId } = useParams<{ objectId: string; fieldId: string }>();
  const navigate = useNavigate();
  const isNewField = fieldId === 'new';

  const [object, setObject] = useState<ObjectMeta | null>(null);
  const [allObjects, setAllObjects] = useState<ObjectMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    field_name: '',
    label: '',
    field_type: 'text',
    is_required: false,
    is_unique: false,
    default_value: '',
    description: '',
    max_length: 255,
    min_value: '',
    max_value: '',
    lookup_object_id: '',
    formula_expression: '',
  });

  const [picklistValues, setPicklistValues] = useState<PicklistValue[]>([
    { label: '', value: '', is_default: false }
  ]);

  useEffect(() => {
    loadData();
  }, [objectId, fieldId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load object
      const objResponse = await api.get(`/admin/objects/${objectId}`);
      if (objResponse.data.success) {
        setObject(objResponse.data.data.object);
      }

      // Load all objects for lookup fields
      const allObjResponse = await api.get('/admin/objects');
      if (allObjResponse.data.success) {
        setAllObjects(allObjResponse.data.data);
      }

      // Load field data if editing
      if (!isNewField) {
        const fieldResponse = await api.get(`/admin/objects/${objectId}`);
        if (fieldResponse.data.success) {
          const field = fieldResponse.data.data.fields.find((f: any) => f.field_id === fieldId);
          if (field) {
            setFormData({
              field_name: field.field_name,
              label: field.label,
              field_type: field.field_type,
              is_required: field.is_required,
              is_unique: field.is_unique,
              default_value: field.default_value || '',
              description: field.description || '',
              max_length: field.max_length || 255,
              min_value: field.min_value || '',
              max_value: field.max_value || '',
              lookup_object_id: field.lookup_object_id || '',
              formula_expression: field.formula_expression || '',
            });

            if (field.picklist_values) {
              const values = typeof field.picklist_values === 'string'
                ? JSON.parse(field.picklist_values)
                : field.picklist_values;
              setPicklistValues(values.length > 0 ? values : [{ label: '', value: '', is_default: false }]);
            }
          }
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

    // Validate picklist values
    if ((formData.field_type === 'picklist' || formData.field_type === 'multipicklist')) {
      const validValues = picklistValues.filter(pv => pv.label && pv.value);
      if (validValues.length === 0) {
        alert('Please add at least one picklist value');
        return;
      }
    }

    // Validate lookup object
    if ((formData.field_type === 'lookup' || formData.field_type === 'master_detail') && !formData.lookup_object_id) {
      alert('Please select a lookup object');
      return;
    }

    try {
      const payload: any = {
        ...formData,
        max_length: formData.max_length || null,
        min_value: formData.min_value ? parseFloat(formData.min_value) : null,
        max_value: formData.max_value ? parseFloat(formData.max_value) : null,
      };

      if (formData.field_type === 'picklist' || formData.field_type === 'multipicklist') {
        payload.picklist_values = picklistValues.filter(pv => pv.label && pv.value);
      }

      if (isNewField) {
        await api.post(`/admin/objects/${objectId}/fields`, payload);
      } else {
        await api.put(`/admin/objects/${objectId}/fields/${fieldId}`, payload);
      }

      navigate(`/admin/objects/${objectId}?tab=fields`);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save field');
      console.error('Error saving field:', err);
    }
  };

  const addPicklistValue = () => {
    setPicklistValues([...picklistValues, { label: '', value: '', is_default: false }]);
  };

  const removePicklistValue = (index: number) => {
    setPicklistValues(picklistValues.filter((_, i) => i !== index));
  };

  const updatePicklistValue = (index: number, field: keyof PicklistValue, value: any) => {
    const updated = [...picklistValues];
    updated[index] = { ...updated[index], [field]: value };

    // If setting this as default, unset others
    if (field === 'is_default' && value) {
      updated.forEach((pv, i) => {
        if (i !== index) pv.is_default = false;
      });
    }

    setPicklistValues(updated);
  };

  const shouldShowField = (fieldName: string): boolean => {
    const type = formData.field_type;

    switch (fieldName) {
      case 'max_length':
        return ['text', 'email', 'phone', 'url', 'textarea'].includes(type);
      case 'min_max_value':
        return ['number', 'currency', 'percent'].includes(type);
      case 'picklist_values':
        return ['picklist', 'multipicklist'].includes(type);
      case 'lookup_object':
        return ['lookup', 'master_detail'].includes(type);
      case 'formula_expression':
        return type === 'formula';
      case 'default_value':
        return !['lookup', 'master_detail', 'formula', 'rollup_summary', 'auto_number'].includes(type);
      case 'is_unique':
        return !['checkbox', 'textarea', 'multipicklist', 'lookup', 'master_detail', 'formula', 'rollup_summary'].includes(type);
      default:
        return true;
    }
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
        <Link to={`/admin/objects/${objectId}?tab=fields`} className="text-blue-600 hover:text-blue-800 mb-2 inline-block">
          ← Back to {object?.label}
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">
          {isNewField ? 'New Field' : 'Edit Field'}
        </h1>
        <p className="text-gray-600 mt-1">Object: {object?.label}</p>
      </div>

      <div className="card max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Field Information Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Field Information</h2>

            {isNewField && (
              <div>
                <label htmlFor="field_name" className="label">
                  Field Name * <span className="text-sm text-gray-500">(API Name)</span>
                </label>
                <input
                  type="text"
                  id="field_name"
                  className="input"
                  value={formData.field_name}
                  onChange={(e) => setFormData({ ...formData, field_name: e.target.value })}
                  required
                  pattern="[a-zA-Z][a-zA-Z0-9_]*"
                  title="Must start with a letter and contain only letters, numbers, and underscores"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Must start with a letter and contain only alphanumeric characters and underscores
                </p>
              </div>
            )}

            <div>
              <label htmlFor="label" className="label">
                Field Label *
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
              <label htmlFor="field_type" className="label">
                Data Type *
              </label>
              <select
                id="field_type"
                className="input"
                value={formData.field_type}
                onChange={(e) => setFormData({ ...formData, field_type: e.target.value })}
                disabled={!isNewField}
                required
              >
                <optgroup label="Basic">
                  {FIELD_TYPES.filter(ft => ft.category === 'Basic').map(ft => (
                    <option key={ft.value} value={ft.value}>{ft.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Numeric">
                  {FIELD_TYPES.filter(ft => ft.category === 'Numeric').map(ft => (
                    <option key={ft.value} value={ft.value}>{ft.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Date/Time">
                  {FIELD_TYPES.filter(ft => ft.category === 'Date/Time').map(ft => (
                    <option key={ft.value} value={ft.value}>{ft.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Selection">
                  {FIELD_TYPES.filter(ft => ft.category === 'Selection').map(ft => (
                    <option key={ft.value} value={ft.value}>{ft.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Relationship">
                  {FIELD_TYPES.filter(ft => ft.category === 'Relationship').map(ft => (
                    <option key={ft.value} value={ft.value}>{ft.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Advanced">
                  {FIELD_TYPES.filter(ft => ft.category === 'Advanced').map(ft => (
                    <option key={ft.value} value={ft.value}>{ft.label}</option>
                  ))}
                </optgroup>
              </select>
              {!isNewField && (
                <p className="text-sm text-gray-500 mt-1">
                  Field type cannot be changed after creation
                </p>
              )}
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
                placeholder="Help text for this field"
              />
            </div>
          </div>

          {/* Field Type Specific Configuration */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Field Configuration</h2>

            {/* Text Length */}
            {shouldShowField('max_length') && (
              <div>
                <label htmlFor="max_length" className="label">
                  Maximum Length
                </label>
                <input
                  type="number"
                  id="max_length"
                  className="input"
                  value={formData.max_length}
                  onChange={(e) => setFormData({ ...formData, max_length: parseInt(e.target.value) || 255 })}
                  min="1"
                  max="131072"
                />
              </div>
            )}

            {/* Numeric Min/Max */}
            {shouldShowField('min_max_value') && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="min_value" className="label">
                    Minimum Value
                  </label>
                  <input
                    type="number"
                    id="min_value"
                    className="input"
                    value={formData.min_value}
                    onChange={(e) => setFormData({ ...formData, min_value: e.target.value })}
                    step="any"
                  />
                </div>
                <div>
                  <label htmlFor="max_value" className="label">
                    Maximum Value
                  </label>
                  <input
                    type="number"
                    id="max_value"
                    className="input"
                    value={formData.max_value}
                    onChange={(e) => setFormData({ ...formData, max_value: e.target.value })}
                    step="any"
                  />
                </div>
              </div>
            )}

            {/* Picklist Values */}
            {shouldShowField('picklist_values') && (
              <div>
                <label className="label">
                  Picklist Values *
                </label>
                <div className="space-y-2">
                  {picklistValues.map((pv, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <input
                          type="text"
                          className="input"
                          placeholder="Label"
                          value={pv.label}
                          onChange={(e) => updatePicklistValue(index, 'label', e.target.value)}
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          className="input"
                          placeholder="Value (API)"
                          value={pv.value}
                          onChange={(e) => updatePicklistValue(index, 'value', e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 whitespace-nowrap text-sm">
                          <input
                            type="checkbox"
                            checked={pv.is_default}
                            onChange={(e) => updatePicklistValue(index, 'is_default', e.target.checked)}
                          />
                          Default
                        </label>
                        {picklistValues.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePicklistValue(index)}
                            className="text-red-600 hover:text-red-800 px-2"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addPicklistValue}
                  className="btn mt-2"
                >
                  + Add Value
                </button>
              </div>
            )}

            {/* Lookup Object */}
            {shouldShowField('lookup_object') && (
              <div>
                <label htmlFor="lookup_object_id" className="label">
                  Related To *
                </label>
                <select
                  id="lookup_object_id"
                  className="input"
                  value={formData.lookup_object_id}
                  onChange={(e) => setFormData({ ...formData, lookup_object_id: e.target.value })}
                  required
                >
                  <option value="">-- Select Object --</option>
                  {allObjects.map(obj => (
                    <option key={obj.object_id} value={obj.object_id}>
                      {obj.label} ({obj.object_name})
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  {formData.field_type === 'master_detail'
                    ? 'Master-detail relationships create a tight parent-child relationship'
                    : 'Lookup relationships allow you to associate records with other records'
                  }
                </p>
              </div>
            )}

            {/* Formula Expression */}
            {shouldShowField('formula_expression') && (
              <div>
                <label htmlFor="formula_expression" className="label">
                  Formula Expression
                </label>
                <textarea
                  id="formula_expression"
                  className="input font-mono text-sm"
                  rows={4}
                  value={formData.formula_expression}
                  onChange={(e) => setFormData({ ...formData, formula_expression: e.target.value })}
                  placeholder="e.g., Amount * 0.1"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Enter a formula expression to calculate this field's value
                </p>
              </div>
            )}

            {/* Default Value */}
            {shouldShowField('default_value') && (
              <div>
                <label htmlFor="default_value" className="label">
                  Default Value
                </label>
                {formData.field_type === 'checkbox' ? (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.default_value === 'true'}
                      onChange={(e) => setFormData({ ...formData, default_value: e.target.checked ? 'true' : 'false' })}
                    />
                    <span>Checked by default</span>
                  </label>
                ) : (
                  <input
                    type="text"
                    id="default_value"
                    className="input"
                    value={formData.default_value}
                    onChange={(e) => setFormData({ ...formData, default_value: e.target.value })}
                  />
                )}
              </div>
            )}
          </div>

          {/* Field Options */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Field Options</h2>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_required}
                  onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                />
                <span className="font-medium">Required</span>
              </label>
              <p className="text-sm text-gray-500 ml-6">Always require a value in this field</p>
            </div>

            {shouldShowField('is_unique') && (
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_unique}
                    onChange={(e) => setFormData({ ...formData, is_unique: e.target.checked })}
                  />
                  <span className="font-medium">Unique</span>
                </label>
                <p className="text-sm text-gray-500 ml-6">Do not allow duplicate values</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <button type="submit" className="btn btn-primary">
              {isNewField ? 'Create Field' : 'Save Changes'}
            </button>
            <Link to={`/admin/objects/${objectId}?tab=fields`} className="btn">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminFieldFormPage;
