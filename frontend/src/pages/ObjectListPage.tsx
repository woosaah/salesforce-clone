import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api';
import {
  ObjectMeta,
  FieldMeta,
  RecordType,
  ObjectData,
  RecordsListResponse,
} from '../types';

const ObjectListPage: React.FC = () => {
  const { objectName } = useParams<{ objectName: string }>();
  const [object, setObject] = useState<ObjectMeta | null>(null);
  const [fields, setFields] = useState<FieldMeta[]>([]);
  const [recordTypes, setRecordTypes] = useState<RecordType[]>([]);
  const [records, setRecords] = useState<ObjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selectedRecordType, setSelectedRecordType] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      if (!objectName) return;

      setLoading(true);
      setError('');

      try {
        // Fetch metadata and records in parallel
        const [metadata, recordTypesData, recordsData] = await Promise.all([
          api.getObjectMetadata(objectName),
          api.getRecordTypes(objectName),
          api.getRecords(objectName, { limit: 50 }),
        ]);

        setObject(metadata.object);
        setFields(metadata.fields);
        setRecordTypes(recordTypesData);
        setRecords(recordsData.records);
      } catch (err: any) {
        setError(err.message || 'Failed to load data');
        console.error('Error fetching object data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [objectName]);

  const handleRecordTypeFilter = async (recordTypeId: string) => {
    setSelectedRecordType(recordTypeId);
    setLoading(true);

    try {
      const recordsData = await api.getRecords(objectName!, {
        limit: 50,
        recordTypeId: recordTypeId || undefined,
      });
      setRecords(recordsData.records);
    } catch (err: any) {
      setError(err.message || 'Failed to filter records');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (recordId: string) => {
    if (!window.confirm('Are you sure you want to delete this record?')) {
      return;
    }

    try {
      await api.deleteRecord(objectName!, recordId);
      setRecords(records.filter((r) => r.record_id !== recordId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete record');
    }
  };

  // Get display fields (first 5 fields for table)
  const displayFields = fields.slice(0, 5);

  if (loading && !object) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error && !object) {
    return (
      <div className="card">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  if (!object) {
    return (
      <div className="card">
        <div className="text-gray-600">Object not found</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{object.plural_label}</h1>
          <p className="text-gray-600 mt-1">{object.description}</p>
        </div>
        <Link
          to={`/objects/${objectName}/new`}
          className="btn btn-primary"
        >
          New {object.label}
        </Link>
      </div>

      {/* Filters */}
      {recordTypes.length > 0 && (
        <div className="mb-6 flex gap-4">
          <select
            value={selectedRecordType}
            onChange={(e) => handleRecordTypeFilter(e.target.value)}
            className="input max-w-xs"
          >
            <option value="">All Record Types</option>
            {recordTypes.map((rt) => (
              <option key={rt.record_type_id} value={rt.record_type_id}>
                {rt.record_type_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Records Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-600">Loading records...</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-gray-600">
            No records found. Click "New {object.label}" to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead className="table-header">
                <tr>
                  {displayFields.map((field) => (
                    <th
                      key={field.field_id}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {field.label}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {records.map((record) => (
                  <tr key={record.record_id} className="hover:bg-gray-50">
                    {displayFields.map((field) => (
                      <td key={field.field_id} className="table-cell">
                        {field.field_type === 'checkbox'
                          ? record.data[field.field_name]
                            ? '✓'
                            : ''
                          : record.data[field.field_name] || '-'}
                      </td>
                    ))}
                    <td className="table-cell text-gray-500">
                      {new Date(record.created_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        to={`/objects/${objectName}/${record.record_id}`}
                        className="text-primary-600 hover:text-primary-900 mr-4"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleDelete(record.record_id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record count */}
      {!loading && records.length > 0 && (
        <div className="mt-4 text-sm text-gray-600">
          Showing {records.length} record{records.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default ObjectListPage;
