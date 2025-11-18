-- Migration: Create permissions tables
-- Description: Object and field level permissions for profiles

-- Create object_permissions table
CREATE TABLE object_permissions (
    permission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(profile_id) ON DELETE CASCADE,
    object_name VARCHAR(255) NOT NULL,
    can_read BOOLEAN DEFAULT false,
    can_create BOOLEAN DEFAULT false,
    can_edit BOOLEAN DEFAULT false,
    can_delete BOOLEAN DEFAULT false,
    can_view_all BOOLEAN DEFAULT false,
    can_modify_all BOOLEAN DEFAULT false,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, profile_id, object_name),
    CONSTRAINT object_name_not_empty CHECK (object_name <> '')
);

-- Create field_permissions table
CREATE TABLE field_permissions (
    permission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(profile_id) ON DELETE CASCADE,
    object_name VARCHAR(255) NOT NULL,
    field_name VARCHAR(255) NOT NULL,
    can_read BOOLEAN DEFAULT false,
    can_edit BOOLEAN DEFAULT false,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, profile_id, object_name, field_name),
    CONSTRAINT object_name_not_empty CHECK (object_name <> ''),
    CONSTRAINT field_name_not_empty CHECK (field_name <> '')
);

-- Create indexes for object_permissions
CREATE INDEX idx_object_permissions_tenant_id ON object_permissions(tenant_id);
CREATE INDEX idx_object_permissions_profile_id ON object_permissions(profile_id);
CREATE INDEX idx_object_permissions_object_name ON object_permissions(tenant_id, object_name);
CREATE INDEX idx_object_permissions_profile_object ON object_permissions(profile_id, object_name);

-- Create indexes for field_permissions
CREATE INDEX idx_field_permissions_tenant_id ON field_permissions(tenant_id);
CREATE INDEX idx_field_permissions_profile_id ON field_permissions(profile_id);
CREATE INDEX idx_field_permissions_object_name ON field_permissions(tenant_id, object_name);
CREATE INDEX idx_field_permissions_field_name ON field_permissions(tenant_id, object_name, field_name);
CREATE INDEX idx_field_permissions_profile_object_field ON field_permissions(profile_id, object_name, field_name);

-- Enable Row Level Security
ALTER TABLE object_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see permissions for their tenant
CREATE POLICY object_permissions_isolation_policy ON object_permissions
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY field_permissions_isolation_policy ON field_permissions
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Comment on tables
COMMENT ON TABLE object_permissions IS 'Object-level CRUD permissions for profiles';
COMMENT ON TABLE field_permissions IS 'Field-level read/edit permissions for profiles';
COMMENT ON COLUMN object_permissions.can_view_all IS 'Can view all records regardless of ownership';
COMMENT ON COLUMN object_permissions.can_modify_all IS 'Can modify all records regardless of ownership';
