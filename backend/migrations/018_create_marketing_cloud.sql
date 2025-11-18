-- Migration 018: Marketing Cloud Lite Module
-- Create campaign management and email marketing system

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CAMPAIGNS
-- ============================================================================

-- Main campaigns table
CREATE TABLE campaigns (
  campaign_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  campaign_name VARCHAR(255) NOT NULL,
  campaign_type VARCHAR(50) DEFAULT 'Email' CHECK (campaign_type IN ('Email', 'Event', 'Webinar', 'Conference', 'Direct Mail', 'Other')),
  status VARCHAR(50) DEFAULT 'Planned' CHECK (status IN ('Planned', 'In Progress', 'Completed', 'Aborted')),
  start_date DATE,
  end_date DATE,
  budgeted_cost DECIMAL(15, 2) DEFAULT 0,
  actual_cost DECIMAL(15, 2) DEFAULT 0,
  expected_revenue DECIMAL(15, 2) DEFAULT 0,
  actual_revenue DECIMAL(15, 2) DEFAULT 0,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES users(user_id),
  created_by UUID NOT NULL REFERENCES users(user_id),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_by UUID NOT NULL REFERENCES users(user_id),
  modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- CAMPAIGN MEMBERS
-- ============================================================================

-- Campaign members table (leads/contacts in campaign)
CREATE TABLE campaign_members (
  member_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
  lead_id UUID, -- reference to object_data
  contact_id UUID, -- reference to object_data
  status VARCHAR(50) DEFAULT 'Sent' CHECK (status IN ('Sent', 'Responded', 'Converted', 'Bounced', 'Unsubscribed')),
  first_responded_date TIMESTAMP,
  has_responded BOOLEAN DEFAULT false,
  notes TEXT,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (lead_id IS NOT NULL OR contact_id IS NOT NULL)
);

-- ============================================================================
-- EMAIL CAMPAIGNS
-- ============================================================================

-- Email campaigns table
CREATE TABLE email_campaigns (
  email_campaign_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
  template_id UUID REFERENCES email_templates(template_id),
  subject VARCHAR(500) NOT NULL,
  from_name VARCHAR(255) NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  reply_to_email VARCHAR(255),
  scheduled_date TIMESTAMP,
  sent_date TIMESTAMP,
  status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Scheduled', 'Sending', 'Sent', 'Cancelled')),
  recipients JSONB, -- array of email addresses or selection criteria
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(user_id),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_by UUID NOT NULL REFERENCES users(user_id),
  modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- EMAIL ANALYTICS
-- ============================================================================

-- Email analytics table (tracking opens, clicks, etc.)
CREATE TABLE email_analytics (
  analytics_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  email_campaign_id UUID NOT NULL REFERENCES email_campaigns(email_campaign_id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_type VARCHAR(50), -- 'Lead', 'Contact'
  recipient_id UUID, -- ID of lead or contact
  sent BOOLEAN DEFAULT false,
  sent_date TIMESTAMP,
  delivered BOOLEAN DEFAULT false,
  delivered_date TIMESTAMP,
  opened BOOLEAN DEFAULT false,
  opened_date TIMESTAMP,
  open_count INTEGER DEFAULT 0,
  clicked BOOLEAN DEFAULT false,
  clicked_date TIMESTAMP,
  click_count INTEGER DEFAULT 0,
  bounced BOOLEAN DEFAULT false,
  bounce_reason TEXT,
  unsubscribed BOOLEAN DEFAULT false,
  unsubscribed_date TIMESTAMP,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- EMAIL TRACKING LINKS
-- ============================================================================

-- Email tracking links table
CREATE TABLE email_tracking_links (
  link_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_campaign_id UUID NOT NULL REFERENCES email_campaigns(email_campaign_id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  tracking_token VARCHAR(100) UNIQUE NOT NULL,
  click_count INTEGER DEFAULT 0,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- UNSUBSCRIBE LIST
-- ============================================================================

-- Global unsubscribe list
CREATE TABLE unsubscribe_list (
  unsubscribe_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  unsubscribed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  UNIQUE(tenant_id, email)
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update campaign member status when they respond
CREATE OR REPLACE FUNCTION update_campaign_member_response()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.opened = true AND OLD.opened = false AND NOT NEW.has_responded THEN
    UPDATE campaign_members
    SET status = 'Responded',
        has_responded = true,
        first_responded_date = NEW.opened_date
    WHERE campaign_id = (
      SELECT campaign_id FROM email_campaigns WHERE email_campaign_id = NEW.email_campaign_id
    )
    AND (
      (lead_id = NEW.recipient_id AND NEW.recipient_type = 'Lead')
      OR (contact_id = NEW.recipient_id AND NEW.recipient_type = 'Contact')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_campaign_member_response
AFTER UPDATE ON email_analytics
FOR EACH ROW
EXECUTE FUNCTION update_campaign_member_response();

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Campaigns indexes
CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX idx_campaigns_owner ON campaigns(owner_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_dates ON campaigns(start_date, end_date);

-- Campaign members indexes
CREATE INDEX idx_campaign_members_tenant ON campaign_members(tenant_id);
CREATE INDEX idx_campaign_members_campaign ON campaign_members(campaign_id);
CREATE INDEX idx_campaign_members_lead ON campaign_members(lead_id);
CREATE INDEX idx_campaign_members_contact ON campaign_members(contact_id);
CREATE INDEX idx_campaign_members_status ON campaign_members(status);

-- Email campaigns indexes
CREATE INDEX idx_email_campaigns_tenant ON email_campaigns(tenant_id);
CREATE INDEX idx_email_campaigns_campaign ON email_campaigns(campaign_id);
CREATE INDEX idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX idx_email_campaigns_scheduled ON email_campaigns(scheduled_date, status);

-- Email analytics indexes
CREATE INDEX idx_email_analytics_tenant ON email_analytics(tenant_id);
CREATE INDEX idx_email_analytics_campaign ON email_analytics(email_campaign_id);
CREATE INDEX idx_email_analytics_recipient ON email_analytics(recipient_email);
CREATE INDEX idx_email_analytics_opened ON email_analytics(opened, opened_date);
CREATE INDEX idx_email_analytics_clicked ON email_analytics(clicked, clicked_date);

-- Email tracking links indexes
CREATE INDEX idx_email_tracking_links_campaign ON email_tracking_links(email_campaign_id);
CREATE INDEX idx_email_tracking_links_token ON email_tracking_links(tracking_token);

-- Unsubscribe list indexes
CREATE INDEX idx_unsubscribe_list_tenant ON unsubscribe_list(tenant_id);
CREATE INDEX idx_unsubscribe_list_email ON unsubscribe_list(email);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_tracking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE unsubscribe_list ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY campaigns_tenant_isolation ON campaigns
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY campaign_members_tenant_isolation ON campaign_members
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY email_campaigns_tenant_isolation ON email_campaigns
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY email_analytics_tenant_isolation ON email_analytics
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY email_tracking_links_tenant_isolation ON email_tracking_links
  USING (email_campaign_id IN (SELECT email_campaign_id FROM email_campaigns WHERE tenant_id::text = current_setting('app.current_tenant_id', true)));

CREATE POLICY unsubscribe_list_tenant_isolation ON unsubscribe_list
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON campaigns TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON campaign_members TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON email_campaigns TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON email_analytics TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON email_tracking_links TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON unsubscribe_list TO postgres;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE campaigns IS 'Marketing campaigns for tracking ROI and engagement';
COMMENT ON TABLE campaign_members IS 'Leads and contacts associated with campaigns';
COMMENT ON TABLE email_campaigns IS 'Email blasts sent as part of campaigns';
COMMENT ON TABLE email_analytics IS 'Email engagement tracking (opens, clicks, bounces)';
COMMENT ON TABLE email_tracking_links IS 'Trackable links embedded in emails';
COMMENT ON TABLE unsubscribe_list IS 'Global opt-out list for email marketing';
