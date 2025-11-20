import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const CampaignSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState({
    campaign_influence: true,
    campaign_hierarchies: true,
    email_marketing: true,
    roi_tracking: true,
  });

  const handleSave = () => {
    alert('Settings saved successfully!');
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link to="/admin/settings" className="text-blue-600 hover:text-blue-800 mb-2 inline-block">
          ← Back to Settings
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Campaign Settings</h1>
        <p className="text-gray-600 mt-1">Configure marketing campaigns and member statuses</p>
      </div>

      <div className="space-y-6">
        {/* Campaign Influence */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Campaign Influence</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.campaign_influence}
                  onChange={(e) => setSettings({ ...settings, campaign_influence: e.target.checked })}
                />
                <span className="font-medium">Enable Campaign Influence</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                Track how multiple campaigns influence opportunities
              </p>
            </div>

            {settings.campaign_influence && (
              <div className="pl-6 border-l-2 border-gray-200">
                <p className="text-sm text-gray-700">
                  Campaign Influence allows you to associate multiple campaigns with opportunities and track
                  their combined impact on revenue.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Campaign Hierarchies */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Campaign Hierarchies</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.campaign_hierarchies}
                  onChange={(e) => setSettings({ ...settings, campaign_hierarchies: e.target.checked })}
                />
                <span className="font-medium">Enable Campaign Hierarchies</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                Organize campaigns into parent-child hierarchies
              </p>
            </div>
          </div>
        </div>

        {/* Email Marketing */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Email Marketing</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.email_marketing}
                  onChange={(e) => setSettings({ ...settings, email_marketing: e.target.checked })}
                />
                <span className="font-medium">Enable Email Campaigns</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                Send mass emails to campaign members
              </p>
            </div>

            {settings.email_marketing && (
              <div className="pl-6 border-l-2 border-gray-200 space-y-2">
                <Link to="/admin/email-campaigns" className="block text-blue-600 hover:text-blue-800">
                  Configure Email Campaigns →
                </Link>
                <Link to="/admin/email-templates" className="block text-blue-600 hover:text-blue-800">
                  Manage Email Templates →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ROI Tracking */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">ROI Tracking</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.roi_tracking}
                  onChange={(e) => setSettings({ ...settings, roi_tracking: e.target.checked })}
                />
                <span className="font-medium">Enable ROI Tracking</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                Track actual cost, expected revenue, and ROI for campaigns
              </p>
            </div>
          </div>
        </div>

        {/* Member Statuses */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Campaign Member Statuses</h2>
          <p className="text-sm text-gray-600 mb-4">
            Define custom member statuses for different campaign types
          </p>
          <Link to="/admin/campaigns/member-statuses" className="text-blue-600 hover:text-blue-800">
            Configure Member Statuses →
          </Link>
        </div>

        {/* Quick Links */}
        <div className="card bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Related Settings</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/admin/campaigns/types" className="text-blue-600 hover:text-blue-800">
              Campaign Types
            </Link>
            <Link to="/admin/web-forms" className="text-blue-600 hover:text-blue-800">
              Web-to-Campaign Forms
            </Link>
            <Link to="/admin/lead-scoring" className="text-blue-600 hover:text-blue-800">
              Lead Scoring
            </Link>
            <Link to="/admin/reports?category=campaigns" className="text-blue-600 hover:text-blue-800">
              Campaign Reports
            </Link>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave} className="btn btn-primary">
            Save Changes
          </button>
          <Link to="/admin/settings" className="btn">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CampaignSettingsPage;
