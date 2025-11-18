import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all workflows
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { is_active, object_id, trigger_type } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (is_active !== undefined) {
      whereClause += ' AND w.is_active = $' + (params.length + 1);
      params.push(is_active === 'true');
    }
    if (object_id) {
      whereClause += ' AND w.object_id = $' + (params.length + 1);
      params.push(object_id);
    }
    if (trigger_type) {
      whereClause += ' AND w.trigger_type = $' + (params.length + 1);
      params.push(trigger_type);
    }

    const workflows = await queryWithTenant(
      tenantId,
      `SELECT w.*,
        o.object_name,
        COUNT(DISTINCT wr.rule_id) as rule_count
       FROM workflows w
       LEFT JOIN objects_meta o ON w.object_id = o.object_id
       LEFT JOIN workflow_rules wr ON w.workflow_id = wr.workflow_id
       WHERE 1=1 ${whereClause}
       GROUP BY w.workflow_id, o.object_name
       ORDER BY w.modified_date DESC`,
      params
    );

    res.json({ success: true, data: workflows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single workflow with rules and actions
router.get('/:workflowId', async (req: AuthRequest, res: Response) => {
  try {
    const { workflowId } = req.params;
    const tenantId = req.tenantId!;

    const workflows = await queryWithTenant(
      tenantId,
      `SELECT w.*, o.object_name
       FROM workflows w
       LEFT JOIN objects_meta o ON w.object_id = o.object_id
       WHERE w.workflow_id = $1`,
      [workflowId]
    );

    if (workflows.length === 0) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    const workflow = workflows[0];

    // Get rules
    const rules = await queryWithTenant(
      tenantId,
      'SELECT * FROM workflow_rules WHERE workflow_id = $1 ORDER BY rule_order',
      [workflowId]
    );

    // Get actions for each rule
    for (const rule of rules) {
      const actions = await queryWithTenant(
        tenantId,
        'SELECT * FROM workflow_actions WHERE rule_id = $1 ORDER BY execution_order',
        [rule.rule_id]
      );

      // Get action details based on type
      for (const action of actions) {
        if (action.action_type === 'field_update') {
          action.updates = await queryWithTenant(
            tenantId,
            'SELECT * FROM workflow_field_updates WHERE action_id = $1',
            [action.action_id]
          );
        } else if (action.action_type === 'email_alert') {
          const alerts = await queryWithTenant(
            tenantId,
            'SELECT * FROM workflow_email_alerts WHERE action_id = $1',
            [action.action_id]
          );
          action.alert = alerts[0];
        } else if (action.action_type === 'task_creation') {
          const templates = await queryWithTenant(
            tenantId,
            'SELECT * FROM workflow_task_templates WHERE action_id = $1',
            [action.action_id]
          );
          action.template = templates[0];
        }
      }

      rule.actions = actions;
    }

    workflow.rules = rules;

    res.json({ success: true, data: workflow });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create workflow
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      object_id,
      workflow_name,
      description,
      trigger_type,
      evaluation_criteria,
      is_active = false
    } = req.body;

    if (!workflow_name || !object_id || !trigger_type) {
      return res.status(400).json({ success: false, error: 'Workflow name, object, and trigger type are required' });
    }

    const workflows = await queryWithTenant(
      tenantId,
      `INSERT INTO workflows (
        tenant_id, object_id, workflow_name, description,
        trigger_type, evaluation_criteria, is_active,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
      RETURNING *`,
      [tenantId, object_id, workflow_name, description, trigger_type, evaluation_criteria, is_active, userId]
    );

    res.status(201).json({ success: true, data: workflows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update workflow
router.put('/:workflowId', async (req: AuthRequest, res: Response) => {
  try {
    const { workflowId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const updates = req.body;

    const workflows = await queryWithTenant(
      tenantId,
      `UPDATE workflows SET
        workflow_name = COALESCE($1, workflow_name),
        description = COALESCE($2, description),
        trigger_type = COALESCE($3, trigger_type),
        evaluation_criteria = COALESCE($4, evaluation_criteria),
        is_active = COALESCE($5, is_active),
        modified_by = $6,
        modified_date = CURRENT_TIMESTAMP
       WHERE workflow_id = $7
       RETURNING *`,
      [
        updates.workflow_name, updates.description, updates.trigger_type,
        updates.evaluation_criteria, updates.is_active, userId, workflowId
      ]
    );

    if (workflows.length === 0) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    res.json({ success: true, data: workflows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Activate workflow
router.post('/:workflowId/activate', async (req: AuthRequest, res: Response) => {
  try {
    const { workflowId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const workflows = await queryWithTenant(
      tenantId,
      `UPDATE workflows SET
        is_active = true,
        modified_by = $1,
        modified_date = CURRENT_TIMESTAMP
       WHERE workflow_id = $2
       RETURNING *`,
      [userId, workflowId]
    );

    if (workflows.length === 0) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    res.json({ success: true, data: workflows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Deactivate workflow
router.post('/:workflowId/deactivate', async (req: AuthRequest, res: Response) => {
  try {
    const { workflowId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const workflows = await queryWithTenant(
      tenantId,
      `UPDATE workflows SET
        is_active = false,
        modified_by = $1,
        modified_date = CURRENT_TIMESTAMP
       WHERE workflow_id = $2
       RETURNING *`,
      [userId, workflowId]
    );

    if (workflows.length === 0) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    res.json({ success: true, data: workflows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get workflow logs
router.get('/:workflowId/logs', async (req: AuthRequest, res: Response) => {
  try {
    const { workflowId } = req.params;
    const { limit = 100, status } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [workflowId];

    if (status) {
      whereClause += ' AND wl.status = $' + (params.length + 1);
      params.push(status);
    }

    const logs = await queryWithTenant(
      tenantId,
      `SELECT wl.*
       FROM workflow_logs wl
       WHERE wl.workflow_id = $1 ${whereClause}
       ORDER BY wl.executed_at DESC
       LIMIT $${params.length + 1}`,
      [...params, limit]
    );

    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add rule to workflow
router.post('/:workflowId/rules', async (req: AuthRequest, res: Response) => {
  try {
    const { workflowId } = req.params;
    const tenantId = req.tenantId!;
    const { rule_name, criteria, criteria_logic = 'AND', rule_order = 1 } = req.body;

    if (!rule_name || !criteria) {
      return res.status(400).json({ success: false, error: 'Rule name and criteria are required' });
    }

    const rules = await queryWithTenant(
      tenantId,
      `INSERT INTO workflow_rules (
        workflow_id, rule_name, criteria, criteria_logic, rule_order
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [workflowId, rule_name, criteria, criteria_logic, rule_order]
    );

    res.status(201).json({ success: true, data: rules[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add action to rule
router.post('/:workflowId/rules/:ruleId/actions', async (req: AuthRequest, res: Response) => {
  try {
    const { ruleId } = req.params;
    const tenantId = req.tenantId!;
    const {
      action_type,
      action_config,
      execution_order = 1,
      is_immediate = true,
      time_offset_minutes
    } = req.body;

    if (!action_type) {
      return res.status(400).json({ success: false, error: 'Action type is required' });
    }

    const actions = await queryWithTenant(
      tenantId,
      `INSERT INTO workflow_actions (
        rule_id, action_type, action_config, execution_order,
        is_immediate, time_offset_minutes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [ruleId, action_type, action_config, execution_order, is_immediate, time_offset_minutes]
    );

    res.status(201).json({ success: true, data: actions[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete workflow
router.delete('/:workflowId', async (req: AuthRequest, res: Response) => {
  try {
    const { workflowId } = req.params;
    const tenantId = req.tenantId!;

    await queryWithTenant(
      tenantId,
      'DELETE FROM workflows WHERE workflow_id = $1',
      [workflowId]
    );

    res.json({ success: true, message: 'Workflow deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
