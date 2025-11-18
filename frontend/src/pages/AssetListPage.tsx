import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

const AssetListPage: React.FC = () => {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchAssets();
  }, [statusFilter]);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const data = await api.getAssets({
        limit: 100,
        status: statusFilter || undefined
      });
      setAssets(data.assets || []);
    } catch (err) {
      console.error('Error fetching assets:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      'Available': 'bg-green-100 text-green-800',
      'In Use': 'bg-blue-100 text-blue-800',
      'Under Maintenance': 'bg-yellow-100 text-yellow-800',
      'Retired': 'bg-gray-100 text-gray-600',
      'Disposed': 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">
      <div className="text-xl text-gray-600">Loading assets...</div>
    </div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Asset Management</h1>
          <p className="text-gray-600 mt-1">Track and manage your assets</p>
        </div>
        <Link to="/assets/new" className="btn btn-primary">
          New Asset
        </Link>
      </div>

      <div className="mb-6 flex gap-4">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input">
          <option value="">All Statuses</option>
          <option value="Available">Available</option>
          <option value="In Use">In Use</option>
          <option value="Under Maintenance">Under Maintenance</option>
          <option value="Retired">Retired</option>
          <option value="Disposed">Disposed</option>
        </select>
      </div>

      {assets.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No assets found</p>
          <Link to="/assets/new" className="btn btn-primary mt-4 inline-block">
            Create Your First Asset
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Asset Number</th>
                <th>Name</th>
                <th>Type</th>
                <th>Serial Number</th>
                <th>Status</th>
                <th>Location</th>
                <th>Owner</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.asset_id}>
                  <td>
                    <Link to={`/assets/${asset.asset_id}`} className="text-primary-600 hover:text-primary-800 font-medium">
                      {asset.asset_number}
                    </Link>
                  </td>
                  <td>{asset.asset_name}</td>
                  <td>{asset.asset_type}</td>
                  <td>{asset.serial_number || '-'}</td>
                  <td>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(asset.status)}`}>
                      {asset.status}
                    </span>
                  </td>
                  <td>{asset.current_location || '-'}</td>
                  <td>{asset.account?.data?.Name || '-'}</td>
                  <td>
                    <Link to={`/assets/${asset.asset_id}`} className="text-sm text-primary-600 hover:text-primary-800">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AssetListPage;
