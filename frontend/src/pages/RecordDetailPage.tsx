import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import {
  ObjectMeta,
  FieldMeta,
  RecordType,
  ObjectData,
} from '../types';

const RecordDetailPage: React.FC = () => {
  const { objectName, recordId } = useParams<{ objectName: string; recordId?: string }>();
  const navigate = useNavigate();
  const isNew = recordId === undefined || recordId === 'new';

  const [object, setObject] = useState<ObjectMeta | null>(null);
  const [fields, setFields] = useState<FieldMeta[]>([]);
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [record, setRecord] = useState<ObjectData | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [selectedRecordType, setSelectedRecordType] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [editMode, setEditMode] = useState(isNew);

  useEffect(() => {
    const fetchData = async () => {
      if (!objectName) return;

      setLoading(true);
      setError('');

      try {
        // Fetch metadata
        const [metadata, recordTypesData] = await Promise.all([
          api.getObjectMetadata(objectName),
          api.getRecordTypes(objectName),
        ]);

        setObject(metadata.object);
        setFields(metadata.fields);
        setRecordTypes(recordTypesData);

        // Find default record type
        const defaultRecordType = recordTypesData.find((rt) => rt.is_default);
        if (defaultRecordType) {
          setSelectedRecordType(defaultRecordType.record_type_id);
        }

        // Fetch record if editing
        if (!isNew && recordId) {
          const recordData = await api.getRecord(objectName, recordId);
          setRecord(recordData);
          setFormData(recordData.data);
          if (recordData.record_type_id) {
            setSelectedRecordType(recordData.record_type_id);
          }
        } else {
          // Initialize with default values for new records
          const initialData: Record<string, any> = {};
          metadata.fields.forEach((field) => {
            if (field.default_value) {
              initialData[field.field_name] = field.default_value;
            } else if (field.field_type === 'checkbox') {
              initialData[field.field_name] = false;
            }
          });
          setFormData(initialData);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load data');
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [objectName, recordId, isNew]);

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (isNew) {
        // Create new record
        await api.createRecord(objectName!, formData, selectedRecordType);
        navigate(`/objects/${objectName}`);
      } else {
        // Update existing record
        await api.updateRecord(objectName!, recordId!, formData);
        setEditMode(false);
        // Refresh record data
        const updatedRecord = await api.getRecord(objectName!, recordId!);
        setRecord(updatedRecord);
        setFormData(updatedRecord.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save record');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (isNew) {
      navigate(`/objects/${objectName}`);
    } else {
      setEditMode(false);
      if (record) {
        setFormData(record.data);
      }
    }
  };

  const renderField = (field: FieldMeta) => {
    const value = formData[field.field_name] || '';

    if (!editMode) {
      // View mode
      return (
        <div key={field.field_id} className="mb-6">
          <label className="label">{field.label}</label>
          <div className="text-gray-900">
            {field.field_type === 'checkbox'
              ? value
                ? 'Yes'
                : 'No'
              : field.field_type === 'picklist' && field.picklist_values
              ? field.picklist_values.find((pv) => pv.value === value)?.label || value
              : value || '-'}
          </div>
        </div>
      );
    }

    // Edit mode
    switch (field.field_type) {
      case 'textarea':
        return (
          <div key={field.field_id} className="mb-6">
            <label htmlFor={field.field_name} className="label">
              {field.label}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              id={field.field_name}
              value={value}
              onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
              required={field.is_required}
              className="input"
              rows={4}
            />
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.field_id} className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={value || false}
                onChange={(e) => handleFieldChange(field.field_name, e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-2"
              />
              <span className="text-sm font-medium text-gray-700">{field.label}</span>
            </label>
          </div>
        );

      case 'picklist':
        return (
          <div key={field.field_id} className="mb-6">
            <label htmlFor={field.field_name} className="label">
              {field.label}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              id={field.field_name}
              value={value}
              onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
              required={field.is_required}
              className="input"
            >
              <option value="">-- Select --</option>
              {field.picklist_values?.map((pv) => (
                <option key={pv.value} value={pv.value}>
                  {pv.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'number':
      case 'currency':
        return (
          <div key={field.field_id} className="mb-6">
            <label htmlFor={field.field_name} className="label">
              {field.label}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="number"
              id={field.field_name}
              value={value}
              onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
              required={field.is_required}
              className="input"
            />
          </div>
        );

      case 'date':
        return (
          <div key={field.field_id} className="mb-6">
            <label htmlFor={field.field_name} className="label">
              {field.label}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="date"
              id={field.field_name}
              value={value}
              onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
              required={field.is_required}
              className="input"
            />
          </div>
        );

      case 'email':
        return (
          <div key={field.field_id} className="mb-6">
            <label htmlFor={field.field_name} className="label">
              {field.label}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="email"
              id={field.field_name}
              value={value}
              onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
              required={field.is_required}
              className="input"
            />
          </div>
        );

      case 'phone':
        return (
          <div key={field.field_id} className="mb-6">
            <label htmlFor={field.field_name} className="label">
              {field.label}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="tel"
              id={field.field_name}
              value={value}
              onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
              required={field.is_required}
              className="input"
            />
          </div>
        );

      case 'url':
        return (
          <div key={field.field_id} className="mb-6">
            <label htmlFor={field.field_name} className="label">
              {field.label}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="url"
              id={field.field_name}
              value={value}
              onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
              required={field.is_required}
              className="input"
            />
          </div>
        );

      default:
        // text and other types
        return (
          <div key={field.field_id} className="mb-6">
            <label htmlFor={field.field_name} className="label">
              {field.label}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              id={field.field_name}
              value={value}
              onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
              required={field.is_required}
              maxLength={field.max_length || undefined}
              className="input"
            />
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!object) {
    return (
      <div className="card">
        <div className="text-red-600">{error || 'Object not found'}</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          to={`/objects/${objectName}`}
          className="text-primary-600 hover:text-primary-800 text-sm mb-2 inline-block"
        >
          ← Back to {object.plural_label}
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">
          {isNew ? `New ${object.label}` : editMode ? `Edit ${object.label}` : object.label}
        </h1>
      </div>

      {error && (
        <div className="mb-6 rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {/* Form */}
      <div className="card">
        <form onSubmit={handleSubmit}>
          {/* Record Type Selection (only for new records) */}
          {isNew && recordTypes.length > 0 && (
            <div className="mb-6 pb-6 border-b border-gray-200">
              <label htmlFor="recordType" className="label">
                Record Type <span className="text-red-500">*</span>
              </label>
              <select
                id="recordType"
                value={selectedRecordType}
                onChange={(e) => setSelectedRecordType(e.target.value)}
                required
                className="input max-w-md"
              >
                <option value="">-- Select Record Type --</option>
                {recordTypes.map((rt) => (
                  <option key={rt.record_type_id} value={rt.record_type_id}>
                    {rt.record_type_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            {fields.map((field) => renderField(field))}
          </div>

          {/* Actions */}
          <div className="mt-8 pt-6 border-t border-gray-200 flex gap-3">
            {editMode ? (
              <>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="btn btn-primary"
              >
                Edit
              </button>
            )}
          </div>
        </form>

        {/* Record Info */}
        {!isNew && record && (
          <div className="mt-8 pt-6 border-t border-gray-200 text-sm text-gray-600">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-medium">Created:</span>{' '}
                {new Date(record.created_date).toLocaleString()}
              </div>
              <div>
                <span className="font-medium">Modified:</span>{' '}
                {new Date(record.modified_date).toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordDetailPage;
