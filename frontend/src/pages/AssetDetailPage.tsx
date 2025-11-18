import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';

const AssetDetailPage: React.FC = () => {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();
  const isNew = assetId === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(isNew);
  const [assetData, setAssetData] = useState<any>({
    asset_name: '',
    asset_type: '',
    description: '',
    serial_number: '',
    status: 'Available',
    condition: 'Good',
    current_location: '',
    notes: '',
  });
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    fetchAccounts();
    if (!isNew) {
      fetchAsset();
      fetchMaintenance();
    }
  }, [assetId]);

  const fetchAccounts = async () => {
    try {
      const data = await api.getRecords('Account', { limit: 1000 });
      setAccounts(data.records || []);
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  };

  const fetchAsset = async () => {
    try {
      setLoading(true);
      const data = await api.getAsset(assetId!);
      setAssetData(data);
    } catch (err: any) {
      console.error('Error fetching asset:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaintenance = async () => {
    try {
      const data = await api.getAssetMaintenance(assetId!);
      setMaintenance(data || []);
    } catch (err) {
      console.error('Error fetching maintenance:', err);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (isNew) {
        const created = await api.createAsset(assetData);
        navigate(`/assets/${created.asset_id}`);
      } else {
        await api.updateAsset(assetId!, assetData);
        await fetchAsset();
        setIsEditing(false);
      }
    } catch (err: any) {
      alert('Failed to save asset: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">
      <div className="text-xl text-gray-600">Loading asset...</div>
    </div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link to="/assets" className="text-primary-600 hover:text-primary-800 text-sm mb-2 inline-block">
            ← Back to Assets
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            {isNew ? 'New Asset' : assetData.asset_number}
          </h1>
        </div>
        <div className="flex gap-2">
          {!isNew && !isEditing && (
            <button onClick={() => setIsEditing(true)} className="btn btn-secondary">
              Edit
            </button>
          )}
          {(isNew || isEditing) && (
            <>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                {saving ? 'Saving...' : 'Save'}
              </button>
              {!isNew && (
                <button onClick={() => { setIsEditing(false); fetchAsset(); }} className="btn btn-secondary">
                  Cancel
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Asset Information</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Asset Name *</label>
              {isEditing ? (
                <input type="text" value={assetData.asset_name} onChange={(e) => setAssetData({ ...assetData, asset_name: e.target.value })} className="input" />
              ) : (
                <div className="text-gray-900">{assetData.asset_name}</div>
              )}
            </div>
            <div>
              <label className="label">Asset Type *</label>
              {isEditing ? (
                <input type="text" value={assetData.asset_type} onChange={(e) => setAssetData({ ...assetData, asset_type: e.target.value })} className="input" />
              ) : (
                <div className="text-gray-900">{assetData.asset_type}</div>
              )}
            </div>
            <div>
              <label className="label">Serial Number</label>
              {isEditing ? (
                <input type="text" value={assetData.serial_number || ''} onChange={(e) => setAssetData({ ...assetData, serial_number: e.target.value })} className="input" />
              ) : (
                <div className="text-gray-900">{assetData.serial_number || '-'}</div>
              )}
            </div>
            <div>
              <label className="label">Description</label>
              {isEditing ? (
                <textarea value={assetData.description || ''} onChange={(e) => setAssetData({ ...assetData, description: e.target.value })} className="input" rows={3} />
              ) : (
                <div className="text-gray-900">{assetData.description || '-'}</div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4">Status & Location</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Status</label>
              {isEditing ? (
                <select value={assetData.status} onChange={(e) => setAssetData({ ...assetData, status: e.target.value })} className="input">
                  <option value="Available">Available</option>
                  <option value="In Use">In Use</option>
                  <option value="Under Maintenance">Under Maintenance</option>
                  <option value="Reserved">Reserved</option>
                  <option value="Retired">Retired</option>
                  <option value="Disposed">Disposed</option>
                </select>
              ) : (
                <div className="text-gray-900">{assetData.status}</div>
              )}
            </div>
            <div>
              <label className="label">Condition</label>
              {isEditing ? (
                <select value={assetData.condition} onChange={(e) => setAssetData({ ...assetData, condition: e.target.value })} className="input">
                  <option value="New">New</option>
                  <option value="Excellent">Excellent</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                  <option value="Damaged">Damaged</option>
                </select>
              ) : (
                <div className="text-gray-900">{assetData.condition}</div>
              )}
            </div>
            <div>
              <label className="label">Location</label>
              {isEditing ? (
                <input type="text" value={assetData.current_location || ''} onChange={(e) => setAssetData({ ...assetData, current_location: e.target.value })} className="input" />
              ) : (
                <div className="text-gray-900">{assetData.current_location || '-'}</div>
              )}
            </div>
            <div>
              <label className="label">Owner Account</label>
              {isEditing ? (
                <select value={assetData.account_id || ''} onChange={(e) => setAssetData({ ...assetData, account_id: e.target.value })} className="input">
                  <option value="">Select Account</option>
                  {accounts.map((acc) => (
                    <option key={acc.record_id} value={acc.record_id}>
                      {acc.data.Name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-gray-900">{assetData.account?.data?.Name || '-'}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {!isNew && maintenance.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Maintenance History</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Record #</th>
                <th>Type</th>
                <th>Title</th>
                <th>Date</th>
                <th>Status</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {maintenance.map((record) => (
                <tr key={record.record_id}>
                  <td className="font-medium">{record.record_number}</td>
                  <td>{record.maintenance_type}</td>
                  <td>{record.title}</td>
                  <td>{new Date(record.start_date).toLocaleDateString()}</td>
                  <td>{record.status}</td>
                  <td>${(record.total_cost || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(isEditing || assetData.notes) && (
        <div className="card mt-6">
          <h2 className="text-xl font-bold mb-4">Notes</h2>
          {isEditing ? (
            <textarea value={assetData.notes || ''} onChange={(e) => setAssetData({ ...assetData, notes: e.target.value })} className="input" rows={4} />
          ) : (
            <p className="text-gray-900 whitespace-pre-wrap">{assetData.notes}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default AssetDetailPage;
