-- Migration: Create Invoicing & Billing Module
-- Description: Complete invoicing system with payments, templates, and customer portal

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================
CREATE TABLE invoices (
    invoice_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) NOT NULL,

    -- Customer relationships
    account_id UUID REFERENCES object_data(record_id),
    contact_id UUID REFERENCES object_data(record_id),
    opportunity_id UUID,

    -- Dates
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    sent_date TIMESTAMP WITH TIME ZONE,
    viewed_date TIMESTAMP WITH TIME ZONE,
    paid_date TIMESTAMP WITH TIME ZONE,

    -- Terms
    payment_terms VARCHAR(50) DEFAULT 'Net 30',

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'Draft',

    -- Amounts
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(5, 2) DEFAULT 0,
    tax_amount NUMERIC(12, 2) DEFAULT 0,
    discount_amount NUMERIC(12, 2) DEFAULT 0,
    discount_type VARCHAR(20) DEFAULT 'fixed',
    shipping_amount NUMERIC(12, 2) DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(12, 2) DEFAULT 0,
    amount_due NUMERIC(12, 2) DEFAULT 0,

    -- Currency
    currency_code VARCHAR(3) DEFAULT 'NZD',

    -- Addresses
    billing_address JSONB,
    shipping_address JSONB,

    -- Content
    notes TEXT,
    terms_and_conditions TEXT,
    footer_text TEXT,

    -- Email tracking
    sent_to_email VARCHAR(255),

    -- Payment tracking
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),

    -- PDF
    pdf_generated_path VARCHAR(500),

    -- Ownership
    owner_id UUID NOT NULL REFERENCES users(user_id),
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_by UUID NOT NULL REFERENCES users(user_id),
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, invoice_number),
    CONSTRAINT invoice_status_valid CHECK (status IN (
        'Draft', 'Sent', 'Viewed', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled', 'Void'
    )),
    CONSTRAINT invoice_payment_terms_valid CHECK (payment_terms IN (
        'Due on Receipt', 'Net 15', 'Net 30', 'Net 60', 'Net 90'
    ))
);

-- ============================================================================
-- INVOICE LINE ITEMS TABLE
-- ============================================================================
CREATE TABLE invoice_line_items (
    line_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,

    -- Product reference
    product_id UUID REFERENCES object_data(record_id),
    product_code VARCHAR(100),

    -- Details
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,

    -- Discounts
    discount_percent NUMERIC(5, 2) DEFAULT 0,
    discount_amount NUMERIC(12, 2) DEFAULT 0,

    -- Tax
    tax_amount NUMERIC(12, 2) DEFAULT 0,

    -- Total
    line_total NUMERIC(12, 2) NOT NULL DEFAULT 0,

    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(invoice_id, line_number)
);

-- ============================================================================
-- INVOICE PAYMENTS TABLE
-- ============================================================================
CREATE TABLE invoice_payments (
    payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    -- Payment details
    payment_date DATE NOT NULL,
    amount_paid NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    reference_number VARCHAR(255),
    notes TEXT,

    -- Processing
    processed_by UUID NOT NULL REFERENCES users(user_id),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT payment_amount_positive CHECK (amount_paid > 0)
);

-- ============================================================================
-- INVOICE TEMPLATES TABLE
-- ============================================================================
CREATE TABLE invoice_templates (
    template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    template_name VARCHAR(255) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    layout_type VARCHAR(50) DEFAULT 'standard',

    -- HTML content
    header_html TEXT,
    body_html TEXT,
    footer_html TEXT,
    css_styles TEXT,

    -- Logo
    logo_url VARCHAR(500),

    -- Color scheme
    color_scheme JSONB DEFAULT '{
        "primary": "#2563eb",
        "secondary": "#64748b",
        "text": "#1e293b",
        "background": "#ffffff"
    }'::jsonb,

    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, template_name),
    CONSTRAINT template_layout_valid CHECK (layout_type IN ('standard', 'modern', 'classic', 'minimal'))
);

-- ============================================================================
-- INVOICE SETTINGS TABLE
-- ============================================================================
CREATE TABLE invoice_settings (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    -- Numbering
    invoice_prefix VARCHAR(20) DEFAULT 'INV',
    starting_number INTEGER DEFAULT 1,
    next_invoice_number INTEGER DEFAULT 1,

    -- Defaults
    default_payment_terms VARCHAR(50) DEFAULT 'Net 30',
    default_tax_rate NUMERIC(5, 2) DEFAULT 15.00,
    tax_label VARCHAR(50) DEFAULT 'GST',
    tax_number VARCHAR(100),

    -- Company info
    company_name VARCHAR(255),
    company_address JSONB,
    company_phone VARCHAR(50),
    company_email VARCHAR(255),
    company_website VARCHAR(255),

    -- Bank details
    bank_details JSONB DEFAULT '{
        "bank_name": "",
        "account_number": "",
        "swift_code": "",
        "iban": ""
    }'::jsonb,

    -- Template
    default_template_id UUID REFERENCES invoice_templates(template_id),

    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- RECURRING INVOICES TABLE
-- ============================================================================
CREATE TABLE recurring_invoices (
    recurring_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    -- Template
    template_invoice_id UUID REFERENCES invoices(invoice_id),
    account_id UUID REFERENCES object_data(record_id),

    -- Recurrence
    recurrence_type VARCHAR(50) NOT NULL,
    recurrence_interval INTEGER DEFAULT 1,
    start_date DATE NOT NULL,
    end_date DATE,
    next_generation_date DATE NOT NULL,

    -- Settings
    is_active BOOLEAN DEFAULT true,
    auto_send BOOLEAN DEFAULT false,

    -- Stats
    created_invoices_count INTEGER DEFAULT 0,

    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT recurrence_type_valid CHECK (recurrence_type IN (
        'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
    ))
);

-- ============================================================================
-- PORTAL ACCESS TOKENS TABLE (for customer portal)
-- ============================================================================
CREATE TABLE portal_access_tokens (
    token_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    token VARCHAR(100) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Invoices indexes
CREATE INDEX idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX idx_invoices_account_id ON invoices(account_id);
CREATE INDEX idx_invoices_contact_id ON invoices(contact_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_invoice_date ON invoices(invoice_date DESC);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_invoice_number ON invoices(tenant_id, invoice_number);
CREATE INDEX idx_invoices_owner_id ON invoices(owner_id);

-- Line items indexes
CREATE INDEX idx_line_items_invoice_id ON invoice_line_items(invoice_id);
CREATE INDEX idx_line_items_product_id ON invoice_line_items(product_id);

-- Payments indexes
CREATE INDEX idx_payments_invoice_id ON invoice_payments(invoice_id);
CREATE INDEX idx_payments_tenant_id ON invoice_payments(tenant_id);
CREATE INDEX idx_payments_payment_date ON invoice_payments(payment_date DESC);

-- Templates indexes
CREATE INDEX idx_templates_tenant_id ON invoice_templates(tenant_id);
CREATE INDEX idx_templates_is_default ON invoice_templates(tenant_id, is_default) WHERE is_default = true;

-- Recurring invoices indexes
CREATE INDEX idx_recurring_tenant_id ON recurring_invoices(tenant_id);
CREATE INDEX idx_recurring_next_date ON recurring_invoices(next_generation_date) WHERE is_active = true;
CREATE INDEX idx_recurring_account_id ON recurring_invoices(account_id);

-- Portal tokens indexes
CREATE INDEX idx_portal_tokens_invoice_id ON portal_access_tokens(invoice_id);
CREATE INDEX idx_portal_tokens_token ON portal_access_tokens(token);
CREATE INDEX idx_portal_tokens_expires ON portal_access_tokens(expires_at);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_invoices ENABLE ROW LEVEL SECURITY;
-- Note: portal_access_tokens does NOT have RLS (public access via token)

-- RLS Policies
CREATE POLICY invoices_isolation_policy ON invoices
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY line_items_isolation_policy ON invoice_line_items
    FOR ALL
    USING (
        invoice_id IN (
            SELECT invoice_id FROM invoices
            WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
    );

CREATE POLICY payments_isolation_policy ON invoice_payments
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY templates_isolation_policy ON invoice_templates
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY settings_isolation_policy ON invoice_settings
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY recurring_isolation_policy ON recurring_invoices
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to auto-calculate invoice totals
CREATE OR REPLACE FUNCTION calculate_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalculate subtotal from line items
    NEW.subtotal := (
        SELECT COALESCE(SUM(line_total), 0)
        FROM invoice_line_items
        WHERE invoice_id = NEW.invoice_id
    );

    -- Calculate tax
    NEW.tax_amount := (NEW.subtotal - COALESCE(NEW.discount_amount, 0)) * (NEW.tax_rate / 100);

    -- Calculate total
    NEW.total_amount := NEW.subtotal - COALESCE(NEW.discount_amount, 0) + NEW.tax_amount + COALESCE(NEW.shipping_amount, 0);

    -- Calculate amount due
    NEW.amount_due := NEW.total_amount - COALESCE(NEW.amount_paid, 0);

    -- Update status based on payment
    IF NEW.amount_paid >= NEW.total_amount THEN
        NEW.status := 'Paid';
        IF NEW.paid_date IS NULL THEN
            NEW.paid_date := CURRENT_TIMESTAMP;
        END IF;
    ELSIF NEW.amount_paid > 0 THEN
        NEW.status := 'Partially Paid';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate totals
CREATE TRIGGER invoice_totals_trigger
BEFORE UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION calculate_invoice_totals();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE invoices IS 'Customer invoices with billing and payment tracking';
COMMENT ON TABLE invoice_line_items IS 'Line items for each invoice';
COMMENT ON TABLE invoice_payments IS 'Payment records for invoices';
COMMENT ON TABLE invoice_templates IS 'PDF template designs for invoices';
COMMENT ON TABLE invoice_settings IS 'Tenant-specific invoice configuration';
COMMENT ON TABLE recurring_invoices IS 'Recurring invoice schedules';
COMMENT ON TABLE portal_access_tokens IS 'Secure tokens for customer portal access';

COMMENT ON COLUMN invoices.status IS 'Invoice status: Draft, Sent, Viewed, Partially Paid, Paid, Overdue, Cancelled, Void';
COMMENT ON COLUMN invoices.payment_terms IS 'Payment terms: Due on Receipt, Net 15, Net 30, Net 60, Net 90';
COMMENT ON COLUMN invoices.amount_due IS 'Remaining balance (total - paid)';
COMMENT ON COLUMN recurring_invoices.recurrence_type IS 'Frequency: daily, weekly, monthly, quarterly, yearly';
