import { pool, queryWithTenant } from '../config/database';

async function seedAutomation() {
  const client = await pool.connect();

  try {
    console.log('Starting Automation seed...');

    // Get the demo tenant
    const tenantResult = await client.query(
      "SELECT tenant_id FROM tenants WHERE subdomain = 'demo' LIMIT 1"
    );

    if (tenantResult.rows.length === 0) {
      throw new Error('Demo tenant not found. Please run the main seed script first.');
    }

    const tenantId = tenantResult.rows[0].tenant_id;
    console.log(`Using tenant: ${tenantId}`);

    // Get demo user
    const userResult = await client.query(
      "SELECT user_id FROM users WHERE email = 'admin@demo.com' LIMIT 1"
    );
    const userId = userResult.rows[0].user_id;

    // Get object IDs
    const leadObject = await queryWithTenant(
      tenantId,
      "SELECT object_id FROM objects_meta WHERE object_name = 'Lead' LIMIT 1",
      []
    );

    const oppObject = await queryWithTenant(
      tenantId,
      "SELECT object_id FROM objects_meta WHERE object_name = 'Opportunity' LIMIT 1",
      []
    );

    const caseObject = await queryWithTenant(
      tenantId,
      "SELECT object_id FROM objects_meta WHERE object_name = 'Case' LIMIT 1",
      []
    );

    console.log('Creating email templates...');

    // Email Templates
    const template1 = await queryWithTenant(
      tenantId,
      `INSERT INTO email_templates (
        tenant_id, template_name, subject, body_html, body_text,
        template_type, is_active, available_merge_fields,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
      RETURNING template_id`,
      [
        tenantId,
        'Welcome to Bird Seed Business',
        'Welcome {{{Lead.FirstName}}}! Thank you for your interest',
        `<html>
<body>
<h2>Welcome to Bird Seed Business!</h2>
<p>Dear {{{Lead.FirstName}}} {{{Lead.LastName}}},</p>
<p>Thank you for your interest in our premium bird feed products. We specialize in providing high-quality nutrition for all types of birds.</p>
<p>Our team will reach out to you within 48 hours to discuss your specific needs and how we can help you attract beautiful birds to your space.</p>
<p>In the meantime, feel free to browse our product catalog at www.birdse

edbusiness.com</p>
<p>Best regards,<br>
The Bird Seed Business Team</p>
</body>
</html>`,
        'Thank you for your interest in Bird Seed Business. Our team will contact you within 48 hours.',
        'Workflow',
        true,
        JSON.stringify({fields: ['Lead.FirstName', 'Lead.LastName', 'Lead.Company', 'Lead.Email']}),
        userId
      ]
    );

    const template2 = await queryWithTenant(
      tenantId,
      `INSERT INTO email_templates (
        tenant_id, template_name, subject, body_html, body_text,
        template_type, is_active, available_merge_fields,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
      RETURNING template_id`,
      [
        tenantId,
        'Opportunity Won Notification',
        'Congratulations on Closing {{{Opportunity.Name}}}!',
        `<html>
<body>
<h2>Congratulations!</h2>
<p>Great news! You have successfully closed the opportunity: <strong>{{{Opportunity.Name}}}</strong></p>
<p>Amount: ${{{Opportunity.Amount}}}</p>
<p>Account: {{{Account.Name}}}</p>
<p>Close Date: {{{Opportunity.CloseDate}}}</p>
<p>The invoice will be generated automatically and sent to the customer.</p>
<p>Keep up the excellent work!</p>
</body>
</html>`,
        'Congratulations on closing {{{Opportunity.Name}}}! Amount: ${{{Opportunity.Amount}}}',
        'Workflow',
        true,
        JSON.stringify({fields: ['Opportunity.Name', 'Opportunity.Amount', 'Account.Name', 'Opportunity.CloseDate']}),
        userId
      ]
    );

    const template3 = await queryWithTenant(
      tenantId,
      `INSERT INTO email_templates (
        tenant_id, template_name, subject, body_html, body_text,
        template_type, is_active, available_merge_fields,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
      RETURNING template_id`,
      [
        tenantId,
        'Case Escalated Alert',
        'URGENT: Case {{{Case.CaseNumber}}} Has Been Escalated',
        `<html>
<body>
<h2 style="color: red;">CASE ESCALATED</h2>
<p>The following case requires immediate attention:</p>
<ul>
<li>Case Number: {{{Case.CaseNumber}}}</li>
<li>Subject: {{{Case.Subject}}}</li>
<li>Priority: {{{Case.Priority}}}</li>
<li>Account: {{{Account.Name}}}</li>
<li>Created: {{{Case.CreatedDate}}}</li>
</ul>
<p>This case has been escalated due to no response within the SLA timeframe.</p>
<p>Please take immediate action.</p>
</body>
</html>`,
        'URGENT: Case {{{Case.CaseNumber}}} has been escalated and requires immediate attention.',
        'Alert',
        true,
        JSON.stringify({fields: ['Case.CaseNumber', 'Case.Subject', 'Case.Priority', 'Account.Name', 'Case.CreatedDate']}),
        userId
      ]
    );

    console.log('Creating workflows...');

    // Workflow 1: New Lead Welcome Email
    if (leadObject.length > 0) {
      const workflow1 = await queryWithTenant(
        tenantId,
        `INSERT INTO workflows (
          tenant_id, object_id, workflow_name, description,
          trigger_type, evaluation_criteria, is_active,
          created_by, modified_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
        RETURNING workflow_id`,
        [
          tenantId,
          leadObject[0].object_id,
          'New Lead Welcome Email',
          'Send welcome email and create follow-up task for new leads',
          'on_create',
          JSON.stringify({conditions: [{field: 'Status', operator: 'equals', value: 'New'}]}),
          true,
          userId
        ]
      );

      // Rule for workflow 1
      const rule1 = await queryWithTenant(
        tenantId,
        `INSERT INTO workflow_rules (
          workflow_id, rule_order, rule_name, criteria, criteria_logic
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING rule_id`,
        [
          workflow1[0].workflow_id,
          1,
          'New Lead Criteria',
          JSON.stringify({conditions: [{field: 'Status', operator: '=', value: 'New'}]}),
          'AND'
        ]
      );

      // Action 1: Send email
      const action1 = await queryWithTenant(
        tenantId,
        `INSERT INTO workflow_actions (
          rule_id, action_type, action_config, execution_order, is_immediate
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING action_id`,
        [
          rule1[0].rule_id,
          'email_alert',
          JSON.stringify({template_id: template1[0].template_id}),
          1,
          true
        ]
      );

      // Email alert config
      await queryWithTenant(
        tenantId,
        `INSERT INTO workflow_email_alerts (
          action_id, template_id, recipient_type, recipients
        ) VALUES ($1, $2, $3, $4)`,
        [
          action1[0].action_id,
          template1[0].template_id,
          'contact',
          JSON.stringify(['{Lead.Email}'])
        ]
      );

      // Action 2: Create task
      const action2 = await queryWithTenant(
        tenantId,
        `INSERT INTO workflow_actions (
          rule_id, action_type, action_config, execution_order, is_immediate
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING action_id`,
        [
          rule1[0].rule_id,
          'task_creation',
          JSON.stringify({}),
          2,
          true
        ]
      );

      // Task template
      await queryWithTenant(
        tenantId,
        `INSERT INTO workflow_task_templates (
          action_id, subject, assigned_to_type, assigned_to_value,
          priority, status, due_date_offset_days, description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          action2[0].action_id,
          'Follow up with new lead: {{{Lead.Name}}}',
          'owner',
          JSON.stringify({}),
          'Normal',
          'Not Started',
          2,
          'Contact the lead to discuss their bird feed requirements and provide product recommendations.'
        ]
      );
    }

    // Workflow 2: Opportunity Won - Create Invoice
    if (oppObject.length > 0) {
      const workflow2 = await queryWithTenant(
        tenantId,
        `INSERT INTO workflows (
          tenant_id, object_id, workflow_name, description,
          trigger_type, evaluation_criteria, is_active,
          created_by, modified_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
        RETURNING workflow_id`,
        [
          tenantId,
          oppObject[0].object_id,
          'Opportunity Won - Create Invoice',
          'Automatically create invoice and send notification when opportunity is won',
          'on_update',
          JSON.stringify({conditions: [{field: 'Stage', operator: 'changed_to', value: 'Closed Won'}]}),
          true,
          userId
        ]
      );

      const rule2 = await queryWithTenant(
        tenantId,
        `INSERT INTO workflow_rules (
          workflow_id, rule_order, rule_name, criteria, criteria_logic
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING rule_id`,
        [
          workflow2[0].workflow_id,
          1,
          'Stage Changed to Closed Won',
          JSON.stringify({conditions: [{field: 'StageName', operator: '=', value: 'Closed Won'}]}),
          'AND'
        ]
      );

      // Send email to owner
      const action3 = await queryWithTenant(
        tenantId,
        `INSERT INTO workflow_actions (
          rule_id, action_type, action_config, execution_order, is_immediate
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING action_id`,
        [
          rule2[0].rule_id,
          'email_alert',
          JSON.stringify({template_id: template2[0].template_id}),
          1,
          true
        ]
      );

      await queryWithTenant(
        tenantId,
        `INSERT INTO workflow_email_alerts (
          action_id, template_id, recipient_type, recipients
        ) VALUES ($1, $2, $3, $4)`,
        [
          action3[0].action_id,
          template2[0].template_id,
          'owner',
          JSON.stringify(['{Opportunity.OwnerId}'])
        ]
      );
    }

    // Workflow 3: Case Escalation
    if (caseObject.length > 0) {
      const workflow3 = await queryWithTenant(
        tenantId,
        `INSERT INTO workflows (
          tenant_id, object_id, workflow_name, description,
          trigger_type, evaluation_criteria, is_active,
          created_by, modified_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
        RETURNING workflow_id`,
        [
          tenantId,
          caseObject[0].object_id,
          'Case Escalation - No Response',
          'Escalate high-priority cases that have not been responded to within 2 hours',
          'time_based',
          JSON.stringify({conditions: [
            {field: 'Status', operator: '=', value: 'New'},
            {field: 'Priority', operator: '=', value: 'High'}
          ]}),
          true,
          userId
        ]
      );

      const rule3 = await queryWithTenant(
        tenantId,
        `INSERT INTO workflow_rules (
          workflow_id, rule_order, rule_name, criteria, criteria_logic
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING rule_id`,
        [
          workflow3[0].workflow_id,
          1,
          'High Priority Cases Not Responded',
          JSON.stringify({conditions: [
            {field: 'Status', operator: '=', value: 'New'},
            {field: 'Priority', operator: '=', value: 'High'}
          ]}),
          'AND'
        ]
      );

      // Update field - escalate
      const action4 = await queryWithTenant(
        tenantId,
        `INSERT INTO workflow_actions (
          rule_id, action_type, action_config, execution_order,
          is_immediate, time_offset_minutes
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING action_id`,
        [
          rule3[0].rule_id,
          'field_update',
          JSON.stringify({}),
          1,
          false,
          120 // 2 hours
        ]
      );

      await queryWithTenant(
        tenantId,
        `INSERT INTO workflow_field_updates (
          action_id, field_name, update_type, update_value
        ) VALUES ($1, $2, $3, $4)`,
        [
          action4[0].action_id,
          'Priority',
          'literal',
          JSON.stringify('Critical')
        ]
      );

      // Send alert
      const action5 = await queryWithTenant(
        tenantId,
        `INSERT INTO workflow_actions (
          rule_id, action_type, action_config, execution_order,
          is_immediate, time_offset_minutes
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING action_id`,
        [
          rule3[0].rule_id,
          'email_alert',
          JSON.stringify({template_id: template3[0].template_id}),
          2,
          false,
          120 // 2 hours
        ]
      );

      await queryWithTenant(
        tenantId,
        `INSERT INTO workflow_email_alerts (
          action_id, template_id, recipient_type, recipients
        ) VALUES ($1, $2, $3, $4)`,
        [
          action5[0].action_id,
          template3[0].template_id,
          'user',
          JSON.stringify([userId])
        ]
      );
    }

    console.log('Creating triggers...');

    // Trigger 1: Validate Opportunity Amount
    if (oppObject.length > 0) {
      await queryWithTenant(
        tenantId,
        `INSERT INTO triggers (
          tenant_id, object_id, trigger_name, trigger_type,
          code, description, execution_order, is_active,
          created_by, modified_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
        [
          tenantId,
          oppObject[0].object_id,
          'Validate Opportunity Amount',
          'before_insert',
          `// Ensure opportunity amount is positive
for (const record of records) {
  const amount = parseFloat(record.data.Amount__c) || 0;
  if (amount < 0) {
    throw new Error('Opportunity amount cannot be negative');
  }
  if (amount === 0) {
    console.log('Warning: Opportunity created with zero amount');
  }
}`,
          'Validates that opportunity amount is not negative',
          1,
          true,
          userId
        ]
      );
    }

    // Trigger 2: Auto-Generate Lead Number
    if (leadObject.length > 0) {
      await queryWithTenant(
        tenantId,
        `INSERT INTO triggers (
          tenant_id, object_id, trigger_name, trigger_type,
          code, description, execution_order, is_active,
          created_by, modified_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
        [
          tenantId,
          leadObject[0].object_id,
          'Auto-Generate Lead Number',
          'before_insert',
          `// Auto-generate lead number if not provided
for (const record of records) {
  if (!record.data.Lead_Number__c) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    record.data.Lead_Number__c = \`LEAD-\${timestamp}-\${random}\`;
  }
}`,
          'Automatically generates a lead number if not provided',
          1,
          true,
          userId
        ]
      );
    }

    console.log('Creating approval process...');

    // Approval Process: Discount Approval
    if (oppObject.length > 0) {
      const approvalProcess = await queryWithTenant(
        tenantId,
        `INSERT INTO approval_processes (
          tenant_id, object_id, process_name, description,
          entry_criteria, is_active, created_by, modified_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        RETURNING process_id`,
        [
          tenantId,
          oppObject[0].object_id,
          'Discount Approval Process',
          'Approval required for discounts over 15%',
          JSON.stringify({conditions: [{field: 'Discount_Percent__c', operator: '>', value: 15}]}),
          true,
          userId
        ]
      );

      // Step 1: Manager Approval
      await queryWithTenant(
        tenantId,
        `INSERT INTO approval_steps (
          process_id, step_order, step_name, assigned_to_type,
          assigned_to_value, approval_criteria, rejection_criteria, reject_behavior
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          approvalProcess[0].process_id,
          1,
          'Sales Manager Approval',
          'manager',
          JSON.stringify({}),
          JSON.stringify({conditions: [{field: 'Discount_Percent__c', operator: '<=', value: 25}]}),
          JSON.stringify({}),
          'reject_final'
        ]
      );

      // Step 2: VP Approval (for > 25% discount)
      await queryWithTenant(
        tenantId,
        `INSERT INTO approval_steps (
          process_id, step_order, step_name, assigned_to_type,
          assigned_to_value, approval_criteria, rejection_criteria, reject_behavior
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          approvalProcess[0].process_id,
          2,
          'VP Sales Approval',
          'user',
          JSON.stringify({user_id: userId}),
          JSON.stringify({conditions: [{field: 'Discount_Percent__c', operator: '>', value: 25}]}),
          JSON.stringify({}),
          'reject_final'
        ]
      );
    }

    console.log('✓ Automation seed completed successfully!');
    console.log(`
Created:
- 3 Email templates
- 3 Workflows with rules and actions:
  * New Lead Welcome Email
  * Opportunity Won - Create Invoice
  * Case Escalation - No Response
- 2 Triggers:
  * Validate Opportunity Amount
  * Auto-Generate Lead Number
- 1 Approval process with 2 steps:
  * Discount Approval Process
    `);

  } catch (error) {
    console.error('Error seeding Automation:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  seedAutomation()
    .then(() => {
      console.log('Automation seed script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Automation seed script failed:', error);
      process.exit(1);
    });
}

export default seedAutomation;
