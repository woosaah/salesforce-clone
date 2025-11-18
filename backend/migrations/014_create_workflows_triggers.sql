-- Migration 014: Workflows & Triggers Module
-- Create automation engine with workflows, triggers, and approval processes

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- WORKFLOWS
-- ============================================================================

-- Main workflows table
CREATE TABLE workflows (
  workflow_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  object_id UUID NOT NULL REFERENCES objects_meta(object_id) ON DELETE CASCADE,
  workflow_name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('on_create', 'on_update', 'on_create_or_update', 'time_based')),
  evaluation_criteria JSONB, -- when workflow should run
  is_active BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES users(user_id),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_by UUID NOT NULL REFERENCES users(user_id),
  modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workflow rules (conditions)
CREATE TABLE workflow_rules (
  rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  rule_order INTEGER NOT NULL DEFAULT 1,
  rule_name VARCHAR(255) NOT NULL,
  criteria JSONB NOT NULL, -- conditions that must be true
  criteria_logic VARCHAR(20) DEFAULT 'AND' CHECK (criteria_logic IN ('AND', 'OR', 'CUSTOM')),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workflow actions
CREATE TABLE workflow_actions (
  action_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID NOT NULL REFERENCES workflow_rules(rule_id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('field_update', 'email_alert', 'task_creation', 'webhook', 'custom_code', 'create_record', 'update_related')),
  action_config JSONB, -- action-specific configuration
  execution_order INTEGER NOT NULL DEFAULT 1,
  is_immediate BOOLEAN DEFAULT true, -- false = time-based
  time_offset_minutes INTEGER, -- for time-based actions
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Field update actions
CREATE TABLE workflow_field_updates (
  update_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_id UUID NOT NULL REFERENCES workflow_actions(action_id) ON DELETE CASCADE,
  field_name VARCHAR(255) NOT NULL,
  update_type VARCHAR(50) NOT NULL CHECK (update_type IN ('literal', 'formula', 'null', 'user_lookup')),
  update_value JSONB,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email alert actions
CREATE TABLE workflow_email_alerts (
  alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_id UUID NOT NULL REFERENCES workflow_actions(action_id) ON DELETE CASCADE,
  template_id UUID REFERENCES email_templates(template_id),
  recipient_type VARCHAR(50) NOT NULL CHECK (recipient_type IN ('user', 'contact', 'email', 'related_contact', 'owner')),
  recipients JSONB, -- array of recipient IDs or emails
  cc_recipients JSONB, -- array
  additional_emails TEXT[],
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task creation actions
CREATE TABLE workflow_task_templates (
  template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_id UUID NOT NULL REFERENCES workflow_actions(action_id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  assigned_to_type VARCHAR(50) NOT NULL CHECK (assigned_to_type IN ('user', 'queue', 'owner', 'creator')),
  assigned_to_value JSONB,
  priority VARCHAR(20) DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
  status VARCHAR(50) DEFAULT 'Not Started',
  due_date_offset_days INTEGER DEFAULT 0,
  description TEXT,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled workflow actions
CREATE TABLE workflow_schedules (
  schedule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  record_id UUID NOT NULL,
  action_id UUID NOT NULL REFERENCES workflow_actions(action_id) ON DELETE CASCADE,
  scheduled_time TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workflow execution logs
CREATE TABLE workflow_logs (
  log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  record_id UUID NOT NULL,
  execution_time_ms INTEGER,
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error', 'skipped')),
  error_message TEXT,
  actions_executed JSONB, -- array of action types executed
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Code triggers table
CREATE TABLE triggers (
  trigger_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  object_id UUID NOT NULL REFERENCES objects_meta(object_id) ON DELETE CASCADE,
  trigger_name VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('before_insert', 'after_insert', 'before_update', 'after_update', 'before_delete', 'after_delete', 'after_undelete')),
  code TEXT NOT NULL, -- TypeScript/JavaScript code
  is_active BOOLEAN DEFAULT false,
  execution_order INTEGER DEFAULT 1,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(user_id),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_by UUID NOT NULL REFERENCES users(user_id),
  modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger execution logs
CREATE TABLE trigger_logs (
  log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trigger_id UUID NOT NULL REFERENCES triggers(trigger_id) ON DELETE CASCADE,
  record_id UUID,
  execution_time_ms INTEGER,
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  error_stack_trace TEXT,
  records_affected INTEGER DEFAULT 0,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- APPROVAL PROCESSES
-- ============================================================================

-- Email templates (used by workflows and approvals)
CREATE TABLE IF NOT EXISTS email_templates (
  template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  template_name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body_html TEXT,
  body_text TEXT,
  is_active BOOLEAN DEFAULT true,
  template_type VARCHAR(50) DEFAULT 'Alert' CHECK (template_type IN ('Alert', 'Auto_Response', 'Workflow')),
  available_merge_fields JSONB, -- fields that can be used in template
  created_by UUID NOT NULL REFERENCES users(user_id),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_by UUID NOT NULL REFERENCES users(user_id),
  modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Approval processes
CREATE TABLE approval_processes (
  process_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  object_id UUID NOT NULL REFERENCES objects_meta(object_id) ON DELETE CASCADE,
  process_name VARCHAR(255) NOT NULL,
  description TEXT,
  entry_criteria JSONB, -- conditions for record to enter approval
  is_active BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES users(user_id),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_by UUID NOT NULL REFERENCES users(user_id),
  modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Approval steps
CREATE TABLE approval_steps (
  step_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_id UUID NOT NULL REFERENCES approval_processes(process_id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_name VARCHAR(255) NOT NULL,
  assigned_to_type VARCHAR(50) NOT NULL CHECK (assigned_to_type IN ('user', 'queue', 'manager', 'related_user')),
  assigned_to_value JSONB,
  approval_criteria JSONB,
  rejection_criteria JSONB,
  reject_behavior VARCHAR(50) DEFAULT 'reject_final' CHECK (reject_behavior IN ('reject_final', 'reject_to_previous')),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Approval requests
CREATE TABLE approval_requests (
  request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_id UUID NOT NULL REFERENCES approval_processes(process_id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES approval_steps(step_id) ON DELETE CASCADE,
  record_id UUID NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'recalled')),
  assigned_to UUID NOT NULL REFERENCES users(user_id),
  submitted_by UUID NOT NULL REFERENCES users(user_id),
  submitted_date TIMESTAMP NOT NULL,
  responded_by UUID REFERENCES users(user_id),
  response_date TIMESTAMP,
  comments TEXT,
  actual_approver UUID REFERENCES users(user_id), -- if reassigned
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Process instances (tracks approval progress)
CREATE TABLE process_instances (
  instance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_id UUID NOT NULL REFERENCES approval_processes(process_id) ON DELETE CASCADE,
  record_id UUID NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'recalled', 'stuck')),
  current_step_id UUID REFERENCES approval_steps(step_id),
  submitted_by UUID NOT NULL REFERENCES users(user_id),
  submitted_date TIMESTAMP NOT NULL,
  completed_date TIMESTAMP,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SCHEDULED ACTIONS
-- ============================================================================

-- Scheduled actions (cron jobs)
CREATE TABLE scheduled_actions (
  action_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  action_name VARCHAR(255) NOT NULL,
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('workflow', 'trigger', 'custom_job')),
  schedule_expression VARCHAR(100), -- cron format
  is_active BOOLEAN DEFAULT true,
  last_run_date TIMESTAMP,
  next_run_date TIMESTAMP,
  created_by UUID NOT NULL REFERENCES users(user_id),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_by UUID NOT NULL REFERENCES users(user_id),
  modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Workflows indexes
CREATE INDEX idx_workflows_tenant ON workflows(tenant_id);
CREATE INDEX idx_workflows_object ON workflows(object_id);
CREATE INDEX idx_workflows_active ON workflows(is_active);
CREATE INDEX idx_workflow_rules_workflow ON workflow_rules(workflow_id);
CREATE INDEX idx_workflow_actions_rule ON workflow_actions(rule_id);
CREATE INDEX idx_workflow_schedules_status ON workflow_schedules(status, scheduled_time);
CREATE INDEX idx_workflow_logs_workflow ON workflow_logs(workflow_id);

-- Triggers indexes
CREATE INDEX idx_triggers_tenant ON triggers(tenant_id);
CREATE INDEX idx_triggers_object ON triggers(object_id);
CREATE INDEX idx_triggers_active ON triggers(is_active);
CREATE INDEX idx_trigger_logs_trigger ON trigger_logs(trigger_id);

-- Approvals indexes
CREATE INDEX idx_approval_processes_tenant ON approval_processes(tenant_id);
CREATE INDEX idx_approval_processes_object ON approval_processes(object_id);
CREATE INDEX idx_approval_steps_process ON approval_steps(process_id);
CREATE INDEX idx_approval_requests_status ON approval_requests(status);
CREATE INDEX idx_approval_requests_assigned ON approval_requests(assigned_to, status);
CREATE INDEX idx_process_instances_record ON process_instances(record_id);
CREATE INDEX idx_process_instances_status ON process_instances(status);

-- Email templates indexes
CREATE INDEX idx_email_templates_tenant ON email_templates(tenant_id);
CREATE INDEX idx_email_templates_type ON email_templates(template_type);

-- Scheduled actions indexes
CREATE INDEX idx_scheduled_actions_tenant ON scheduled_actions(tenant_id);
CREATE INDEX idx_scheduled_actions_next_run ON scheduled_actions(next_run_date, is_active);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_field_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_email_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trigger_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_actions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY workflows_tenant_isolation ON workflows
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY workflow_rules_tenant_isolation ON workflow_rules
  USING (workflow_id IN (SELECT workflow_id FROM workflows WHERE tenant_id::text = current_setting('app.current_tenant_id', true)));

CREATE POLICY workflow_actions_tenant_isolation ON workflow_actions
  USING (rule_id IN (SELECT rule_id FROM workflow_rules WHERE workflow_id IN (SELECT workflow_id FROM workflows WHERE tenant_id::text = current_setting('app.current_tenant_id', true))));

CREATE POLICY workflow_field_updates_tenant_isolation ON workflow_field_updates
  USING (action_id IN (SELECT action_id FROM workflow_actions));

CREATE POLICY workflow_email_alerts_tenant_isolation ON workflow_email_alerts
  USING (action_id IN (SELECT action_id FROM workflow_actions));

CREATE POLICY workflow_task_templates_tenant_isolation ON workflow_task_templates
  USING (action_id IN (SELECT action_id FROM workflow_actions));

CREATE POLICY workflow_schedules_tenant_isolation ON workflow_schedules
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY workflow_logs_tenant_isolation ON workflow_logs
  USING (workflow_id IN (SELECT workflow_id FROM workflows WHERE tenant_id::text = current_setting('app.current_tenant_id', true)));

CREATE POLICY triggers_tenant_isolation ON triggers
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY trigger_logs_tenant_isolation ON trigger_logs
  USING (trigger_id IN (SELECT trigger_id FROM triggers WHERE tenant_id::text = current_setting('app.current_tenant_id', true)));

CREATE POLICY approval_processes_tenant_isolation ON approval_processes
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY approval_steps_tenant_isolation ON approval_steps
  USING (process_id IN (SELECT process_id FROM approval_processes WHERE tenant_id::text = current_setting('app.current_tenant_id', true)));

CREATE POLICY approval_requests_tenant_isolation ON approval_requests
  USING (process_id IN (SELECT process_id FROM approval_processes WHERE tenant_id::text = current_setting('app.current_tenant_id', true)));

CREATE POLICY process_instances_tenant_isolation ON process_instances
  USING (process_id IN (SELECT process_id FROM approval_processes WHERE tenant_id::text = current_setting('app.current_tenant_id', true)));

CREATE POLICY email_templates_tenant_isolation ON email_templates
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY scheduled_actions_tenant_isolation ON scheduled_actions
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON workflows TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_rules TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_actions TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_field_updates TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_email_alerts TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_task_templates TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_schedules TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_logs TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON triggers TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON trigger_logs TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON approval_processes TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON approval_steps TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON approval_requests TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON process_instances TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON email_templates TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON scheduled_actions TO postgres;
