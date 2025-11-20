import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const LeadSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState({
    auto_assignment: true,
    lead_scoring_enabled: true,
    duplicate_detection: true,
    conversion_settings: {
      create_account: true,
      create_contact: true,
      create_opportunity: true,
    },
  });

  const handleSave = () => {
    // TODO: Implement save functionality
    alert('Settings saved successfully!');
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link to="/admin/settings" className="text-blue-600 hover:text-blue-800 mb-2 inline-block">
          ← Back to Settings
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Lead Settings</h1>
        <p className="text-gray-600 mt-1">Configure lead assignment, conversion, and scoring</p>
      </div>

      <div className="space-y-6">
        {/* Lead Assignment */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Lead Assignment</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.auto_assignment}
                  onChange={(e) => setSettings({ ...settings, auto_assignment: e.target.checked })}
                />
                <span className="font-medium">Enable Auto-Assignment</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                Automatically assign leads based on assignment rules
              </p>
            </div>

            <div className="pl-6 border-l-2 border-gray-200">
              <Link to="/admin/leads/assignment-rules" className="text-blue-600 hover:text-blue-800">
                Configure Assignment Rules →
              </Link>
            </div>
          </div>
        </div>

        {/* Lead Scoring */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Lead Scoring</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.lead_scoring_enabled}
                  onChange={(e) => setSettings({ ...settings, lead_scoring_enabled: e.target.checked })}
                />
                <span className="font-medium">Enable Lead Scoring</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                Automatically score leads based on behavior and demographics
              </p>
            </div>

            {settings.lead_scoring_enabled && (
              <div className="pl-6 border-l-2 border-gray-200">
                <Link to="/admin/lead-scoring" className="text-blue-600 hover:text-blue-800">
                  Configure Scoring Rules →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Duplicate Detection */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Duplicate Detection</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.duplicate_detection}
                  onChange={(e) => setSettings({ ...settings, duplicate_detection: e.target.checked })}
                />
                <span className="font-medium">Enable Duplicate Detection</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                Prevent duplicate lead records from being created
              </p>
            </div>
          </div>
        </div>

        {/* Conversion Settings */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Lead Conversion Settings</h2>
          <p className="text-sm text-gray-600 mb-4">
            Choose which records to create when converting a lead
          </p>
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.conversion_settings.create_account}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    conversion_settings: {
                      ...settings.conversion_settings,
                      create_account: e.target.checked,
                    },
                  })
                }
              />
              <span>Create Account on conversion</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.conversion_settings.create_contact}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    conversion_settings: {
                      ...settings.conversion_settings,
                      create_contact: e.target.checked,
                    },
                  })
                }
              />
              <span>Create Contact on conversion</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.conversion_settings.create_opportunity}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    conversion_settings: {
                      ...settings.conversion_settings,
                      create_opportunity: e.target.checked,
                    },
                  })
                }
              />
              <span>Create Opportunity on conversion</span>
            </label>
          </div>
        </div>

        {/* Quick Links */}
        <div className="card bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Related Settings</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/admin/leads/statuses" className="text-blue-600 hover:text-blue-800">
              Lead Statuses
            </Link>
            <Link to="/admin/leads/sources" className="text-blue-600 hover:text-blue-800">
              Lead Sources
            </Link>
            <Link to="/admin/web-forms" className="text-blue-600 hover:text-blue-800">
              Web-to-Lead Forms
            </Link>
            <Link to="/admin/email-to-lead" className="text-blue-600 hover:text-blue-800">
              Email-to-Lead
            </Link>
          </div>
        </div>

        {/* Save Button */}
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

export default LeadSettingsPage;
