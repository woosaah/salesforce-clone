-- Migration: Create objects metadata and data tables
-- Description: Custom objects, fields metadata, and generic data storage

-- Create objects_meta table
CREATE TABLE objects_meta (
    object_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    object_name VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    plural_label VARCHAR(255) NOT NULL,
    is_custom BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    created_by UUID,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, object_name),
    CONSTRAINT object_name_not_empty CHECK (object_name <> ''),
    CONSTRAINT label_not_empty CHECK (label <> ''),
    CONSTRAINT plural_label_not_empty CHECK (plural_label <> '')
);

-- Create fields_meta table
CREATE TABLE fields_meta (
    field_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    object_id UUID NOT NULL REFERENCES objects_meta(object_id) ON DELETE CASCADE,
    field_name VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    field_type VARCHAR(50) NOT NULL,
    is_required BOOLEAN DEFAULT false,
    is_unique BOOLEAN DEFAULT false,
    default_value TEXT,
    max_length INTEGER,
    min_value NUMERIC,
    max_value NUMERIC,
    picklist_values JSONB,
    lookup_object_id UUID REFERENCES objects_meta(object_id) ON DELETE SET NULL,
    description TEXT,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, object_id, field_name),
    CONSTRAINT field_name_not_empty CHECK (field_name <> ''),
    CONSTRAINT label_not_empty CHECK (label <> ''),
    CONSTRAINT field_type_valid CHECK (
        field_type IN (
            'text', 'textarea', 'email', 'phone', 'url',
            'number', 'currency', 'percent',
            'date', 'datetime', 'time',
            'checkbox', 'picklist', 'multipicklist',
            'lookup', 'master_detail',
            'formula', 'rollup_summary',
            'auto_number'
        )
    )
);

-- Create object_data table (generic storage for all records)
CREATE TABLE object_data (
    record_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    object_id UUID NOT NULL REFERENCES objects_meta(object_id) ON DELETE CASCADE,
    record_type_id UUID REFERENCES record_types(record_type_id) ON DELETE SET NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    owner_id UUID NOT NULL REFERENCES users(user_id),
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_by UUID NOT NULL REFERENCES users(user_id),
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT false
);

-- Create indexes for objects_meta
CREATE INDEX idx_objects_meta_tenant_id ON objects_meta(tenant_id);
CREATE INDEX idx_objects_meta_object_name ON objects_meta(tenant_id, object_name);
CREATE INDEX idx_objects_meta_is_active ON objects_meta(is_active);
CREATE INDEX idx_objects_meta_is_custom ON objects_meta(is_custom);

-- Create indexes for fields_meta
CREATE INDEX idx_fields_meta_tenant_id ON fields_meta(tenant_id);
CREATE INDEX idx_fields_meta_object_id ON fields_meta(object_id);
CREATE INDEX idx_fields_meta_field_name ON fields_meta(tenant_id, object_id, field_name);
CREATE INDEX idx_fields_meta_field_type ON fields_meta(field_type);
CREATE INDEX idx_fields_meta_lookup_object_id ON fields_meta(lookup_object_id) WHERE lookup_object_id IS NOT NULL;

-- Create indexes for object_data
CREATE INDEX idx_object_data_tenant_id ON object_data(tenant_id);
CREATE INDEX idx_object_data_object_id ON object_data(object_id);
CREATE INDEX idx_object_data_record_type_id ON object_data(record_type_id);
CREATE INDEX idx_object_data_owner_id ON object_data(owner_id);
CREATE INDEX idx_object_data_created_by ON object_data(created_by);
CREATE INDEX idx_object_data_modified_by ON object_data(modified_by);
CREATE INDEX idx_object_data_is_deleted ON object_data(is_deleted);
CREATE INDEX idx_object_data_created_date ON object_data(created_date);
CREATE INDEX idx_object_data_modified_date ON object_data(modified_date);

-- CRITICAL: GIN index on JSONB data column for efficient querying
CREATE INDEX idx_object_data_data_gin ON object_data USING GIN (data);
CREATE INDEX idx_object_data_tenant_object ON object_data(tenant_id, object_id);

-- Enable Row Level Security
ALTER TABLE objects_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE fields_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE object_data ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see objects for their tenant
CREATE POLICY objects_meta_isolation_policy ON objects_meta
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- RLS Policy: Users can only see fields for their tenant's objects
CREATE POLICY fields_meta_isolation_policy ON fields_meta
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- RLS Policy: Users can only see data for their tenant
CREATE POLICY object_data_isolation_policy ON object_data
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Add foreign key constraint for created_by in objects_meta (deferred)
ALTER TABLE objects_meta
    ADD CONSTRAINT fk_objects_meta_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL;

-- Comment on tables
COMMENT ON TABLE objects_meta IS 'Metadata definitions for custom and standard objects';
COMMENT ON TABLE fields_meta IS 'Field metadata definitions for objects';
COMMENT ON TABLE object_data IS 'Generic storage for all object records using JSONB';

COMMENT ON COLUMN fields_meta.field_type IS 'Field data type: text, number, date, picklist, lookup, etc.';
COMMENT ON COLUMN fields_meta.picklist_values IS 'JSON array of picklist options';
COMMENT ON COLUMN fields_meta.lookup_object_id IS 'Referenced object for lookup/master-detail fields';
COMMENT ON COLUMN object_data.data IS 'JSONB storage for all field values';
COMMENT ON COLUMN object_data.is_deleted IS 'Soft delete flag for recycle bin functionality';
