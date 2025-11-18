-- Migration 016: Reports & Dashboards Module
-- Create comprehensive reporting and analytics system

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- REPORT FOLDERS
-- ============================================================================

-- Report folders for organization
CREATE TABLE report_folders (
  folder_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  folder_name VARCHAR(255) NOT NULL,
  parent_folder_id UUID REFERENCES report_folders(folder_id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES users(user_id),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- REPORTS
-- ============================================================================

-- Main reports table
CREATE TABLE reports (
  report_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  report_name VARCHAR(255) NOT NULL,
  description TEXT,
  object_name VARCHAR(255) NOT NULL,
  report_type VARCHAR(50) DEFAULT 'tabular' CHECK (report_type IN ('tabular', 'summary', 'matrix')),
  report_format VARCHAR(50) DEFAULT 'table' CHECK (report_format IN ('table', 'chart')),
  chart_type VARCHAR(50) CHECK (chart_type IN ('bar', 'line', 'pie', 'donut', 'funnel', 'gauge')),
  columns JSONB, -- array of field names to display
  filters JSONB, -- WHERE conditions
  group_by JSONB, -- array of fields to group by
  aggregate_functions JSONB, -- {field: 'SUM', field2: 'COUNT'}
  sort_by JSONB, -- [{field: 'Name', direction: 'ASC'}]
  limit_rows INTEGER,
  is_public BOOLEAN DEFAULT false,
  folder_id UUID REFERENCES report_folders(folder_id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(user_id),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_by UUID NOT NULL REFERENCES users(user_id),
  modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Report snapshots (cached results)
CREATE TABLE report_snapshots (
  snapshot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES reports(report_id) ON DELETE CASCADE,
  data JSONB NOT NULL, -- cached report results
  generated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  generated_by UUID NOT NULL REFERENCES users(user_id),
  row_count INTEGER DEFAULT 0
);

-- ============================================================================
-- DASHBOARDS
-- ============================================================================

-- Main dashboards table
CREATE TABLE dashboards (
  dashboard_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  dashboard_name VARCHAR(255) NOT NULL,
  description TEXT,
  layout JSONB, -- grid layout configuration
  refresh_interval_minutes INTEGER DEFAULT 30,
  is_public BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES users(user_id),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_by UUID NOT NULL REFERENCES users(user_id),
  modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard components (widgets)
CREATE TABLE dashboard_components (
  component_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(dashboard_id) ON DELETE CASCADE,
  component_type VARCHAR(50) NOT NULL CHECK (component_type IN ('chart', 'table', 'metric', 'list')),
  report_id UUID REFERENCES reports(report_id) ON DELETE CASCADE,
  soql_query TEXT, -- alternative to report_id
  chart_config JSONB, -- chart-specific settings
  position JSONB NOT NULL, -- {x, y, width, height}
  title VARCHAR(255),
  show_title BOOLEAN DEFAULT true,
  drilldown_enabled BOOLEAN DEFAULT false,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- REPORT SUBSCRIPTIONS
-- ============================================================================

-- Report subscriptions for scheduled delivery
CREATE TABLE report_subscriptions (
  subscription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  report_id UUID REFERENCES reports(report_id) ON DELETE CASCADE,
  dashboard_id UUID REFERENCES dashboards(dashboard_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  schedule_type VARCHAR(20) NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly')),
  schedule_config JSONB, -- {time: '09:00', day_of_week: 1, day_of_month: 1}
  email_format VARCHAR(20) DEFAULT 'PDF' CHECK (email_format IN ('PDF', 'Excel', 'CSV')),
  is_active BOOLEAN DEFAULT true,
  last_sent_date TIMESTAMP,
  next_send_date TIMESTAMP,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (report_id IS NOT NULL OR dashboard_id IS NOT NULL)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Report folders indexes
CREATE INDEX idx_report_folders_tenant ON report_folders(tenant_id);
CREATE INDEX idx_report_folders_parent ON report_folders(parent_folder_id);

-- Reports indexes
CREATE INDEX idx_reports_tenant ON reports(tenant_id);
CREATE INDEX idx_reports_folder ON reports(folder_id);
CREATE INDEX idx_reports_object ON reports(object_name);
CREATE INDEX idx_reports_created_by ON reports(created_by);
CREATE INDEX idx_report_snapshots_report ON report_snapshots(report_id);

-- Dashboards indexes
CREATE INDEX idx_dashboards_tenant ON dashboards(tenant_id);
CREATE INDEX idx_dashboards_created_by ON dashboards(created_by);
CREATE INDEX idx_dashboard_components_dashboard ON dashboard_components(dashboard_id);
CREATE INDEX idx_dashboard_components_report ON dashboard_components(report_id);

-- Subscriptions indexes
CREATE INDEX idx_report_subscriptions_tenant ON report_subscriptions(tenant_id);
CREATE INDEX idx_report_subscriptions_user ON report_subscriptions(user_id);
CREATE INDEX idx_report_subscriptions_next_send ON report_subscriptions(next_send_date, is_active);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE report_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY report_folders_tenant_isolation ON report_folders
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY reports_tenant_isolation ON reports
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY report_snapshots_tenant_isolation ON report_snapshots
  USING (report_id IN (SELECT report_id FROM reports WHERE tenant_id::text = current_setting('app.current_tenant_id', true)));

CREATE POLICY dashboards_tenant_isolation ON dashboards
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY dashboard_components_tenant_isolation ON dashboard_components
  USING (dashboard_id IN (SELECT dashboard_id FROM dashboards WHERE tenant_id::text = current_setting('app.current_tenant_id', true)));

CREATE POLICY report_subscriptions_tenant_isolation ON report_subscriptions
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON report_folders TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON reports TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON report_snapshots TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON dashboards TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON dashboard_components TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON report_subscriptions TO postgres;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE reports IS 'User-defined reports with SOQL-based data retrieval';
COMMENT ON TABLE dashboards IS 'Customizable dashboards with multiple components';
COMMENT ON TABLE dashboard_components IS 'Individual widgets on a dashboard';
COMMENT ON TABLE report_subscriptions IS 'Scheduled report delivery via email';
