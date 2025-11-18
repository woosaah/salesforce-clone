-- Migration: Create Asset Management Module
-- Description: Complete asset lifecycle management with maintenance, transfers, and depreciation

-- ============================================================================
-- ASSETS TABLE (Enhanced asset tracking)
-- ============================================================================
CREATE TABLE assets (
    asset_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    -- Core Information
    asset_number VARCHAR(100) NOT NULL,
    asset_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Classification
    asset_type VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    serial_number VARCHAR(255),
    model_number VARCHAR(255),
    manufacturer VARCHAR(255),

    -- Relationships
    product_id UUID REFERENCES object_data(record_id),
    account_id UUID REFERENCES object_data(record_id),
    contact_id UUID REFERENCES object_data(record_id),
    location_id UUID REFERENCES object_data(record_id),

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'Available',
    condition VARCHAR(50) DEFAULT 'Good',

    -- Dates
    purchase_date DATE,
    warranty_start_date DATE,
    warranty_end_date DATE,
    installation_date DATE,
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    disposal_date DATE,

    -- Financial
    purchase_price NUMERIC(12, 2),
    current_value NUMERIC(12, 2),
    salvage_value NUMERIC(12, 2),
    depreciation_method VARCHAR(50) DEFAULT 'Straight Line',
    useful_life_years INTEGER,

    -- Location
    current_location VARCHAR(255),
    building VARCHAR(100),
    floor VARCHAR(50),
    room VARCHAR(50),

    -- Additional Info
    barcode VARCHAR(100),
    qr_code VARCHAR(255),
    notes TEXT,

    -- Custom fields
    custom_fields JSONB DEFAULT '{}'::jsonb,

    -- Ownership
    owner_id UUID NOT NULL REFERENCES users(user_id),
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_by UUID NOT NULL REFERENCES users(user_id),
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, asset_number),
    CONSTRAINT asset_status_valid CHECK (status IN (
        'Available', 'In Use', 'Under Maintenance', 'Reserved',
        'Out of Service', 'Retired', 'Disposed', 'Lost', 'Stolen'
    )),
    CONSTRAINT asset_condition_valid CHECK (condition IN (
        'New', 'Excellent', 'Good', 'Fair', 'Poor', 'Damaged'
    )),
    CONSTRAINT asset_depreciation_method_valid CHECK (depreciation_method IN (
        'Straight Line', 'Declining Balance', 'Double Declining Balance', 'Units of Production', 'Sum of Years Digits'
    ))
);

-- ============================================================================
-- MAINTENANCE SCHEDULES TABLE
-- ============================================================================
CREATE TABLE maintenance_schedules (
    schedule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    -- Schedule Info
    schedule_name VARCHAR(255) NOT NULL,
    description TEXT,
    maintenance_type VARCHAR(100) NOT NULL,

    -- Frequency
    frequency_type VARCHAR(50) NOT NULL,
    frequency_value INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    next_due_date DATE NOT NULL,

    -- Details
    estimated_duration_hours NUMERIC(6, 2),
    estimated_cost NUMERIC(12, 2),
    priority VARCHAR(50) DEFAULT 'Medium',

    -- Assignment
    assigned_to_id UUID REFERENCES users(user_id),
    vendor_id UUID REFERENCES object_data(record_id),

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Tracking
    times_performed INTEGER DEFAULT 0,
    last_performed_date DATE,

    created_by UUID NOT NULL REFERENCES users(user_id),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_by UUID NOT NULL REFERENCES users(user_id),
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT maintenance_frequency_valid CHECK (frequency_type IN (
        'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'Custom'
    )),
    CONSTRAINT maintenance_priority_valid CHECK (priority IN (
        'Low', 'Medium', 'High', 'Critical'
    ))
);

-- ============================================================================
-- MAINTENANCE RECORDS TABLE
-- ============================================================================
CREATE TABLE maintenance_records (
    record_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES maintenance_schedules(schedule_id),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    -- Record Info
    record_number VARCHAR(100) NOT NULL,
    maintenance_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Dates
    scheduled_date DATE,
    start_date DATE NOT NULL,
    completion_date DATE,

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'Scheduled',

    -- Details
    work_performed TEXT,
    parts_used TEXT,
    tools_used TEXT,

    -- Assignment
    performed_by_id UUID REFERENCES users(user_id),
    vendor_id UUID REFERENCES object_data(record_id),
    vendor_name VARCHAR(255),

    -- Financial
    labor_cost NUMERIC(12, 2) DEFAULT 0,
    parts_cost NUMERIC(12, 2) DEFAULT 0,
    other_cost NUMERIC(12, 2) DEFAULT 0,
    total_cost NUMERIC(12, 2) DEFAULT 0,

    -- Hours
    labor_hours NUMERIC(6, 2),
    downtime_hours NUMERIC(6, 2),

    -- Follow-up
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_date DATE,
    follow_up_notes TEXT,

    -- Attachments
    attachments JSONB DEFAULT '[]'::jsonb,

    created_by UUID NOT NULL REFERENCES users(user_id),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_by UUID NOT NULL REFERENCES users(user_id),
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, record_number),
    CONSTRAINT maintenance_status_valid CHECK (status IN (
        'Scheduled', 'In Progress', 'Completed', 'Cancelled', 'On Hold'
    ))
);

-- ============================================================================
-- ASSET TRANSFERS TABLE
-- ============================================================================
CREATE TABLE asset_transfers (
    transfer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    -- Transfer Info
    transfer_number VARCHAR(100) NOT NULL,
    transfer_date DATE NOT NULL,
    transfer_type VARCHAR(50) NOT NULL,

    -- From/To
    from_account_id UUID REFERENCES object_data(record_id),
    to_account_id UUID REFERENCES object_data(record_id),
    from_location VARCHAR(255),
    to_location VARCHAR(255),
    from_contact_id UUID REFERENCES users(user_id),
    to_contact_id UUID REFERENCES users(user_id),

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',

    -- Details
    reason TEXT,
    notes TEXT,

    -- Approval
    requires_approval BOOLEAN DEFAULT false,
    approved_by_id UUID REFERENCES users(user_id),
    approval_date TIMESTAMP WITH TIME ZONE,

    -- Condition at transfer
    condition_before VARCHAR(50),
    condition_after VARCHAR(50),

    created_by UUID NOT NULL REFERENCES users(user_id),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, transfer_number),
    CONSTRAINT transfer_type_valid CHECK (transfer_type IN (
        'Location', 'Account', 'Department', 'Employee', 'Disposal', 'Return'
    )),
    CONSTRAINT transfer_status_valid CHECK (status IN (
        'Pending', 'Approved', 'In Transit', 'Completed', 'Cancelled', 'Rejected'
    ))
);

-- ============================================================================
-- ASSET DEPRECIATION TABLE
-- ============================================================================
CREATE TABLE asset_depreciation (
    depreciation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    -- Depreciation Info
    calculation_date DATE NOT NULL,
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,

    -- Values
    book_value_start NUMERIC(12, 2) NOT NULL,
    depreciation_amount NUMERIC(12, 2) NOT NULL,
    accumulated_depreciation NUMERIC(12, 2) NOT NULL,
    book_value_end NUMERIC(12, 2) NOT NULL,

    -- Method
    depreciation_method VARCHAR(50) NOT NULL,
    depreciation_rate NUMERIC(5, 2),

    -- Status
    is_posted BOOLEAN DEFAULT false,
    posted_date TIMESTAMP WITH TIME ZONE,
    posted_by_id UUID REFERENCES users(user_id),

    notes TEXT,

    created_by UUID NOT NULL REFERENCES users(user_id),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT depreciation_method_valid CHECK (depreciation_method IN (
        'Straight Line', 'Declining Balance', 'Double Declining Balance', 'Units of Production', 'Sum of Years Digits'
    ))
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Assets indexes
CREATE INDEX idx_assets_tenant_id ON assets(tenant_id);
CREATE INDEX idx_assets_account_id ON assets(account_id);
CREATE INDEX idx_assets_product_id ON assets(product_id);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_asset_type ON assets(asset_type);
CREATE INDEX idx_assets_asset_number ON assets(tenant_id, asset_number);
CREATE INDEX idx_assets_serial_number ON assets(serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX idx_assets_next_maintenance ON assets(next_maintenance_date) WHERE next_maintenance_date IS NOT NULL;

-- Maintenance schedules indexes
CREATE INDEX idx_maintenance_schedules_asset_id ON maintenance_schedules(asset_id);
CREATE INDEX idx_maintenance_schedules_tenant_id ON maintenance_schedules(tenant_id);
CREATE INDEX idx_maintenance_schedules_next_due ON maintenance_schedules(next_due_date) WHERE is_active = true;
CREATE INDEX idx_maintenance_schedules_assigned_to ON maintenance_schedules(assigned_to_id);

-- Maintenance records indexes
CREATE INDEX idx_maintenance_records_asset_id ON maintenance_records(asset_id);
CREATE INDEX idx_maintenance_records_tenant_id ON maintenance_records(tenant_id);
CREATE INDEX idx_maintenance_records_schedule_id ON maintenance_records(schedule_id);
CREATE INDEX idx_maintenance_records_status ON maintenance_records(status);
CREATE INDEX idx_maintenance_records_start_date ON maintenance_records(start_date DESC);

-- Transfer indexes
CREATE INDEX idx_asset_transfers_asset_id ON asset_transfers(asset_id);
CREATE INDEX idx_asset_transfers_tenant_id ON asset_transfers(tenant_id);
CREATE INDEX idx_asset_transfers_status ON asset_transfers(status);
CREATE INDEX idx_asset_transfers_transfer_date ON asset_transfers(transfer_date DESC);

-- Depreciation indexes
CREATE INDEX idx_asset_depreciation_asset_id ON asset_depreciation(asset_id);
CREATE INDEX idx_asset_depreciation_tenant_id ON asset_depreciation(tenant_id);
CREATE INDEX idx_asset_depreciation_calculation_date ON asset_depreciation(calculation_date DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_depreciation ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY assets_isolation_policy ON assets
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY maintenance_schedules_isolation_policy ON maintenance_schedules
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY maintenance_records_isolation_policy ON maintenance_records
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY asset_transfers_isolation_policy ON asset_transfers
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY asset_depreciation_isolation_policy ON asset_depreciation
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to calculate straight-line depreciation
CREATE OR REPLACE FUNCTION calculate_straight_line_depreciation(
    p_purchase_price NUMERIC,
    p_salvage_value NUMERIC,
    p_useful_life_years INTEGER,
    p_months_elapsed INTEGER
) RETURNS NUMERIC AS $$
DECLARE
    annual_depreciation NUMERIC;
    monthly_depreciation NUMERIC;
    total_depreciation NUMERIC;
BEGIN
    IF p_useful_life_years <= 0 THEN
        RETURN 0;
    END IF;

    annual_depreciation := (p_purchase_price - COALESCE(p_salvage_value, 0)) / p_useful_life_years;
    monthly_depreciation := annual_depreciation / 12;
    total_depreciation := monthly_depreciation * p_months_elapsed;

    RETURN LEAST(total_depreciation, p_purchase_price - COALESCE(p_salvage_value, 0));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update asset after maintenance
CREATE OR REPLACE FUNCTION update_asset_after_maintenance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'Completed' AND OLD.status != 'Completed' THEN
        UPDATE assets
        SET
            last_maintenance_date = NEW.completion_date,
            modified_date = CURRENT_TIMESTAMP
        WHERE asset_id = NEW.asset_id;

        -- Update schedule if linked
        IF NEW.schedule_id IS NOT NULL THEN
            UPDATE maintenance_schedules
            SET
                times_performed = times_performed + 1,
                last_performed_date = NEW.completion_date,
                modified_date = CURRENT_TIMESTAMP
            WHERE schedule_id = NEW.schedule_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER maintenance_record_completion_trigger
AFTER UPDATE ON maintenance_records
FOR EACH ROW
EXECUTE FUNCTION update_asset_after_maintenance();

-- Function to update asset after transfer
CREATE OR REPLACE FUNCTION update_asset_after_transfer()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'Completed' AND OLD.status != 'Completed' THEN
        UPDATE assets
        SET
            account_id = NEW.to_account_id,
            current_location = NEW.to_location,
            condition = COALESCE(NEW.condition_after, condition),
            modified_date = CURRENT_TIMESTAMP
        WHERE asset_id = NEW.asset_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER asset_transfer_completion_trigger
AFTER UPDATE ON asset_transfers
FOR EACH ROW
EXECUTE FUNCTION update_asset_after_transfer();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE assets IS 'Asset tracking with lifecycle management';
COMMENT ON TABLE maintenance_schedules IS 'Preventive maintenance scheduling';
COMMENT ON TABLE maintenance_records IS 'Maintenance work orders and history';
COMMENT ON TABLE asset_transfers IS 'Asset movement and transfer history';
COMMENT ON TABLE asset_depreciation IS 'Depreciation calculations and history';

COMMENT ON COLUMN assets.status IS 'Asset status: Available, In Use, Under Maintenance, Reserved, Out of Service, Retired, Disposed, Lost, Stolen';
COMMENT ON COLUMN assets.depreciation_method IS 'Depreciation method: Straight Line, Declining Balance, Double Declining Balance, Units of Production, Sum of Years Digits';
