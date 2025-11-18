-- ============================================================================
-- Migration: All Remaining Features (Phases 29-55)
-- ============================================================================

-- Phase 29: Communities/Customer Portal
CREATE TABLE IF NOT EXISTS communities (
  community_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  community_name VARCHAR(255),
  url_prefix VARCHAR(100),
  template VARCHAR(100),
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS community_members (
  member_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID REFERENCES communities(community_id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(user_id),
  role VARCHAR(50)
);

-- Phase 30: Mobile Settings
CREATE TABLE IF NOT EXISTS mobile_settings (
  setting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  enabled_objects JSONB DEFAULT '[]'::jsonb,
  compact_layouts JSONB DEFAULT '{}'::jsonb,
  offline_objects JSONB DEFAULT '[]'::jsonb
);

-- Phase 31: Global Search Index
CREATE TABLE IF NOT EXISTS search_index (
  index_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  record_id UUID NOT NULL,
  object_name VARCHAR(100),
  searchable_text TSVECTOR,
  last_indexed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recent_searches (
  search_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(user_id),
  search_term TEXT,
  searched_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Phase 32: Recently Viewed
CREATE TABLE IF NOT EXISTS recently_viewed (
  view_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id),
  record_id UUID NOT NULL,
  object_name VARCHAR(100),
  viewed_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Phase 33: Knowledge Base Enhanced
CREATE TABLE IF NOT EXISTS knowledge_articles (
  article_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  title VARCHAR(500),
  body TEXT,
  category_id UUID,
  status VARCHAR(50) DEFAULT 'Draft',
  views INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(user_id),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS article_votes (
  vote_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID REFERENCES knowledge_articles(article_id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(user_id),
  helpful BOOLEAN,
  voted_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Phase 34: Files & Attachments Enhanced
CREATE TABLE IF NOT EXISTS files (
  file_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  file_name VARCHAR(500),
  content_type VARCHAR(100),
  size_bytes BIGINT,
  storage_url TEXT,
  uploaded_by UUID REFERENCES users(user_id),
  uploaded_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS content_versions (
  version_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID REFERENCES files(file_id) ON DELETE CASCADE,
  version_number INTEGER DEFAULT 1,
  is_latest BOOLEAN DEFAULT true,
  storage_url TEXT
);

CREATE TABLE IF NOT EXISTS file_shares (
  share_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID REFERENCES files(file_id) ON DELETE CASCADE,
  shared_with_user_id UUID REFERENCES users(user_id)
);

-- Phase 35: List Views & Filters
CREATE TABLE IF NOT EXISTS list_views (
  view_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  object_name VARCHAR(100),
  view_name VARCHAR(255),
  filters JSONB DEFAULT '[]'::jsonb,
  columns JSONB DEFAULT '[]'::jsonb,
  sort_by JSONB,
  is_public BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(user_id)
);

-- Phase 36: Calendar & Events
CREATE TABLE IF NOT EXISTS events (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  subject VARCHAR(500),
  start_datetime TIMESTAMP WITH TIME ZONE,
  end_datetime TIMESTAMP WITH TIME ZONE,
  location VARCHAR(500),
  is_all_day BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS event_invitees (
  invitee_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(event_id) ON DELETE CASCADE,
  invitee_user_id UUID REFERENCES users(user_id),
  response VARCHAR(50) DEFAULT 'Pending'
);

-- Phase 37: Notes
CREATE TABLE IF NOT EXISTS notes (
  note_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  parent_id UUID,
  title VARCHAR(500),
  body TEXT,
  is_private BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(user_id),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Phase 38: Tags
CREATE TABLE IF NOT EXISTS tags (
  tag_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  tag_name VARCHAR(100),
  color VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS record_tags (
  record_tag_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id UUID NOT NULL,
  tag_id UUID REFERENCES tags(tag_id) ON DELETE CASCADE
);

-- Phase 39: Forecasting
CREATE TABLE IF NOT EXISTS forecasts (
  forecast_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(user_id),
  period VARCHAR(50),
  quota DECIMAL(15,2),
  committed DECIMAL(15,2),
  best_case DECIMAL(15,2)
);

CREATE TABLE IF NOT EXISTS forecast_items (
  item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  forecast_id UUID REFERENCES forecasts(forecast_id) ON DELETE CASCADE,
  opportunity_id UUID,
  amount DECIMAL(15,2),
  category VARCHAR(50)
);

-- Phase 40: Recycle Bin (already handled with is_deleted flag)
-- No additional tables needed

-- Phase 41: Data Import (already handled with data_loader_jobs)
-- No additional tables needed

-- Phase 42: Email Alerts Enhanced (already in workflows)
-- No additional tables needed

-- Phase 43: Approval Processes Enhanced (already exists)
-- No additional tables needed

-- Phase 44: Schema Builder (visual, no DB changes)
-- No additional tables needed

-- Phase 45: Translation Workbench
CREATE TABLE IF NOT EXISTS translations (
  translation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  language VARCHAR(10),
  label VARCHAR(255),
  translated_text TEXT
);

-- Phase 46: Big Objects (Archive)
CREATE TABLE IF NOT EXISTS big_object_data (
  big_object_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  object_name VARCHAR(100),
  data JSONB,
  archive_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (archive_date);

-- Phase 47: Lightning Pages
CREATE TABLE IF NOT EXISTS lightning_pages (
  page_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  page_name VARCHAR(255),
  page_type VARCHAR(50),
  layout JSONB DEFAULT '{}'::jsonb
);

-- Phase 48: Topics & Recommendations
CREATE TABLE IF NOT EXISTS topics (
  topic_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  topic_name VARCHAR(255),
  topic_type VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS topic_assignments (
  assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID REFERENCES topics(topic_id) ON DELETE CASCADE,
  record_id UUID
);

CREATE TABLE IF NOT EXISTS recommendations (
  recommendation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(user_id),
  record_id UUID,
  reason TEXT,
  score FLOAT
);

-- Phase 49: Path (Visual Guidance)
CREATE TABLE IF NOT EXISTS paths (
  path_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  object_id UUID,
  picklist_field VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS path_steps (
  step_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  path_id UUID REFERENCES paths(path_id) ON DELETE CASCADE,
  picklist_value VARCHAR(255),
  key_fields JSONB,
  guidance TEXT
);

-- Phase 50: Service Console (UI only, no DB)
-- No additional tables needed

-- Phase 51: Live Agent / Chat
CREATE TABLE IF NOT EXISTS chat_sessions (
  session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  visitor_name VARCHAR(255),
  agent_id UUID REFERENCES users(user_id),
  status VARCHAR(50) DEFAULT 'Active',
  started_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
  message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
  sender_type VARCHAR(50),
  message_text TEXT,
  sent_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Phase 52: Omni-Channel Routing
CREATE TABLE IF NOT EXISTS service_channels (
  channel_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  channel_name VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS routing_configs (
  config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID REFERENCES service_channels(channel_id) ON DELETE CASCADE,
  routing_priority INTEGER,
  capacity INTEGER
);

CREATE TABLE IF NOT EXISTS agent_work (
  work_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES users(user_id),
  work_item_id UUID,
  status VARCHAR(50) DEFAULT 'Assigned'
);

-- Phase 53: Macros
CREATE TABLE IF NOT EXISTS macros (
  macro_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  macro_name VARCHAR(255),
  steps JSONB DEFAULT '[]'::jsonb
);

-- Phase 54: Topics for Objects (already covered in Phase 48)
-- No additional tables needed

-- Phase 55: Einstein Activity Capture
CREATE TABLE IF NOT EXISTS external_activities (
  activity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  external_id VARCHAR(255),
  source VARCHAR(50),
  synced_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for all new tables
CREATE INDEX idx_communities_tenant ON communities(tenant_id);
CREATE INDEX idx_search_index_tenant ON search_index(tenant_id);
CREATE INDEX idx_search_index_text ON search_index USING gin(searchable_text);
CREATE INDEX idx_recently_viewed_user ON recently_viewed(user_id);
CREATE INDEX idx_knowledge_articles_tenant ON knowledge_articles(tenant_id);
CREATE INDEX idx_files_tenant ON files(tenant_id);
CREATE INDEX idx_list_views_tenant ON list_views(tenant_id);
CREATE INDEX idx_events_tenant ON events(tenant_id);
CREATE INDEX idx_notes_tenant ON notes(tenant_id);
CREATE INDEX idx_tags_tenant ON tags(tenant_id);
CREATE INDEX idx_forecasts_tenant ON forecasts(tenant_id);
CREATE INDEX idx_translations_tenant ON translations(tenant_id);
CREATE INDEX idx_lightning_pages_tenant ON lightning_pages(tenant_id);
CREATE INDEX idx_topics_tenant ON topics(tenant_id);
CREATE INDEX idx_paths_tenant ON paths(tenant_id);
CREATE INDEX idx_chat_sessions_tenant ON chat_sessions(tenant_id);
CREATE INDEX idx_service_channels_tenant ON service_channels(tenant_id);
CREATE INDEX idx_macros_tenant ON macros(tenant_id);
CREATE INDEX idx_external_activities_tenant ON external_activities(tenant_id);

-- Enable RLS on all new tables
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobile_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE recently_viewed ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE big_object_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE lightning_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE macros ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (all follow same pattern)
CREATE POLICY communities_tenant_isolation ON communities
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY mobile_settings_tenant_isolation ON mobile_settings
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY search_index_tenant_isolation ON search_index
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY knowledge_articles_tenant_isolation ON knowledge_articles
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY files_tenant_isolation ON files
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY list_views_tenant_isolation ON list_views
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY events_tenant_isolation ON events
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY notes_tenant_isolation ON notes
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY tags_tenant_isolation ON tags
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY forecasts_tenant_isolation ON forecasts
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY translations_tenant_isolation ON translations
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY big_object_data_tenant_isolation ON big_object_data
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY lightning_pages_tenant_isolation ON lightning_pages
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY topics_tenant_isolation ON topics
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY paths_tenant_isolation ON paths
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY chat_sessions_tenant_isolation ON chat_sessions
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY service_channels_tenant_isolation ON service_channels
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY macros_tenant_isolation ON macros
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY external_activities_tenant_isolation ON external_activities
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true));

COMMENT ON TABLE communities IS 'Customer portals and communities';
COMMENT ON TABLE search_index IS 'Full-text search index across all objects';
COMMENT ON TABLE knowledge_articles IS 'Enhanced knowledge base articles';
COMMENT ON TABLE files IS 'File storage with versioning';
COMMENT ON TABLE list_views IS 'Custom list views with filters';
COMMENT ON TABLE events IS 'Calendar events and meetings';
COMMENT ON TABLE forecasts IS 'Sales forecasting';
COMMENT ON TABLE chat_sessions IS 'Live agent chat sessions';
COMMENT ON TABLE macros IS 'Quick action macros';
