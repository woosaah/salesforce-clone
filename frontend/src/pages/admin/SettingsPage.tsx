import React, { useState } from 'react';
import { Link } from 'react-router-dom';

interface SettingCategory {
  title: string;
  description: string;
  items: SettingItem[];
}

interface SettingItem {
  title: string;
  description: string;
  path: string;
  icon: string;
}

const SettingsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const categories: SettingCategory[] = [
    {
      title: 'Platform',
      description: 'Configure objects, fields, and data model',
      items: [
        {
          title: 'Object Manager',
          description: 'Manage custom objects, fields, and relationships',
          path: '/admin/objects',
          icon: '🗂️',
        },
        {
          title: 'Custom Metadata Types',
          description: 'Create reusable configuration records',
          path: '/admin/custom-metadata',
          icon: '⚙️',
        },
        {
          title: 'Lightning Pages',
          description: 'Customize page layouts and components',
          path: '/admin/lightning-pages',
          icon: '📄',
        },
      ],
    },
    {
      title: 'Sales',
      description: 'Manage sales processes and settings',
      items: [
        {
          title: 'Lead Settings',
          description: 'Configure lead assignment, conversion, and scoring',
          path: '/admin/leads',
          icon: '🎯',
        },
        {
          title: 'Opportunity Settings',
          description: 'Manage opportunity stages, forecasting, and processes',
          path: '/admin/opportunities',
          icon: '💼',
        },
        {
          title: 'Products & Price Books',
          description: 'Configure products, pricing, and CPQ settings',
          path: '/admin/products',
          icon: '💰',
        },
        {
          title: 'Territory Management',
          description: 'Set up sales territories and hierarchies',
          path: '/admin/territories',
          icon: '🗺️',
        },
      ],
    },
    {
      title: 'Service',
      description: 'Configure customer service and support',
      items: [
        {
          title: 'Case Settings',
          description: 'Configure case management, assignment, and escalation',
          path: '/admin/cases',
          icon: '📋',
        },
        {
          title: 'Service Level Agreements',
          description: 'Define and manage SLA policies',
          path: '/admin/slas',
          icon: '⏱️',
        },
        {
          title: 'Knowledge Base',
          description: 'Manage knowledge articles and categories',
          path: '/admin/knowledge',
          icon: '📚',
        },
        {
          title: 'Omni-Channel',
          description: 'Configure queue routing and presence',
          path: '/admin/omni-channel',
          icon: '📞',
        },
        {
          title: 'Field Service',
          description: 'Manage work orders and mobile workforce',
          path: '/admin/field-service',
          icon: '🔧',
        },
      ],
    },
    {
      title: 'Marketing',
      description: 'Configure marketing automation and campaigns',
      items: [
        {
          title: 'Campaign Settings',
          description: 'Manage marketing campaigns and member statuses',
          path: '/admin/campaigns',
          icon: '📣',
        },
        {
          title: 'Email Campaigns',
          description: 'Configure email marketing and templates',
          path: '/admin/email-campaigns',
          icon: '✉️',
        },
        {
          title: 'Web-to-Lead Forms',
          description: 'Create and manage web forms',
          path: '/admin/web-forms',
          icon: '📝',
        },
      ],
    },
    {
      title: 'Automation',
      description: 'Automate business processes',
      items: [
        {
          title: 'Workflow Rules',
          description: 'Create automated workflow actions',
          path: '/admin/workflows',
          icon: '🔄',
        },
        {
          title: 'Process Builder',
          description: 'Build complex automated processes',
          path: '/admin/flows',
          icon: '⚡',
        },
        {
          title: 'Approval Processes',
          description: 'Define approval workflows',
          path: '/admin/approval-processes',
          icon: '✅',
        },
        {
          title: 'Triggers',
          description: 'Manage Apex triggers',
          path: '/admin/triggers',
          icon: '🎯',
        },
      ],
    },
    {
      title: 'Analytics',
      description: 'Reports, dashboards, and forecasting',
      items: [
        {
          title: 'Reports & Dashboards',
          description: 'Create and manage reports and dashboards',
          path: '/admin/reports',
          icon: '📊',
        },
        {
          title: 'Report Folders',
          description: 'Organize reports into folders',
          path: '/admin/report-folders',
          icon: '📁',
        },
        {
          title: 'Forecasting',
          description: 'Configure sales forecasting',
          path: '/admin/forecasting',
          icon: '📈',
        },
      ],
    },
    {
      title: 'Communication',
      description: 'Email, chat, and messaging',
      items: [
        {
          title: 'Email Templates',
          description: 'Create and manage email templates',
          path: '/admin/email-templates',
          icon: '📧',
        },
        {
          title: 'Chat Settings',
          description: 'Configure live chat and messaging',
          path: '/admin/chat',
          icon: '💬',
        },
        {
          title: 'Voice & SMS',
          description: 'Configure telephony integration',
          path: '/admin/voice-sms',
          icon: '📱',
        },
        {
          title: 'Einstein Bots',
          description: 'Build and deploy chatbots',
          path: '/admin/bots',
          icon: '🤖',
        },
      ],
    },
    {
      title: 'Data Management',
      description: 'Import, export, and manage data',
      items: [
        {
          title: 'Data Import',
          description: 'Import records from CSV and other sources',
          path: '/admin/data-import',
          icon: '📥',
        },
        {
          title: 'Data Export',
          description: 'Export data for backup or analysis',
          path: '/admin/data-export',
          icon: '📤',
        },
        {
          title: 'Big Objects',
          description: 'Manage large data volumes',
          path: '/admin/big-objects',
          icon: '🗄️',
        },
      ],
    },
    {
      title: 'Integration',
      description: 'Connect to external systems',
      items: [
        {
          title: 'External Services',
          description: 'Configure API integrations',
          path: '/admin/external-services',
          icon: '🔌',
        },
        {
          title: 'Platform Events',
          description: 'Publish and subscribe to events',
          path: '/admin/platform-events',
          icon: '📡',
        },
        {
          title: 'Change Data Capture',
          description: 'Track data changes in real-time',
          path: '/admin/change-data-capture',
          icon: '🔍',
        },
      ],
    },
    {
      title: 'Deployment',
      description: 'Deploy changes between environments',
      items: [
        {
          title: 'Sandboxes',
          description: 'Manage sandbox environments',
          path: '/admin/sandboxes',
          icon: '🏖️',
        },
        {
          title: 'Change Sets',
          description: 'Deploy configuration changes',
          path: '/admin/change-sets',
          icon: '📦',
        },
      ],
    },
    {
      title: 'AI & Einstein',
      description: 'Artificial intelligence features',
      items: [
        {
          title: 'Einstein Predictions',
          description: 'Configure predictive models',
          path: '/admin/einstein-predictions',
          icon: '🔮',
        },
        {
          title: 'Einstein Activity Capture',
          description: 'Automatically log emails and events',
          path: '/admin/einstein-activity',
          icon: '📅',
        },
      ],
    },
    {
      title: 'Mobile & Communities',
      description: 'Mobile apps and community portals',
      items: [
        {
          title: 'Mobile Configuration',
          description: 'Configure mobile app settings',
          path: '/admin/mobile-config',
          icon: '📱',
        },
        {
          title: 'Communities',
          description: 'Create and manage customer communities',
          path: '/admin/communities',
          icon: '👥',
        },
      ],
    },
  ];

  // Filter categories and items based on search
  const filteredCategories = categories
    .map((category) => ({
      ...category,
      items: category.items.filter(
        (item) =>
          item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.description.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    }))
    .filter((category) => category.items.length > 0 || searchTerm === '');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Configure and customize your Salesforce Clone instance</p>
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <input
          type="text"
          placeholder="Search settings..."
          className="input w-full max-w-2xl"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Settings Categories */}
      <div className="space-y-8">
        {filteredCategories.map((category) => (
          <div key={category.title}>
            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-gray-900">{category.title}</h2>
              <p className="text-gray-600 text-sm">{category.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {category.items.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="card hover:shadow-lg transition-shadow cursor-pointer group"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{item.icon}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filteredCategories.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg">No settings found matching "{searchTerm}"</div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
