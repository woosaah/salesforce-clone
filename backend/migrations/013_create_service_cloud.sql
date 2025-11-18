-- Migration: Create Service Cloud Module
-- Description: Case management, knowledge base, SLAs, and customer service

-- ============================================================================
-- CASES TABLE
-- ============================================================================
CREATE TABLE cases (
    case_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    record_type_id UUID REFERENCES record_types(record_type_id),

    -- Case Information
    case_number VARCHAR(100) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT,

    -- Classification
    status VARCHAR(50) NOT NULL DEFAULT 'New',
    priority VARCHAR(50) NOT NULL DEFAULT 'Medium',
    origin VARCHAR(50),
    type VARCHAR(100),
    reason VARCHAR(100),

    -- Relationships
    account_id UUID REFERENCES object_data(record_id),
    contact_id UUID REFERENCES object_data(record_id),
    asset_id UUID REFERENCES assets(asset_id),
    product_id UUID REFERENCES products(product_id),
    parent_case_id UUID REFERENCES cases(case_id),

    -- Resolution
    resolution TEXT,
    closed_date TIMESTAMP WITH TIME ZONE,
    closed_by UUID REFERENCES users(user_id),

    -- Status Flags
    is_escalated BOOLEAN DEFAULT false,
    is_closed BOOLEAN DEFAULT false,
    escalated_to UUID REFERENCES users(user_id),

    -- Ownership
    owner_id UUID NOT NULL REFERENCES users(user_id),
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_by UUID NOT NULL REFERENCES users(user_id),
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, case_number),
    CONSTRAINT case_status_valid CHECK (status IN (
        'New', 'Working', 'Escalated', 'On Hold', 'Waiting on Customer', 'Closed'
    )),
    CONSTRAINT case_priority_valid CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    CONSTRAINT case_origin_valid CHECK (origin IN ('Phone', 'Email', 'Web', 'Chat', 'Social'))
);

-- ============================================================================
-- CASE COMMENTS TABLE
-- ============================================================================
CREATE TABLE case_comments (
    comment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,

    comment_body TEXT NOT NULL,
    is_published BOOLEAN DEFAULT false,

    created_by UUID NOT NULL REFERENCES users(user_id),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- CASE HISTORY TABLE
-- ============================================================================
CREATE TABLE case_history (
    history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,

    field_changed VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,

    changed_by UUID NOT NULL REFERENCES users(user_id),
    changed_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- KNOWLEDGE ARTICLES TABLE
-- ============================================================================
CREATE TABLE knowledge_articles (
    article_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    -- Article Information
    article_number VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    content TEXT,

    -- Classification
    article_type VARCHAR(100),
    category VARCHAR(100),
    keywords TEXT[],

    -- Publishing
    publish_status VARCHAR(50) NOT NULL DEFAULT 'Draft',
    is_visible_in_portal BOOLEAN DEFAULT false,
    version_number INTEGER DEFAULT 1,

    -- Metrics
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,

    -- Dates
    published_date TIMESTAMP WITH TIME ZONE,
    archived_date TIMESTAMP WITH TIME ZONE,

    -- Ownership
    owner_id UUID NOT NULL REFERENCES users(user_id),
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_by UUID NOT NULL REFERENCES users(user_id),
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, article_number),
    CONSTRAINT article_status_valid CHECK (publish_status IN ('Draft', 'Published', 'Archived'))
);

-- ============================================================================
-- SOLUTIONS TABLE
-- ============================================================================
CREATE TABLE solutions (
    solution_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    solution_name VARCHAR(255) NOT NULL,
    solution_note TEXT,
    category VARCHAR(100),
    is_published BOOLEAN DEFAULT false,
    is_reviewed BOOLEAN DEFAULT false,

    created_by UUID NOT NULL REFERENCES users(user_id),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- CASE SOLUTIONS TABLE (many-to-many)
-- ============================================================================
CREATE TABLE case_solutions (
    case_id UUID REFERENCES cases(case_id) ON DELETE CASCADE,
    solution_id UUID REFERENCES solutions(solution_id) ON DELETE CASCADE,
    added_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (case_id, solution_id)
);

-- ============================================================================
-- SLA POLICIES TABLE
-- ============================================================================
CREATE TABLE sla_policies (
    policy_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    policy_name VARCHAR(255) NOT NULL,
    object_name VARCHAR(100) DEFAULT 'Case',
    entry_criteria JSONB,

    first_response_time_minutes INTEGER,
    resolution_time_minutes INTEGER,
    is_active BOOLEAN DEFAULT true,

    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, policy_name)
);

-- ============================================================================
-- CASE MILESTONES TABLE
-- ============================================================================
CREATE TABLE case_milestones (
    milestone_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES sla_policies(policy_id),

    milestone_type VARCHAR(50) NOT NULL,
    target_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_datetime TIMESTAMP WITH TIME ZONE,
    is_completed BOOLEAN DEFAULT false,
    is_violated BOOLEAN DEFAULT false,

    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT milestone_type_valid CHECK (milestone_type IN ('First_Response', 'Resolution'))
);

-- ============================================================================
-- ESCALATION RULES TABLE
-- ============================================================================
CREATE TABLE escalation_rules (
    rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    rule_name VARCHAR(255) NOT NULL,
    object_name VARCHAR(100) DEFAULT 'Case',
    entry_criteria JSONB,
    escalation_time_minutes INTEGER NOT NULL,
    escalation_actions JSONB,
    is_active BOOLEAN DEFAULT true,

    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, rule_name)
);

-- ============================================================================
-- SERVICE CONTRACTS TABLE
-- ============================================================================
CREATE TABLE service_contracts (
    contract_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    contract_number VARCHAR(100) NOT NULL,
    account_id UUID REFERENCES object_data(record_id),

    contract_type VARCHAR(100),
    start_date DATE NOT NULL,
    end_date DATE,

    -- Service Terms
    monthly_fee NUMERIC(12, 2),
    included_cases_per_month INTEGER,
    response_time_hours INTEGER,
    resolution_time_hours INTEGER,

    is_active BOOLEAN DEFAULT true,

    owner_id UUID NOT NULL REFERENCES users(user_id),
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, contract_number)
);

-- ============================================================================
-- QUEUES TABLE
-- ============================================================================
CREATE TABLE queues (
    queue_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    queue_name VARCHAR(255) NOT NULL,
    object_name VARCHAR(100) DEFAULT 'Case',
    description TEXT,
    email_address VARCHAR(255),

    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, queue_name)
);

-- ============================================================================
-- QUEUE MEMBERS TABLE
-- ============================================================================
CREATE TABLE queue_members (
    member_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    queue_id UUID NOT NULL REFERENCES queues(queue_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id),

    added_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(queue_id, user_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Cases indexes
CREATE INDEX idx_cases_tenant_id ON cases(tenant_id);
CREATE INDEX idx_cases_account_id ON cases(account_id);
CREATE INDEX idx_cases_contact_id ON cases(contact_id);
CREATE INDEX idx_cases_owner_id ON cases(owner_id);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_priority ON cases(priority);
CREATE INDEX idx_cases_is_closed ON cases(is_closed);
CREATE INDEX idx_cases_case_number ON cases(tenant_id, case_number);
CREATE INDEX idx_cases_created_date ON cases(created_date DESC);

-- Case comments indexes
CREATE INDEX idx_case_comments_case_id ON case_comments(case_id);
CREATE INDEX idx_case_comments_created_date ON case_comments(created_date DESC);

-- Case history indexes
CREATE INDEX idx_case_history_case_id ON case_history(case_id);

-- Knowledge articles indexes
CREATE INDEX idx_knowledge_tenant_id ON knowledge_articles(tenant_id);
CREATE INDEX idx_knowledge_status ON knowledge_articles(publish_status);
CREATE INDEX idx_knowledge_visible ON knowledge_articles(is_visible_in_portal);
CREATE INDEX idx_knowledge_category ON knowledge_articles(category);

-- Full-text search on articles
CREATE INDEX idx_knowledge_search ON knowledge_articles USING GIN (
    to_tsvector('english', title || ' ' || COALESCE(summary, '') || ' ' || COALESCE(content, ''))
);

-- Solutions indexes
CREATE INDEX idx_solutions_tenant ON solutions(tenant_id);

-- SLA policies indexes
CREATE INDEX idx_sla_policies_tenant ON sla_policies(tenant_id);
CREATE INDEX idx_sla_policies_active ON sla_policies(is_active);

-- Case milestones indexes
CREATE INDEX idx_milestones_case ON case_milestones(case_id);
CREATE INDEX idx_milestones_policy ON case_milestones(policy_id);
CREATE INDEX idx_milestones_target ON case_milestones(target_datetime);
CREATE INDEX idx_milestones_violated ON case_milestones(is_violated) WHERE is_violated = true;

-- Escalation rules indexes
CREATE INDEX idx_escalation_rules_tenant ON escalation_rules(tenant_id);
CREATE INDEX idx_escalation_rules_active ON escalation_rules(is_active);

-- Service contracts indexes
CREATE INDEX idx_service_contracts_tenant ON service_contracts(tenant_id);
CREATE INDEX idx_service_contracts_account ON service_contracts(account_id);

-- Queues indexes
CREATE INDEX idx_queues_tenant ON queues(tenant_id);

-- Queue members indexes
CREATE INDEX idx_queue_members_queue ON queue_members(queue_id);
CREATE INDEX idx_queue_members_user ON queue_members(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE solutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;

CREATE POLICY cases_isolation_policy ON cases
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY case_comments_isolation_policy ON case_comments
    FOR ALL
    USING (
        case_id IN (
            SELECT case_id FROM cases
            WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
    );

CREATE POLICY knowledge_articles_isolation_policy ON knowledge_articles
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY solutions_isolation_policy ON solutions
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY sla_policies_isolation_policy ON sla_policies
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY escalation_rules_isolation_policy ON escalation_rules
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY service_contracts_isolation_policy ON service_contracts
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY queues_isolation_policy ON queues
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to track case field changes
CREATE OR REPLACE FUNCTION track_case_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Track status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO case_history (case_id, field_changed, old_value, new_value, changed_by)
        VALUES (NEW.case_id, 'status', OLD.status, NEW.status, NEW.modified_by);
    END IF;

    -- Track priority changes
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
        INSERT INTO case_history (case_id, field_changed, old_value, new_value, changed_by)
        VALUES (NEW.case_id, 'priority', OLD.priority, NEW.priority, NEW.modified_by);
    END IF;

    -- Track owner changes
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
        INSERT INTO case_history (case_id, field_changed, old_value, new_value, changed_by)
        VALUES (NEW.case_id, 'owner_id', OLD.owner_id::TEXT, NEW.owner_id::TEXT, NEW.modified_by);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER case_changes_trigger
AFTER UPDATE ON cases
FOR EACH ROW
EXECUTE FUNCTION track_case_changes();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE cases IS 'Customer service cases and support tickets';
COMMENT ON TABLE case_comments IS 'Comments and interactions on cases';
COMMENT ON TABLE case_history IS 'Audit trail of case field changes';
COMMENT ON TABLE knowledge_articles IS 'Knowledge base articles';
COMMENT ON TABLE solutions IS 'Reusable solutions for common issues';
COMMENT ON TABLE sla_policies IS 'Service level agreement policies';
COMMENT ON TABLE case_milestones IS 'SLA milestone tracking for cases';
COMMENT ON TABLE escalation_rules IS 'Automated escalation rules';
COMMENT ON TABLE service_contracts IS 'Customer service contracts';
COMMENT ON TABLE queues IS 'Work queues for case assignment';

COMMENT ON COLUMN cases.status IS 'Case status: New, Working, Escalated, On Hold, Waiting on Customer, Closed';
COMMENT ON COLUMN cases.priority IS 'Case priority: Low, Medium, High, Critical';
COMMENT ON COLUMN knowledge_articles.publish_status IS 'Article status: Draft, Published, Archived';
