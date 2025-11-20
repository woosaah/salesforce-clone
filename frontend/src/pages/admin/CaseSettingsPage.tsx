import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const CaseSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState({
    auto_assignment: true,
    escalation_enabled: true,
    email_to_case: true,
    web_to_case: true,
    sla_enabled: true,
    omni_channel: false,
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
        <h1 className="text-3xl font-bold text-gray-900">Case Settings</h1>
        <p className="text-gray-600 mt-1">Configure case management, assignment, and escalation</p>
      </div>

      <div className="space-y-6">
        {/* Case Assignment */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Case Assignment</h2>
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
                Automatically assign cases to agents based on assignment rules
              </p>
            </div>

            {settings.auto_assignment && (
              <div className="pl-6 border-l-2 border-gray-200 space-y-2">
                <Link to="/admin/cases/assignment-rules" className="block text-blue-600 hover:text-blue-800">
                  Configure Assignment Rules →
                </Link>
                <Link to="/admin/queues" className="block text-blue-600 hover:text-blue-800">
                  Manage Queues →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Escalation Rules */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Escalation Rules</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.escalation_enabled}
                  onChange={(e) => setSettings({ ...settings, escalation_enabled: e.target.checked })}
                />
                <span className="font-medium">Enable Case Escalation</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                Automatically escalate cases that breach thresholds
              </p>
            </div>

            {settings.escalation_enabled && (
              <div className="pl-6 border-l-2 border-gray-200">
                <Link to="/admin/escalation-rules" className="text-blue-600 hover:text-blue-800">
                  Configure Escalation Rules →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* SLA Management */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Service Level Agreements (SLAs)</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.sla_enabled}
                  onChange={(e) => setSettings({ ...settings, sla_enabled: e.target.checked })}
                />
                <span className="font-medium">Enable SLA Tracking</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                Track and enforce service level agreements
              </p>
            </div>

            {settings.sla_enabled && (
              <div className="pl-6 border-l-2 border-gray-200">
                <Link to="/admin/slas" className="text-blue-600 hover:text-blue-800">
                  Configure SLA Policies →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Case Origin Channels */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Case Origin Channels</h2>
          <div className="space-y-3">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.email_to_case}
                  onChange={(e) => setSettings({ ...settings, email_to_case: e.target.checked })}
                />
                <span className="font-medium">Email-to-Case</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                Automatically create cases from incoming emails
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.web_to_case}
                  onChange={(e) => setSettings({ ...settings, web_to_case: e.target.checked })}
                />
                <span className="font-medium">Web-to-Case</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                Create cases from web forms on your website
              </p>
            </div>
          </div>

          {(settings.email_to_case || settings.web_to_case) && (
            <div className="pl-6 border-l-2 border-gray-200 mt-4 space-y-2">
              {settings.email_to_case && (
                <Link to="/admin/email-to-case" className="block text-blue-600 hover:text-blue-800">
                  Configure Email-to-Case →
                </Link>
              )}
              {settings.web_to_case && (
                <Link to="/admin/web-forms" className="block text-blue-600 hover:text-blue-800">
                  Configure Web-to-Case Forms →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Omni-Channel */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Omni-Channel Routing</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.omni_channel}
                  onChange={(e) => setSettings({ ...settings, omni_channel: e.target.checked })}
                />
                <span className="font-medium">Enable Omni-Channel</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                Intelligently route cases based on agent capacity and skills
              </p>
            </div>

            {settings.omni_channel && (
              <div className="pl-6 border-l-2 border-gray-200">
                <Link to="/admin/omni-channel" className="text-blue-600 hover:text-blue-800">
                  Configure Omni-Channel Settings →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="card bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Related Settings</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/admin/cases/statuses" className="text-blue-600 hover:text-blue-800">
              Case Statuses
            </Link>
            <Link to="/admin/service-console" className="text-blue-600 hover:text-blue-800">
              Service Console
            </Link>
            <Link to="/admin/knowledge" className="text-blue-600 hover:text-blue-800">
              Knowledge Base
            </Link>
            <Link to="/admin/macros" className="text-blue-600 hover:text-blue-800">
              Quick Actions & Macros
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

export default CaseSettingsPage;
