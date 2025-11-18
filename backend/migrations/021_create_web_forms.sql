-- Phase 25: Web Forms (Web-to-Lead/Case)

CREATE TABLE IF NOT EXISTS web_forms (
  form_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  form_name VARCHAR(255) NOT NULL,
  target_object VARCHAR(100) NOT NULL,
  field_mappings JSONB DEFAULT '{}'::jsonb,
  embed_code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(user_id),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_web_forms_tenant ON web_forms(tenant_id);
ALTER TABLE web_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY web_forms_tenant_isolation ON web_forms
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
