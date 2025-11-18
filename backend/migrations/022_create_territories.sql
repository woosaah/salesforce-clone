-- Phase 26: Territory Management

CREATE TABLE IF NOT EXISTS territories (
  territory_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  territory_name VARCHAR(255) NOT NULL,
  parent_territory_id UUID REFERENCES territories(territory_id),
  description TEXT,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS territory_assignments (
  assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  territory_id UUID NOT NULL REFERENCES territories(territory_id) ON DELETE CASCADE,
  account_id UUID,
  assignment_rule JSONB
);

CREATE TABLE IF NOT EXISTS territory_users (
  territory_user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  territory_id UUID NOT NULL REFERENCES territories(territory_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id),
  role VARCHAR(50) DEFAULT 'Member'
);

CREATE INDEX idx_territories_tenant ON territories(tenant_id);
CREATE INDEX idx_territory_assignments_territory ON territory_assignments(territory_id);
CREATE INDEX idx_territory_users_territory ON territory_users(territory_id);

ALTER TABLE territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE territory_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE territory_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY territories_tenant_isolation ON territories
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY territory_assignments_tenant_isolation ON territory_assignments
  FOR ALL USING (territory_id IN (SELECT territory_id FROM territories WHERE tenant_id::text = current_setting('app.current_tenant_id', true)));

CREATE POLICY territory_users_tenant_isolation ON territory_users
  FOR ALL USING (territory_id IN (SELECT territory_id FROM territories WHERE tenant_id::text = current_setting('app.current_tenant_id', true)));
