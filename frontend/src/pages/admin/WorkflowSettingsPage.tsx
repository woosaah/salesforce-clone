import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const WorkflowSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState({
    time_based_workflow: true,
    workflow_queue_enabled: true,
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
        <h1 className="text-3xl font-bold text-gray-900">Workflow & Automation Settings</h1>
        <p className="text-gray-600 mt-1">Configure workflow rules and automation processes</p>
      </div>

      <div className="space-y-6">
        {/* Workflow Rules */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Workflow Rules</h2>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Workflow rules let you automate standard internal procedures and processes to save time
              across your org.
            </p>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.time_based_workflow}
                  onChange={(e) => setSettings({ ...settings, time_based_workflow: e.target.checked })}
                />
                <span className="font-medium">Enable Time-Based Workflows</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                Execute workflow actions at a specific time (e.g., 7 days before close date)
              </p>
            </div>

            <div className="pl-6 border-l-2 border-gray-200">
              <Link to="/admin/workflows" className="text-blue-600 hover:text-blue-800">
                Manage Workflow Rules →
              </Link>
            </div>
          </div>
        </div>

        {/* Process Builder */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Process Builder (Flow)</h2>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Process Builder allows you to create more complex automated processes with a visual interface.
            </p>

            <div className="pl-6 border-l-2 border-gray-200">
              <Link to="/admin/flows" className="text-blue-600 hover:text-blue-800">
                Manage Processes & Flows →
              </Link>
            </div>
          </div>
        </div>

        {/* Approval Processes */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Approval Processes</h2>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Approval processes automate how records are approved in your org. Define the steps necessary
              for a record to be approved and who approves it at each step.
            </p>

            <div className="pl-6 border-l-2 border-gray-200">
              <Link to="/admin/approval-processes" className="text-blue-600 hover:text-blue-800">
                Manage Approval Processes →
              </Link>
            </div>
          </div>
        </div>

        {/* Triggers */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Apex Triggers</h2>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Triggers are Apex code that executes before or after specific data manipulation language (DML)
              events occur.
            </p>

            <div className="pl-6 border-l-2 border-gray-200">
              <Link to="/admin/triggers" className="text-blue-600 hover:text-blue-800">
                Manage Triggers →
              </Link>
            </div>
          </div>
        </div>

        {/* Workflow Queue */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Workflow Queue</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.workflow_queue_enabled}
                  onChange={(e) => setSettings({ ...settings, workflow_queue_enabled: e.target.checked })}
                />
                <span className="font-medium">Enable Workflow Queue Monitoring</span>
              </label>
              <p className="text-sm text-gray-600 ml-6">
                Monitor pending time-based workflow actions
              </p>
            </div>

            {settings.workflow_queue_enabled && (
              <div className="pl-6 border-l-2 border-gray-200">
                <Link to="/admin/workflows/queue" className="text-blue-600 hover:text-blue-800">
                  View Workflow Queue →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="card bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Related Settings</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/admin/email-templates" className="text-blue-600 hover:text-blue-800">
              Email Templates
            </Link>
            <Link to="/admin/macros" className="text-blue-600 hover:text-blue-800">
              Quick Actions
            </Link>
            <Link to="/admin/paths" className="text-blue-600 hover:text-blue-800">
              Path Settings
            </Link>
            <Link to="/admin/platform-events" className="text-blue-600 hover:text-blue-800">
              Platform Events
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

export default WorkflowSettingsPage;
