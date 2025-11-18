-- Migration: Create Sales Cloud Module
-- Description: Complete sales management with leads, opportunities, accounts, contacts, and products

-- Note: Accounts and Contacts already exist as object_data entries
-- We'll create additional sales-specific tables and enhance with relationships

-- ============================================================================
-- LEADS TABLE
-- ============================================================================
CREATE TABLE leads (
    lead_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    record_type_id UUID REFERENCES record_types(record_type_id),

    -- Lead Information
    lead_number VARCHAR(100) NOT NULL,
    salutation VARCHAR(20),
    first_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    company VARCHAR(255) NOT NULL,
    title VARCHAR(100),

    -- Contact Details
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile_phone VARCHAR(50),
    website VARCHAR(255),

    -- Lead Classification
    lead_source VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'New',
    rating VARCHAR(50),
    industry VARCHAR(100),
    annual_revenue NUMERIC(15, 2),
    number_of_employees INTEGER,

    -- Address
    address JSONB,

    -- Description
    description TEXT,

    -- Conversion
    is_converted BOOLEAN DEFAULT false,
    converted_date TIMESTAMP WITH TIME ZONE,
    converted_account_id UUID,
    converted_contact_id UUID,
    converted_opportunity_id UUID,

    -- Privacy
    do_not_call BOOLEAN DEFAULT false,
    do_not_email BOOLEAN DEFAULT false,

    -- Ownership
    owner_id UUID NOT NULL REFERENCES users(user_id),
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_by UUID NOT NULL REFERENCES users(user_id),
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, lead_number),
    CONSTRAINT lead_status_valid CHECK (status IN (
        'New', 'Contacted', 'Qualified', 'Unqualified', 'Converted'
    )),
    CONSTRAINT lead_rating_valid CHECK (rating IN ('Hot', 'Warm', 'Cold'))
);

-- ============================================================================
-- LEAD SCORING TABLES
-- ============================================================================
CREATE TABLE lead_scoring_rules (
    rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    rule_name VARCHAR(255) NOT NULL,
    criteria JSONB NOT NULL,
    points INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,

    created_by UUID NOT NULL REFERENCES users(user_id),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lead_scores (
    lead_id UUID PRIMARY KEY REFERENCES leads(lead_id) ON DELETE CASCADE,
    total_score INTEGER DEFAULT 0,
    grade VARCHAR(1),
    last_calculated_date TIMESTAMP WITH TIME ZONE,
    score_breakdown JSONB
);

-- ============================================================================
-- OPPORTUNITIES TABLE
-- ============================================================================
CREATE TABLE opportunities (
    opportunity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    record_type_id UUID REFERENCES record_types(record_type_id),

    -- Opportunity Information
    opportunity_number VARCHAR(100) NOT NULL,
    opportunity_name VARCHAR(255) NOT NULL,

    -- Relationships
    account_id UUID REFERENCES object_data(record_id),
    contact_id UUID REFERENCES object_data(record_id),

    -- Financial
    amount NUMERIC(15, 2),
    currency_code VARCHAR(3) DEFAULT 'NZD',

    -- Dates
    close_date DATE NOT NULL,
    closed_date TIMESTAMP WITH TIME ZONE,

    -- Stage & Status
    stage_name VARCHAR(100) NOT NULL,
    probability INTEGER DEFAULT 0,
    forecast_category VARCHAR(50),
    is_won BOOLEAN DEFAULT false,
    is_closed BOOLEAN DEFAULT false,

    -- Classification
    type VARCHAR(100),
    lead_source VARCHAR(100),

    -- Details
    next_step TEXT,
    description TEXT,
    lost_reason TEXT,
    competitor VARCHAR(255),

    -- Ownership
    owner_id UUID NOT NULL REFERENCES users(user_id),
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_by UUID NOT NULL REFERENCES users(user_id),
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, opportunity_number),
    CONSTRAINT opp_type_valid CHECK (type IN ('New Business', 'Existing Business', 'Renewal')),
    CONSTRAINT forecast_category_valid CHECK (forecast_category IN ('Pipeline', 'Best Case', 'Commit', 'Closed', 'Omitted'))
);

-- ============================================================================
-- OPPORTUNITY STAGES TABLE
-- ============================================================================
CREATE TABLE opportunity_stages (
    stage_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    stage_name VARCHAR(100) NOT NULL,
    stage_order INTEGER NOT NULL,
    probability INTEGER NOT NULL,
    forecast_category VARCHAR(50) NOT NULL,
    is_closed BOOLEAN DEFAULT false,
    is_won BOOLEAN DEFAULT false,

    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, stage_name),
    CONSTRAINT opp_stage_probability CHECK (probability >= 0 AND probability <= 100)
);

-- ============================================================================
-- PRODUCTS TABLE
-- ============================================================================
CREATE TABLE products (
    product_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    record_type_id UUID REFERENCES record_types(record_type_id),

    -- Product Information
    product_code VARCHAR(100),
    product_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Classification
    product_family VARCHAR(100),
    is_active BOOLEAN DEFAULT true,

    -- Pricing
    standard_price NUMERIC(12, 2),
    cost_price NUMERIC(12, 2),
    quantity_unit_of_measure VARCHAR(50) DEFAULT 'Each',

    -- Supplier
    supplier_vendor_id UUID REFERENCES object_data(record_id),
    supplier_product_code VARCHAR(100),

    -- Ownership
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_by UUID NOT NULL REFERENCES users(user_id),
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, product_code)
);

-- ============================================================================
-- PRICE BOOKS TABLE
-- ============================================================================
CREATE TABLE price_books (
    price_book_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    price_book_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_standard BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    currency_code VARCHAR(3) DEFAULT 'NZD',

    created_by UUID NOT NULL REFERENCES users(user_id),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, price_book_name)
);

-- ============================================================================
-- PRICE BOOK ENTRIES TABLE
-- ============================================================================
CREATE TABLE price_book_entries (
    entry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    price_book_id UUID NOT NULL REFERENCES price_books(price_book_id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,

    unit_price NUMERIC(12, 2) NOT NULL,
    use_standard_price BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,

    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(price_book_id, product_id)
);

-- ============================================================================
-- OPPORTUNITY PRODUCTS TABLE
-- ============================================================================
CREATE TABLE opportunity_products (
    opp_product_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID NOT NULL REFERENCES opportunities(opportunity_id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(product_id),
    price_book_entry_id UUID REFERENCES price_book_entries(entry_id),

    line_number INTEGER NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12, 2) NOT NULL,
    discount_percent NUMERIC(5, 2) DEFAULT 0,
    discount_amount NUMERIC(12, 2) DEFAULT 0,
    total_price NUMERIC(12, 2) NOT NULL,
    description TEXT,

    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(opportunity_id, line_number)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Leads indexes
CREATE INDEX idx_leads_tenant_id ON leads(tenant_id);
CREATE INDEX idx_leads_owner_id ON leads(owner_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_rating ON leads(rating);
CREATE INDEX idx_leads_converted ON leads(is_converted);
CREATE INDEX idx_leads_lead_number ON leads(tenant_id, lead_number);
CREATE INDEX idx_leads_email ON leads(email) WHERE email IS NOT NULL;

-- Lead scoring indexes
CREATE INDEX idx_lead_scoring_rules_tenant ON lead_scoring_rules(tenant_id);
CREATE INDEX idx_lead_scores_grade ON lead_scores(grade);

-- Opportunities indexes
CREATE INDEX idx_opportunities_tenant_id ON opportunities(tenant_id);
CREATE INDEX idx_opportunities_account_id ON opportunities(account_id);
CREATE INDEX idx_opportunities_owner_id ON opportunities(owner_id);
CREATE INDEX idx_opportunities_stage ON opportunities(stage_name);
CREATE INDEX idx_opportunities_close_date ON opportunities(close_date);
CREATE INDEX idx_opportunities_is_closed ON opportunities(is_closed);
CREATE INDEX idx_opportunities_opp_number ON opportunities(tenant_id, opportunity_number);

-- Opportunity stages indexes
CREATE INDEX idx_opp_stages_tenant ON opportunity_stages(tenant_id);
CREATE INDEX idx_opp_stages_order ON opportunity_stages(tenant_id, stage_order);

-- Products indexes
CREATE INDEX idx_products_tenant_id ON products(tenant_id);
CREATE INDEX idx_products_product_code ON products(tenant_id, product_code);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_product_family ON products(product_family);

-- Price books indexes
CREATE INDEX idx_price_books_tenant ON price_books(tenant_id);
CREATE INDEX idx_price_books_is_standard ON price_books(tenant_id, is_standard);

-- Price book entries indexes
CREATE INDEX idx_pbe_price_book ON price_book_entries(price_book_id);
CREATE INDEX idx_pbe_product ON price_book_entries(product_id);

-- Opportunity products indexes
CREATE INDEX idx_opp_products_opportunity ON opportunity_products(opportunity_id);
CREATE INDEX idx_opp_products_product ON opportunity_products(product_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY leads_isolation_policy ON leads
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY lead_scoring_rules_isolation_policy ON lead_scoring_rules
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY opportunities_isolation_policy ON opportunities
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY opportunity_stages_isolation_policy ON opportunity_stages
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY products_isolation_policy ON products
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY price_books_isolation_policy ON price_books
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to calculate opportunity totals from products
CREATE OR REPLACE FUNCTION calculate_opportunity_amount()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE opportunities
    SET amount = (
        SELECT COALESCE(SUM(total_price), 0)
        FROM opportunity_products
        WHERE opportunity_id = NEW.opportunity_id
    )
    WHERE opportunity_id = NEW.opportunity_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER opp_products_amount_trigger
AFTER INSERT OR UPDATE OR DELETE ON opportunity_products
FOR EACH ROW
EXECUTE FUNCTION calculate_opportunity_amount();

-- ============================================================================
-- SEED DEFAULT OPPORTUNITY STAGES
-- ============================================================================

-- Default stages will be created per tenant via seed script

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE leads IS 'Lead management and tracking';
COMMENT ON TABLE lead_scoring_rules IS 'Automated lead scoring rules';
COMMENT ON TABLE lead_scores IS 'Calculated lead scores';
COMMENT ON TABLE opportunities IS 'Sales opportunities and deals';
COMMENT ON TABLE opportunity_stages IS 'Opportunity stage definitions';
COMMENT ON TABLE products IS 'Product catalog';
COMMENT ON TABLE price_books IS 'Price book definitions';
COMMENT ON TABLE price_book_entries IS 'Product prices per price book';
COMMENT ON TABLE opportunity_products IS 'Products added to opportunities';

COMMENT ON COLUMN leads.status IS 'Lead status: New, Contacted, Qualified, Unqualified, Converted';
COMMENT ON COLUMN opportunities.forecast_category IS 'Forecast category: Pipeline, Best Case, Commit, Closed, Omitted';
