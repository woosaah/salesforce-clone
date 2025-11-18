-- Phase 28: CPQ (Configure-Price-Quote)

CREATE TABLE IF NOT EXISTS product_options (
  option_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID,
  option_name VARCHAR(255),
  option_type VARCHAR(50),
  price_adjustment DECIMAL(15,2)
);

CREATE TABLE IF NOT EXISTS product_rules (
  rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  rule_name VARCHAR(255),
  if_product UUID,
  then_action VARCHAR(50),
  then_product UUID
);

CREATE TABLE IF NOT EXISTS quote_line_items (
  line_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID,
  product_id UUID,
  quantity INTEGER DEFAULT 1,
  list_price DECIMAL(15,2),
  discount_percent DECIMAL(5,2) DEFAULT 0,
  total_price DECIMAL(15,2)
);

CREATE INDEX idx_product_options_product ON product_options(product_id);
CREATE INDEX idx_product_rules_tenant ON product_rules(tenant_id);
CREATE INDEX idx_quote_line_items_quote ON quote_line_items(quote_id);

ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_options_access ON product_options FOR ALL USING (true);
CREATE POLICY product_rules_tenant_isolation ON product_rules
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));
CREATE POLICY quote_line_items_access ON quote_line_items FOR ALL USING (true);
