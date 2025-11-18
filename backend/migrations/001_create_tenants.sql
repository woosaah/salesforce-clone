-- Migration: Create tenants and tenant_settings tables
-- Description: Multi-tenancy foundation tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tenants table
CREATE TABLE tenants (
    tenant_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) NOT NULL UNIQUE,
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'free',
    enabled_modules JSONB DEFAULT '[]'::jsonb,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT tenant_name_not_empty CHECK (tenant_name <> ''),
    CONSTRAINT subdomain_not_empty CHECK (subdomain <> '')
);

-- Create tenant_settings table
CREATE TABLE tenant_settings (
    setting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    setting_key VARCHAR(255) NOT NULL,
    setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, setting_key)
);

-- Create indexes for tenants
CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_is_active ON tenants(is_active);

-- Create indexes for tenant_settings
CREATE INDEX idx_tenant_settings_tenant_id ON tenant_settings(tenant_id);
CREATE INDEX idx_tenant_settings_key ON tenant_settings(setting_key);

-- Enable Row Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own tenant
CREATE POLICY tenant_isolation_policy ON tenants
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- RLS Policy: Users can only see settings for their tenant
CREATE POLICY tenant_settings_isolation_policy ON tenant_settings
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Comment on tables
COMMENT ON TABLE tenants IS 'Multi-tenant organizations';
COMMENT ON TABLE tenant_settings IS 'Tenant-specific configuration settings';
