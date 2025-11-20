import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const OpportunitySettingsPage: React.FC = () => {
  const [settings, setSettings] = useState({
    forecasting_enabled: true,
    probability_enabled: true,
    split_enabled: false,
    team_selling: true,
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
        <h1 className="text-3xl font-bold text-gray-900">Opportunity Settings</h1>
        <p className="text-gray-600 mt-1">Configure opportunity stages, forecasting, and processes</p>
      </div>

      <div className="space-y-6">
        {/* Forecasting */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Forecasting</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.forecasting_enabled}
                  onChange={(e) => setSettings({ ...settings, forecasting_enabled: e.target.checked })}
                />
                <span className="font-medium">Enable Forecasting</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                Allow users to forecast revenue based on opportunities
              </p>
            </div>

            {settings.forecasting_enabled && (
              <div className="pl-6 border-l-2 border-gray-200 space-y-2">
                <Link to="/admin/forecasting" className="block text-blue-600 hover:text-blue-800">
                  Configure Forecast Categories →
                </Link>
                <Link to="/admin/forecasting/quotas" className="block text-blue-600 hover:text-blue-800">
                  Set Forecast Quotas →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Probability */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Probability Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.probability_enabled}
                  onChange={(e) => setSettings({ ...settings, probability_enabled: e.target.checked })}
                />
                <span className="font-medium">Enable Probability</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                Automatically set probability based on opportunity stage
              </p>
            </div>

            {settings.probability_enabled && (
              <div className="pl-6 border-l-2 border-gray-200">
                <Link to="/admin/opportunity-stages" className="text-blue-600 hover:text-blue-800">
                  Configure Stage Probabilities →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Opportunity Splits */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Opportunity Splits</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.split_enabled}
                  onChange={(e) => setSettings({ ...settings, split_enabled: e.target.checked })}
                />
                <span className="font-medium">Enable Opportunity Splits</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                Split opportunity credit among multiple team members
              </p>
            </div>
          </div>
        </div>

        {/* Team Selling */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Team Selling</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.team_selling}
                  onChange={(e) => setSettings({ ...settings, team_selling: e.target.checked })}
                />
                <span className="font-medium">Enable Opportunity Teams</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                Allow multiple team members to collaborate on opportunities
              </p>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="card bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Related Settings</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/admin/opportunity-stages" className="text-blue-600 hover:text-blue-800">
              Opportunity Stages
            </Link>
            <Link to="/admin/products" className="text-blue-600 hover:text-blue-800">
              Products & Price Books
            </Link>
            <Link to="/admin/cpq" className="text-blue-600 hover:text-blue-800">
              CPQ Configuration
            </Link>
            <Link to="/admin/territories" className="text-blue-600 hover:text-blue-800">
              Territory Management
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

export default OpportunitySettingsPage;
