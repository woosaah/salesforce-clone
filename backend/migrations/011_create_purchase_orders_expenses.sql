-- Migration: Create Purchase Orders & Expense Tracking Module
-- Description: Purchase order management and expense reporting system

-- ============================================================================
-- PURCHASE ORDERS TABLE
-- ============================================================================
CREATE TABLE purchase_orders (
    po_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    -- PO Information
    po_number VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Vendor/Supplier
    vendor_id UUID REFERENCES object_data(record_id),
    vendor_name VARCHAR(255),
    vendor_contact VARCHAR(255),

    -- Dates
    order_date DATE NOT NULL,
    delivery_date DATE,
    received_date DATE,

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'Draft',
    approval_status VARCHAR(50) DEFAULT 'Pending',

    -- Amounts
    subtotal NUMERIC(12, 2) DEFAULT 0,
    tax_rate NUMERIC(5, 2) DEFAULT 0,
    tax_amount NUMERIC(12, 2) DEFAULT 0,
    shipping_cost NUMERIC(12, 2) DEFAULT 0,
    total_amount NUMERIC(12, 2) DEFAULT 0,
    currency_code VARCHAR(3) DEFAULT 'NZD',

    -- Delivery Address
    shipping_address JSONB,

    -- Terms
    payment_terms VARCHAR(100),
    notes TEXT,
    internal_notes TEXT,

    -- Approval
    approved_by_id UUID REFERENCES users(user_id),
    approval_date TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,

    -- Ownership
    requester_id UUID REFERENCES users(user_id),
    owner_id UUID NOT NULL REFERENCES users(user_id),
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_by UUID NOT NULL REFERENCES users(user_id),
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, po_number),
    CONSTRAINT po_status_valid CHECK (status IN (
        'Draft', 'Submitted', 'Approved', 'Sent', 'Partially Received', 'Received', 'Cancelled', 'Rejected'
    )),
    CONSTRAINT po_approval_status_valid CHECK (approval_status IN (
        'Pending', 'Approved', 'Rejected'
    ))
);

-- ============================================================================
-- PO LINE ITEMS TABLE
-- ============================================================================
CREATE TABLE po_line_items (
    line_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_id UUID NOT NULL REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,

    -- Product reference
    product_id UUID REFERENCES object_data(record_id),
    product_code VARCHAR(100),

    -- Details
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,

    -- Received
    quantity_received NUMERIC(10, 2) DEFAULT 0,

    -- Tax
    tax_amount NUMERIC(12, 2) DEFAULT 0,

    -- Total
    line_total NUMERIC(12, 2) NOT NULL DEFAULT 0,

    notes TEXT,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(po_id, line_number)
);

-- ============================================================================
-- EXPENSE CATEGORIES TABLE
-- ============================================================================
CREATE TABLE expense_categories (
    category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    category_name VARCHAR(100) NOT NULL,
    description TEXT,
    category_code VARCHAR(50),
    parent_category_id UUID REFERENCES expense_categories(category_id),

    -- Limits
    daily_limit NUMERIC(12, 2),
    monthly_limit NUMERIC(12, 2),

    is_active BOOLEAN DEFAULT true,

    created_by UUID NOT NULL REFERENCES users(user_id),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_by UUID NOT NULL REFERENCES users(user_id),
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, category_name)
);

-- ============================================================================
-- EXPENSE REPORTS TABLE
-- ============================================================================
CREATE TABLE expense_reports (
    report_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    -- Report Information
    report_number VARCHAR(100) NOT NULL,
    report_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Dates
    report_date DATE NOT NULL,
    start_date DATE,
    end_date DATE,

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'Draft',
    approval_status VARCHAR(50) DEFAULT 'Pending',

    -- Amounts
    total_amount NUMERIC(12, 2) DEFAULT 0,
    reimbursable_amount NUMERIC(12, 2) DEFAULT 0,
    non_reimbursable_amount NUMERIC(12, 2) DEFAULT 0,
    currency_code VARCHAR(3) DEFAULT 'NZD',

    -- Reimbursement
    reimbursement_status VARCHAR(50) DEFAULT 'Pending',
    reimbursement_date DATE,
    reimbursement_method VARCHAR(50),
    reimbursement_reference VARCHAR(255),

    -- Business Purpose
    business_purpose TEXT,
    notes TEXT,

    -- Approval
    approved_by_id UUID REFERENCES users(user_id),
    approval_date TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,

    -- Ownership
    employee_id UUID NOT NULL REFERENCES users(user_id),
    owner_id UUID NOT NULL REFERENCES users(user_id),
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_by UUID NOT NULL REFERENCES users(user_id),
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, report_number),
    CONSTRAINT expense_status_valid CHECK (status IN (
        'Draft', 'Submitted', 'Approved', 'Rejected', 'Reimbursed'
    )),
    CONSTRAINT expense_approval_status_valid CHECK (approval_status IN (
        'Pending', 'Approved', 'Rejected'
    )),
    CONSTRAINT reimbursement_status_valid CHECK (reimbursement_status IN (
        'Pending', 'Approved', 'Paid', 'Not Applicable'
    ))
);

-- ============================================================================
-- EXPENSE LINE ITEMS TABLE
-- ============================================================================
CREATE TABLE expense_line_items (
    expense_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES expense_reports(report_id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,

    -- Expense Details
    expense_date DATE NOT NULL,
    category_id UUID REFERENCES expense_categories(category_id),
    description TEXT NOT NULL,

    -- Amounts
    amount NUMERIC(12, 2) NOT NULL,
    tax_amount NUMERIC(12, 2) DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL,

    -- Classification
    is_reimbursable BOOLEAN DEFAULT true,
    is_billable BOOLEAN DEFAULT false,
    billable_account_id UUID REFERENCES object_data(record_id),

    -- Payment
    payment_method VARCHAR(50),
    currency_code VARCHAR(3) DEFAULT 'NZD',

    -- Vendor
    vendor_name VARCHAR(255),
    merchant_name VARCHAR(255),

    -- Location
    location VARCHAR(255),
    city VARCHAR(100),
    country VARCHAR(100),

    -- Receipt
    has_receipt BOOLEAN DEFAULT false,
    receipt_number VARCHAR(100),
    receipt_url VARCHAR(500),

    -- Mileage (for travel expenses)
    mileage NUMERIC(8, 2),
    mileage_rate NUMERIC(6, 2),

    notes TEXT,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(report_id, line_number)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Purchase Orders indexes
CREATE INDEX idx_purchase_orders_tenant_id ON purchase_orders(tenant_id);
CREATE INDEX idx_purchase_orders_vendor_id ON purchase_orders(vendor_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_approval_status ON purchase_orders(approval_status);
CREATE INDEX idx_purchase_orders_order_date ON purchase_orders(order_date DESC);
CREATE INDEX idx_purchase_orders_po_number ON purchase_orders(tenant_id, po_number);

-- PO Line Items indexes
CREATE INDEX idx_po_line_items_po_id ON po_line_items(po_id);
CREATE INDEX idx_po_line_items_product_id ON po_line_items(product_id);

-- Expense Categories indexes
CREATE INDEX idx_expense_categories_tenant_id ON expense_categories(tenant_id);
CREATE INDEX idx_expense_categories_parent ON expense_categories(parent_category_id);
CREATE INDEX idx_expense_categories_active ON expense_categories(tenant_id, is_active) WHERE is_active = true;

-- Expense Reports indexes
CREATE INDEX idx_expense_reports_tenant_id ON expense_reports(tenant_id);
CREATE INDEX idx_expense_reports_employee_id ON expense_reports(employee_id);
CREATE INDEX idx_expense_reports_status ON expense_reports(status);
CREATE INDEX idx_expense_reports_approval_status ON expense_reports(approval_status);
CREATE INDEX idx_expense_reports_report_date ON expense_reports(report_date DESC);
CREATE INDEX idx_expense_reports_report_number ON expense_reports(tenant_id, report_number);

-- Expense Line Items indexes
CREATE INDEX idx_expense_items_report_id ON expense_line_items(report_id);
CREATE INDEX idx_expense_items_category_id ON expense_line_items(category_id);
CREATE INDEX idx_expense_items_expense_date ON expense_line_items(expense_date DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY purchase_orders_isolation_policy ON purchase_orders
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY po_line_items_isolation_policy ON po_line_items
    FOR ALL
    USING (
        po_id IN (
            SELECT po_id FROM purchase_orders
            WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
    );

CREATE POLICY expense_categories_isolation_policy ON expense_categories
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY expense_reports_isolation_policy ON expense_reports
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY expense_items_isolation_policy ON expense_line_items
    FOR ALL
    USING (
        report_id IN (
            SELECT report_id FROM expense_reports
            WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
    );

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to auto-calculate PO totals
CREATE OR REPLACE FUNCTION calculate_po_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalculate subtotal from line items
    NEW.subtotal := (
        SELECT COALESCE(SUM(line_total), 0)
        FROM po_line_items
        WHERE po_id = NEW.po_id
    );

    -- Calculate tax
    NEW.tax_amount := NEW.subtotal * (NEW.tax_rate / 100);

    -- Calculate total
    NEW.total_amount := NEW.subtotal + NEW.tax_amount + COALESCE(NEW.shipping_cost, 0);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER po_totals_trigger
BEFORE UPDATE ON purchase_orders
FOR EACH ROW
EXECUTE FUNCTION calculate_po_totals();

-- Function to auto-calculate expense report totals
CREATE OR REPLACE FUNCTION calculate_expense_report_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalculate totals from expense items
    SELECT
        COALESCE(SUM(total_amount), 0),
        COALESCE(SUM(CASE WHEN is_reimbursable = true THEN total_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN is_reimbursable = false THEN total_amount ELSE 0 END), 0)
    INTO
        NEW.total_amount,
        NEW.reimbursable_amount,
        NEW.non_reimbursable_amount
    FROM expense_line_items
    WHERE report_id = NEW.report_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER expense_report_totals_trigger
BEFORE UPDATE ON expense_reports
FOR EACH ROW
EXECUTE FUNCTION calculate_expense_report_totals();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE purchase_orders IS 'Purchase orders for procurement';
COMMENT ON TABLE po_line_items IS 'Line items for purchase orders';
COMMENT ON TABLE expense_categories IS 'Expense category definitions';
COMMENT ON TABLE expense_reports IS 'Employee expense reports';
COMMENT ON TABLE expense_line_items IS 'Individual expenses within reports';

COMMENT ON COLUMN purchase_orders.status IS 'PO status: Draft, Submitted, Approved, Sent, Partially Received, Received, Cancelled, Rejected';
COMMENT ON COLUMN expense_reports.status IS 'Report status: Draft, Submitted, Approved, Rejected, Reimbursed';
