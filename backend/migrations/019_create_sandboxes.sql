-- ============================================================================
-- Migration: Create Sandboxes
-- Description: Dev/test environment system
-- ============================================================================

-- Sandboxes table
CREATE TABLE IF NOT EXISTS sandboxes (
  sandbox_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  sandbox_tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  sandbox_name VARCHAR(255) NOT NULL,
  sandbox_type VARCHAR(50) NOT NULL CHECK (sandbox_type IN ('Developer', 'Developer_Pro', 'Partial', 'Full')),
  status VARCHAR(50) DEFAULT 'Creating' CHECK (status IN ('Creating', 'Active', 'Refreshing', 'Deleting', 'Failed')),
  description TEXT,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  activated_date TIMESTAMP WITH TIME ZONE,
  expires_date TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(user_id),
  UNIQUE(source_tenant_id, sandbox_name)
);

-- Sandbox templates (what to copy)
CREATE TABLE IF NOT EXISTS sandbox_templates (
  template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sandbox_id UUID NOT NULL REFERENCES sandboxes(sandbox_id) ON DELETE CASCADE,
  include_objects JSONB DEFAULT '[]'::jsonb, -- Array of object names to copy data from
  include_config BOOLEAN DEFAULT true,
  include_users BOOLEAN DEFAULT true,
  include_metadata BOOLEAN DEFAULT true,
  sample_data_percentage INTEGER DEFAULT 100 CHECK (sample_data_percentage BETWEEN 0 AND 100)
);

-- Sandbox refresh history
CREATE TABLE IF NOT EXISTS sandbox_refresh_history (
  refresh_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sandbox_id UUID NOT NULL REFERENCES sandboxes(sandbox_id) ON DELETE CASCADE,
  refresh_type VARCHAR(50) DEFAULT 'Full' CHECK (refresh_type IN ('Full', 'Incremental')),
  status VARCHAR(50) DEFAULT 'In_Progress',
  started_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_date TIMESTAMP WITH TIME ZONE,
  records_copied INTEGER DEFAULT 0,
  error_message TEXT
);

-- Indexes
CREATE INDEX idx_sandboxes_source_tenant ON sandboxes(source_tenant_id);
CREATE INDEX idx_sandboxes_sandbox_tenant ON sandboxes(sandbox_tenant_id);
CREATE INDEX idx_sandboxes_status ON sandboxes(status);
CREATE INDEX idx_sandbox_refresh_history_sandbox ON sandbox_refresh_history(sandbox_id);

-- Enable Row-Level Security
ALTER TABLE sandboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox_refresh_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY sandboxes_tenant_isolation ON sandboxes
  FOR ALL
  USING (
    source_tenant_id::text = current_setting('app.current_tenant_id', true)
    OR sandbox_tenant_id::text = current_setting('app.current_tenant_id', true)
  );

CREATE POLICY sandbox_templates_tenant_isolation ON sandbox_templates
  FOR ALL
  USING (
    sandbox_id IN (
      SELECT sandbox_id FROM sandboxes
      WHERE source_tenant_id::text = current_setting('app.current_tenant_id', true)
    )
  );

CREATE POLICY sandbox_refresh_history_tenant_isolation ON sandbox_refresh_history
  FOR ALL
  USING (
    sandbox_id IN (
      SELECT sandbox_id FROM sandboxes
      WHERE source_tenant_id::text = current_setting('app.current_tenant_id', true)
    )
  );

COMMENT ON TABLE sandboxes IS 'Sandbox environments for development and testing';
COMMENT ON TABLE sandbox_templates IS 'Templates defining what data to copy to sandboxes';
COMMENT ON TABLE sandbox_refresh_history IS 'History of sandbox refresh operations';
