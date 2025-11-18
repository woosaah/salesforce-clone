-- Phase 27: Einstein Lead Scoring

CREATE TABLE IF NOT EXISTS lead_scores (
  score_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL,
  score INTEGER DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  factors JSONB DEFAULT '{}'::jsonb,
  last_calculated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scoring_models (
  model_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  model_name VARCHAR(255),
  weights JSONB DEFAULT '{}'::jsonb,
  factors JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_lead_scores_lead ON lead_scores(lead_id);
CREATE INDEX idx_scoring_models_tenant ON scoring_models(tenant_id);

ALTER TABLE lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_scores_access ON lead_scores FOR ALL USING (true);
CREATE POLICY scoring_models_tenant_isolation ON scoring_models
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
