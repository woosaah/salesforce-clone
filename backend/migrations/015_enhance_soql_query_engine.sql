-- Migration 015: Enhanced SOQL Query Engine
-- Extend query capabilities with saved queries and favorites

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SAVED QUERIES
-- ============================================================================

-- Saved queries table
CREATE TABLE saved_queries (
  saved_query_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  query_name VARCHAR(255) NOT NULL,
  description TEXT,
  soql_query TEXT NOT NULL,
  object_name VARCHAR(255),
  is_public BOOLEAN DEFAULT false, -- shared with all users
  created_by UUID NOT NULL REFERENCES users(user_id),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_by UUID NOT NULL REFERENCES users(user_id),
  modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Query favorites table
CREATE TABLE query_favorites (
  favorite_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  saved_query_id UUID NOT NULL REFERENCES saved_queries(saved_query_id) ON DELETE CASCADE,
  added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, saved_query_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Saved queries indexes
CREATE INDEX idx_saved_queries_tenant ON saved_queries(tenant_id);
CREATE INDEX idx_saved_queries_created_by ON saved_queries(created_by);
CREATE INDEX idx_saved_queries_object ON saved_queries(object_name);
CREATE INDEX idx_saved_queries_public ON saved_queries(is_public);

-- Query favorites indexes
CREATE INDEX idx_query_favorites_user ON query_favorites(user_id);
CREATE INDEX idx_query_favorites_query ON query_favorites(saved_query_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE saved_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_favorites ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY saved_queries_tenant_isolation ON saved_queries
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY query_favorites_user_isolation ON query_favorites
  USING (user_id::text = current_setting('app.current_user_id', true));

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON saved_queries TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON query_favorites TO postgres;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get query execution statistics
CREATE OR REPLACE FUNCTION get_query_stats(p_saved_query_id UUID)
RETURNS TABLE (
  total_executions BIGINT,
  avg_execution_time_ms NUMERIC,
  last_executed TIMESTAMP,
  total_rows_returned BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_executions,
    AVG(execution_time_ms)::NUMERIC as avg_execution_time_ms,
    MAX(executed_at) as last_executed,
    SUM(rows_returned)::BIGINT as total_rows_returned
  FROM query_history qh
  JOIN saved_queries sq ON qh.soql_query = sq.soql_query
  WHERE sq.saved_query_id = p_saved_query_id;
END;
$$ LANGUAGE plpgsql;

-- Function to track query popularity
CREATE OR REPLACE FUNCTION get_popular_queries(p_tenant_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  saved_query_id UUID,
  query_name VARCHAR,
  execution_count BIGINT,
  favorite_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sq.saved_query_id,
    sq.query_name,
    COUNT(DISTINCT qh.query_id)::BIGINT as execution_count,
    COUNT(DISTINCT qf.favorite_id)::BIGINT as favorite_count
  FROM saved_queries sq
  LEFT JOIN query_history qh ON qh.soql_query = sq.soql_query
  LEFT JOIN query_favorites qf ON qf.saved_query_id = sq.saved_query_id
  WHERE sq.tenant_id = p_tenant_id
  GROUP BY sq.saved_query_id, sq.query_name
  ORDER BY execution_count DESC, favorite_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE saved_queries IS 'Stores saved SOQL queries that can be reused and shared';
COMMENT ON TABLE query_favorites IS 'Tracks which queries users have favorited';
COMMENT ON COLUMN saved_queries.is_public IS 'If true, query is visible to all users in tenant';
COMMENT ON COLUMN saved_queries.object_name IS 'Primary object being queried (for filtering/categorization)';
