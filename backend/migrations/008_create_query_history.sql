-- Migration: Create query_history table
-- Description: Log all SOQL queries for auditing and history

CREATE TABLE query_history (
    query_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    soql_query TEXT NOT NULL,
    translated_sql TEXT NOT NULL,
    object_name VARCHAR(255),
    execution_time_ms INTEGER,
    row_count INTEGER,
    status VARCHAR(50) NOT NULL DEFAULT 'success',
    error_message TEXT,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT status_valid CHECK (status IN ('success', 'error'))
);

-- Create indexes
CREATE INDEX idx_query_history_tenant_id ON query_history(tenant_id);
CREATE INDEX idx_query_history_user_id ON query_history(user_id);
CREATE INDEX idx_query_history_object_name ON query_history(object_name);
CREATE INDEX idx_query_history_created_date ON query_history(created_date DESC);
CREATE INDEX idx_query_history_status ON query_history(status);

-- Enable Row Level Security
ALTER TABLE query_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see queries for their tenant
CREATE POLICY query_history_isolation_policy ON query_history
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Comment on table
COMMENT ON TABLE query_history IS 'Audit log of all SOQL queries executed';
COMMENT ON COLUMN query_history.soql_query IS 'Original SOQL query';
COMMENT ON COLUMN query_history.translated_sql IS 'Translated PostgreSQL query';
COMMENT ON COLUMN query_history.execution_time_ms IS 'Query execution time in milliseconds';
COMMENT ON COLUMN query_history.row_count IS 'Number of rows returned';
