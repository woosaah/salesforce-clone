-- Migration: Create roles and profiles tables
-- Description: User roles hierarchy and permission profiles

-- Create roles table
CREATE TABLE roles (
    role_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    role_name VARCHAR(255) NOT NULL,
    parent_role_id UUID REFERENCES roles(role_id) ON DELETE SET NULL,
    description TEXT,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, role_name),
    CONSTRAINT role_name_not_empty CHECK (role_name <> '')
);

-- Create profiles table
CREATE TABLE profiles (
    profile_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    profile_name VARCHAR(255) NOT NULL,
    is_system BOOLEAN DEFAULT false,
    description TEXT,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, profile_name),
    CONSTRAINT profile_name_not_empty CHECK (profile_name <> '')
);

-- Create indexes for roles
CREATE INDEX idx_roles_tenant_id ON roles(tenant_id);
CREATE INDEX idx_roles_parent_role_id ON roles(parent_role_id);
CREATE INDEX idx_roles_role_name ON roles(tenant_id, role_name);

-- Create indexes for profiles
CREATE INDEX idx_profiles_tenant_id ON profiles(tenant_id);
CREATE INDEX idx_profiles_is_system ON profiles(is_system);
CREATE INDEX idx_profiles_profile_name ON profiles(tenant_id, profile_name);

-- Enable Row Level Security
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see roles for their tenant
CREATE POLICY roles_isolation_policy ON roles
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- RLS Policy: Users can only see profiles for their tenant
CREATE POLICY profiles_isolation_policy ON profiles
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Comment on tables
COMMENT ON TABLE roles IS 'User roles with hierarchical structure';
COMMENT ON TABLE profiles IS 'Permission profiles for users';
COMMENT ON COLUMN roles.parent_role_id IS 'Parent role for hierarchy (users inherit data access from parent roles)';
COMMENT ON COLUMN profiles.is_system IS 'System profiles cannot be deleted';
