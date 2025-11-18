import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all escalation rules
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { is_active } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (is_active !== undefined) {
      whereClause += ' AND is_active = $' + (params.length + 1);
      params.push(is_active === 'true');
    }

    const rules = await queryWithTenant(
      tenantId,
      `SELECT er.*,
        u.email as assign_to_email,
        u.first_name || ' ' || u.last_name as assign_to_name
       FROM escalation_rules er
       LEFT JOIN users u ON er.assign_to_user_id = u.user_id
       WHERE 1=1 ${whereClause}
       ORDER BY er.name`,
      params
    );

    res.json({ success: true, data: rules });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single escalation rule
router.get('/:ruleId', async (req: AuthRequest, res: Response) => {
  try {
    const { ruleId } = req.params;
    const tenantId = req.tenantId!;

    const rules = await queryWithTenant(
      tenantId,
      `SELECT er.*,
        u.email as assign_to_email,
        u.first_name || ' ' || u.last_name as assign_to_name
       FROM escalation_rules er
       LEFT JOIN users u ON er.assign_to_user_id = u.user_id
       WHERE er.escalation_rule_id = $1`,
      [ruleId]
    );

    if (rules.length === 0) {
      return res.status(404).json({ success: false, error: 'Escalation rule not found' });
    }

    res.json({ success: true, data: rules[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create escalation rule
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const {
      name,
      is_active = true,
      criteria_json,
      escalate_after_hours,
      new_priority,
      new_status,
      assign_to_user_id,
      notification_template
    } = req.body;

    if (!name || !escalate_after_hours) {
      return res.status(400).json({ success: false, error: 'Name and escalation time are required' });
    }

    const rules = await queryWithTenant(
      tenantId,
      `INSERT INTO escalation_rules (
        tenant_id, name, is_active, criteria_json,
        escalate_after_hours, new_priority, new_status,
        assign_to_user_id, notification_template
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        tenantId, name, is_active, criteria_json,
        escalate_after_hours, new_priority, new_status,
        assign_to_user_id, notification_template
      ]
    );

    res.status(201).json({ success: true, data: rules[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update escalation rule
router.put('/:ruleId', async (req: AuthRequest, res: Response) => {
  try {
    const { ruleId } = req.params;
    const tenantId = req.tenantId!;
    const updates = req.body;

    const rules = await queryWithTenant(
      tenantId,
      `UPDATE escalation_rules SET
        name = COALESCE($1, name),
        is_active = COALESCE($2, is_active),
        criteria_json = COALESCE($3, criteria_json),
        escalate_after_hours = COALESCE($4, escalate_after_hours),
        new_priority = COALESCE($5, new_priority),
        new_status = COALESCE($6, new_status),
        assign_to_user_id = COALESCE($7, assign_to_user_id),
        notification_template = COALESCE($8, notification_template),
        modified_date = CURRENT_TIMESTAMP
       WHERE escalation_rule_id = $9
       RETURNING *`,
      [
        updates.name, updates.is_active, updates.criteria_json,
        updates.escalate_after_hours, updates.new_priority, updates.new_status,
        updates.assign_to_user_id, updates.notification_template, ruleId
      ]
    );

    if (rules.length === 0) {
      return res.status(404).json({ success: false, error: 'Escalation rule not found' });
    }

    res.json({ success: true, data: rules[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete escalation rule
router.delete('/:ruleId', async (req: AuthRequest, res: Response) => {
  try {
    const { ruleId } = req.params;
    const tenantId = req.tenantId!;

    await queryWithTenant(
      tenantId,
      'DELETE FROM escalation_rules WHERE escalation_rule_id = $1',
      [ruleId]
    );

    res.json({ success: true, message: 'Escalation rule deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test escalation rule against criteria
router.post('/:ruleId/test', async (req: AuthRequest, res: Response) => {
  try {
    const { ruleId } = req.params;
    const tenantId = req.tenantId!;
    const { test_case } = req.body;

    const rules = await queryWithTenant(
      tenantId,
      'SELECT * FROM escalation_rules WHERE escalation_rule_id = $1',
      [ruleId]
    );

    if (rules.length === 0) {
      return res.status(404).json({ success: false, error: 'Escalation rule not found' });
    }

    const rule = rules[0];
    const criteria = rule.criteria_json || {};

    // Simple criteria matching
    let matches = true;
    for (const [key, value] of Object.entries(criteria)) {
      if (test_case[key] !== value) {
        matches = false;
        break;
      }
    }

    res.json({
      success: true,
      data: {
        matches,
        rule_name: rule.name,
        criteria: criteria,
        test_case: test_case,
        would_escalate_to: {
          priority: rule.new_priority,
          status: rule.new_status,
          assigned_to: rule.assign_to_user_id
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
