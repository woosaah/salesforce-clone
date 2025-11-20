import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const ReportSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState({
    report_snapshots: true,
    scheduled_reports: true,
    dashboard_refresh: true,
    custom_report_types: true,
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
        <h1 className="text-3xl font-bold text-gray-900">Reports & Dashboards Settings</h1>
        <p className="text-gray-600 mt-1">Configure reporting, analytics, and dashboard features</p>
      </div>

      <div className="space-y-6">
        {/* Report Builder */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Report Builder</h2>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Create and customize reports to analyze your data with various chart types and filters.
            </p>

            <div className="pl-6 border-l-2 border-gray-200 space-y-2">
              <Link to="/admin/reports" className="block text-blue-600 hover:text-blue-800">
                Create New Report →
              </Link>
              <Link to="/admin/report-folders" className="block text-blue-600 hover:text-blue-800">
                Manage Report Folders →
              </Link>
            </div>
          </div>
        </div>

        {/* Custom Report Types */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Custom Report Types</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.custom_report_types}
                  onChange={(e) => setSettings({ ...settings, custom_report_types: e.target.checked })}
                />
                <span className="font-medium">Enable Custom Report Types</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                Create custom report types to define specific object relationships for reporting
              </p>
            </div>

            {settings.custom_report_types && (
              <div className="pl-6 border-l-2 border-gray-200">
                <Link to="/admin/reports/custom-types" className="text-blue-600 hover:text-blue-800">
                  Manage Custom Report Types →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Dashboards */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Dashboards</h2>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Dashboards display multiple report charts in a single view for quick analysis.
            </p>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.dashboard_refresh}
                  onChange={(e) => setSettings({ ...settings, dashboard_refresh: e.target.checked })}
                />
                <span className="font-medium">Enable Auto-Refresh</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                Automatically refresh dashboard data on a schedule
              </p>
            </div>

            <div className="pl-6 border-l-2 border-gray-200">
              <Link to="/admin/dashboards" className="text-blue-600 hover:text-blue-800">
                Manage Dashboards →
              </Link>
            </div>
          </div>
        </div>

        {/* Scheduled Reports */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Scheduled Reports</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.scheduled_reports}
                  onChange={(e) => setSettings({ ...settings, scheduled_reports: e.target.checked })}
                />
                <span className="font-medium">Enable Scheduled Reports</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                Schedule reports to be emailed automatically on a recurring basis
              </p>
            </div>

            {settings.scheduled_reports && (
              <div className="pl-6 border-l-2 border-gray-200">
                <Link to="/admin/report-subscriptions" className="text-blue-600 hover:text-blue-800">
                  Manage Report Subscriptions →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Report Snapshots */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Report Snapshots</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.report_snapshots}
                  onChange={(e) => setSettings({ ...settings, report_snapshots: e.target.checked })}
                />
                <span className="font-medium">Enable Report Snapshots</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                Capture point-in-time snapshots of report data for trend analysis
              </p>
            </div>
          </div>
        </div>

        {/* Analytics Features */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Advanced Analytics</h2>
          <div className="space-y-3">
            <Link to="/admin/forecasting" className="block text-blue-600 hover:text-blue-800">
              Forecasting Settings →
            </Link>
            <Link to="/admin/einstein-predictions" className="block text-blue-600 hover:text-blue-800">
              Einstein Predictions →
            </Link>
            <Link to="/admin/einstein-analytics" className="block text-blue-600 hover:text-blue-800">
              Einstein Analytics →
            </Link>
          </div>
        </div>

        {/* Quick Links */}
        <div className="card bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Report Categories</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/admin/reports?category=sales" className="text-blue-600 hover:text-blue-800">
              Sales Reports
            </Link>
            <Link to="/admin/reports?category=service" className="text-blue-600 hover:text-blue-800">
              Service Reports
            </Link>
            <Link to="/admin/reports?category=marketing" className="text-blue-600 hover:text-blue-800">
              Marketing Reports
            </Link>
            <Link to="/admin/reports?category=custom" className="text-blue-600 hover:text-blue-800">
              Custom Reports
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

export default ReportSettingsPage;
