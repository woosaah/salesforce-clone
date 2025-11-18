-- Migration: Create record_types tables
-- Description: Record types and field visibility configuration

-- Create record_types table
CREATE TABLE record_types (
    record_type_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    object_name VARCHAR(255) NOT NULL,
    record_type_name VARCHAR(255) NOT NULL,
    developer_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    is_master BOOLEAN DEFAULT false,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, object_name, record_type_name),
    UNIQUE(tenant_id, object_name, developer_name),
    CONSTRAINT record_type_name_not_empty CHECK (record_type_name <> ''),
    CONSTRAINT developer_name_not_empty CHECK (developer_name <> ''),
    CONSTRAINT object_name_not_empty CHECK (object_name <> '')
);

-- Create record_type_field_visibility table
CREATE TABLE record_type_field_visibility (
    visibility_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_type_id UUID NOT NULL REFERENCES record_types(record_type_id) ON DELETE CASCADE,
    field_name VARCHAR(255) NOT NULL,
    is_visible BOOLEAN DEFAULT true,
    is_required BOOLEAN DEFAULT false,
    is_read_only BOOLEAN DEFAULT false,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(record_type_id, field_name),
    CONSTRAINT field_name_not_empty CHECK (field_name <> '')
);

-- Create indexes for record_types
CREATE INDEX idx_record_types_tenant_id ON record_types(tenant_id);
CREATE INDEX idx_record_types_object_name ON record_types(tenant_id, object_name);
CREATE INDEX idx_record_types_developer_name ON record_types(tenant_id, developer_name);
CREATE INDEX idx_record_types_is_active ON record_types(is_active);
CREATE INDEX idx_record_types_is_default ON record_types(tenant_id, object_name, is_default) WHERE is_default = true;
CREATE INDEX idx_record_types_is_master ON record_types(is_master) WHERE is_master = true;

-- Create indexes for record_type_field_visibility
CREATE INDEX idx_rt_field_visibility_record_type_id ON record_type_field_visibility(record_type_id);
CREATE INDEX idx_rt_field_visibility_field_name ON record_type_field_visibility(field_name);

-- Enable Row Level Security
ALTER TABLE record_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_type_field_visibility ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see record types for their tenant
CREATE POLICY record_types_isolation_policy ON record_types
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- RLS Policy: Users can only see field visibility through their tenant's record types
CREATE POLICY record_type_field_visibility_isolation_policy ON record_type_field_visibility
    FOR ALL
    USING (
        record_type_id IN (
            SELECT record_type_id FROM record_types
            WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
    );

-- Comment on tables
COMMENT ON TABLE record_types IS 'Record type definitions for objects';
COMMENT ON TABLE record_type_field_visibility IS 'Field visibility, requirement, and read-only settings per record type';
COMMENT ON COLUMN record_types.is_master IS 'Master record type includes all fields and is always active';
COMMENT ON COLUMN record_types.is_default IS 'Default record type for new records';
COMMENT ON COLUMN record_types.developer_name IS 'API name for the record type';
