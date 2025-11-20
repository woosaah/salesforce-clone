import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const CreateTenantPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    tenant_name: '',
    domain: '',
    admin_email: '',
    admin_first_name: '',
    admin_last_name: '',
    admin_password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate domain format
    if (!/^[a-z0-9-]+$/.test(formData.domain)) {
      alert('Domain must contain only lowercase letters, numbers, and hyphens');
      return;
    }

    if (formData.admin_password.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    try {
      const response = await api.post('/super-admin/tenants', formData);
      if (response.data.success) {
        alert('Tenant created successfully!');
        navigate('/super-admin/tenants');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create tenant');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link to="/super-admin/tenants" className="text-blue-600 hover:text-blue-800 mb-2 inline-block">
          ← Back to Tenants
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Create New Tenant</h1>
      </div>

      <div className="card max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Tenant Information</h2>

            <div>
              <label className="label">Organization Name *</label>
              <input
                type="text"
                className="input"
                value={formData.tenant_name}
                onChange={(e) => setFormData({ ...formData, tenant_name: e.target.value })}
                required
                placeholder="Acme Corporation"
              />
            </div>

            <div>
              <label className="label">Domain * (lowercase, no spaces)</label>
              <input
                type="text"
                className="input"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value.toLowerCase() })}
                required
                pattern="[a-z0-9-]+"
                placeholder="acme-corp"
              />
              <p className="text-sm text-gray-500 mt-1">
                Will be used as: {formData.domain || 'domain'}.salesforce-clone.com
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h2 className="text-xl font-semibold">Administrator Account</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First Name *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.admin_first_name}
                  onChange={(e) => setFormData({ ...formData, admin_first_name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">Last Name *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.admin_last_name}
                  onChange={(e) => setFormData({ ...formData, admin_last_name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Email *</label>
              <input
                type="email"
                className="input"
                value={formData.admin_email}
                onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="label">Password * (min 8 characters)</label>
              <input
                type="password"
                className="input"
                value={formData.admin_password}
                onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                required
                minLength={8}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <button type="submit" className="btn btn-primary">
              Create Tenant
            </button>
            <Link to="/super-admin/tenants" className="btn">
              Cancel
            </Link>
          </div>
        </form>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md max-w-2xl">
        <h3 className="font-semibold text-blue-900 mb-2">What happens when you create a tenant?</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• A new isolated tenant environment is created</li>
          <li>• An administrator account is created with full access</li>
          <li>• Standard Salesforce objects are initialized</li>
          <li>• The admin can log in immediately with the provided credentials</li>
        </ul>
      </div>
    </div>
  );
};

export default CreateTenantPage;
