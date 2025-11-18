-- ============================================================================
-- Migration: Create Change Sets
-- Description: Deployment pipeline between environments
-- ============================================================================

-- Change sets (outbound)
CREATE TABLE IF NOT EXISTS change_sets (
  change_set_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  change_set_name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'Open' CHECK (status IN ('Open', 'Uploaded', 'Deployed')),
  target_sandbox_id UUID REFERENCES sandboxes(sandbox_id),
  created_by UUID REFERENCES users(user_id),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  uploaded_date TIMESTAMP WITH TIME ZONE,
  deployed_date TIMESTAMP WITH TIME ZONE,
  UNIQUE(tenant_id, change_set_name)
);

-- Change set components
CREATE TABLE IF NOT EXISTS change_set_components (
  component_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  change_set_id UUID NOT NULL REFERENCES change_sets(change_set_id) ON DELETE CASCADE,
  component_type VARCHAR(100) NOT NULL,
  component_name VARCHAR(255) NOT NULL,
  component_metadata JSONB,
  parent_component_id UUID REFERENCES change_set_components(component_id)
);

-- Inbound change sets (received from other environments)
CREATE TABLE IF NOT EXISTS inbound_change_sets (
  inbound_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  source_change_set_id UUID,
  change_set_name VARCHAR(255) NOT NULL,
  description TEXT,
  source_org VARCHAR(255),
  status VARCHAR(50) DEFAULT 'Received' CHECK (status IN ('Received', 'Validating', 'Validated', 'Deploying', 'Deployed', 'Failed')),
  received_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  validated_date TIMESTAMP WITH TIME ZONE,
  deployed_date TIMESTAMP WITH TIME ZONE
);

-- Deployment results
CREATE TABLE IF NOT EXISTS deployment_results (
  result_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inbound_change_set_id UUID REFERENCES inbound_change_sets(inbound_id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'Pending',
  total_components INTEGER DEFAULT 0,
  deployed_components INTEGER DEFAULT 0,
  failed_components INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  warnings JSONB DEFAULT '[]'::jsonb,
  started_date TIMESTAMP WITH TIME ZONE,
  completed_date TIMESTAMP WITH TIME ZONE
);

-- Component deployment status
CREATE TABLE IF NOT EXISTS component_deployment_status (
  status_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deployment_result_id UUID REFERENCES deployment_results(result_id) ON DELETE CASCADE,
  component_type VARCHAR(100),
  component_name VARCHAR(255),
  status VARCHAR(50),
  error_message TEXT,
  deployed_date TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_change_sets_tenant ON change_sets(tenant_id);
CREATE INDEX idx_change_sets_status ON change_sets(status);
CREATE INDEX idx_change_set_components_change_set ON change_set_components(change_set_id);
CREATE INDEX idx_inbound_change_sets_tenant ON inbound_change_sets(tenant_id);
CREATE INDEX idx_deployment_results_inbound ON deployment_results(inbound_change_set_id);

-- Enable RLS
ALTER TABLE change_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_set_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_change_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_deployment_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY change_sets_tenant_isolation ON change_sets
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY change_set_components_tenant_isolation ON change_set_components
  FOR ALL USING (
    change_set_id IN (SELECT change_set_id FROM change_sets WHERE tenant_id::text = current_setting('app.current_tenant_id', true))
  );

CREATE POLICY inbound_change_sets_tenant_isolation ON inbound_change_sets
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY deployment_results_tenant_isolation ON deployment_results
  FOR ALL USING (
    inbound_change_set_id IN (SELECT inbound_id FROM inbound_change_sets WHERE tenant_id::text = current_setting('app.current_tenant_id', true))
  );

CREATE POLICY component_deployment_status_tenant_isolation ON component_deployment_status
  FOR ALL USING (
    deployment_result_id IN (
      SELECT result_id FROM deployment_results dr
      JOIN inbound_change_sets ics ON dr.inbound_change_set_id = ics.inbound_id
      WHERE ics.tenant_id::text = current_setting('app.current_tenant_id', true)
    )
  );

COMMENT ON TABLE change_sets IS 'Outbound change sets for deployment';
COMMENT ON TABLE change_set_components IS 'Components included in change sets';
COMMENT ON TABLE inbound_change_sets IS 'Inbound change sets from other environments';
COMMENT ON TABLE deployment_results IS 'Results of change set deployments';
