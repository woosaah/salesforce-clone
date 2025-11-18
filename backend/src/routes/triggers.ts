import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all triggers
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { is_active, object_id, trigger_type } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (is_active !== undefined) {
      whereClause += ' AND t.is_active = $' + (params.length + 1);
      params.push(is_active === 'true');
    }
    if (object_id) {
      whereClause += ' AND t.object_id = $' + (params.length + 1);
      params.push(object_id);
    }
    if (trigger_type) {
      whereClause += ' AND t.trigger_type = $' + (params.length + 1);
      params.push(trigger_type);
    }

    const triggers = await queryWithTenant(
      tenantId,
      `SELECT t.*,
        o.object_name,
        (SELECT COUNT(*) FROM trigger_logs tl WHERE tl.trigger_id = t.trigger_id) as execution_count,
        (SELECT COUNT(*) FROM trigger_logs tl WHERE tl.trigger_id = t.trigger_id AND tl.status = 'error') as error_count
       FROM triggers t
       LEFT JOIN objects_meta o ON t.object_id = o.object_id
       WHERE 1=1 ${whereClause}
       ORDER BY t.modified_date DESC`,
      params
    );

    res.json({ success: true, data: triggers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single trigger
router.get('/:triggerId', async (req: AuthRequest, res: Response) => {
  try {
    const { triggerId } = req.params;
    const tenantId = req.tenantId!;

    const triggers = await queryWithTenant(
      tenantId,
      `SELECT t.*, o.object_name
       FROM triggers t
       LEFT JOIN objects_meta o ON t.object_id = o.object_id
       WHERE t.trigger_id = $1`,
      [triggerId]
    );

    if (triggers.length === 0) {
      return res.status(404).json({ success: false, error: 'Trigger not found' });
    }

    res.json({ success: true, data: triggers[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create trigger
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      object_id,
      trigger_name,
      trigger_type,
      code,
      description,
      execution_order = 1,
      is_active = false
    } = req.body;

    if (!trigger_name || !object_id || !trigger_type || !code) {
      return res.status(400).json({ success: false, error: 'Trigger name, object, type, and code are required' });
    }

    const triggers = await queryWithTenant(
      tenantId,
      `INSERT INTO triggers (
        tenant_id, object_id, trigger_name, trigger_type,
        code, description, execution_order, is_active,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
      RETURNING *`,
      [tenantId, object_id, trigger_name, trigger_type, code, description, execution_order, is_active, userId]
    );

    res.status(201).json({ success: true, data: triggers[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update trigger
router.put('/:triggerId', async (req: AuthRequest, res: Response) => {
  try {
    const { triggerId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const updates = req.body;

    const triggers = await queryWithTenant(
      tenantId,
      `UPDATE triggers SET
        trigger_name = COALESCE($1, trigger_name),
        trigger_type = COALESCE($2, trigger_type),
        code = COALESCE($3, code),
        description = COALESCE($4, description),
        execution_order = COALESCE($5, execution_order),
        is_active = COALESCE($6, is_active),
        modified_by = $7,
        modified_date = CURRENT_TIMESTAMP
       WHERE trigger_id = $8
       RETURNING *`,
      [
        updates.trigger_name, updates.trigger_type, updates.code,
        updates.description, updates.execution_order, updates.is_active,
        userId, triggerId
      ]
    );

    if (triggers.length === 0) {
      return res.status(404).json({ success: false, error: 'Trigger not found' });
    }

    res.json({ success: true, data: triggers[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Activate trigger
router.post('/:triggerId/activate', async (req: AuthRequest, res: Response) => {
  try {
    const { triggerId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const triggers = await queryWithTenant(
      tenantId,
      `UPDATE triggers SET
        is_active = true,
        modified_by = $1,
        modified_date = CURRENT_TIMESTAMP
       WHERE trigger_id = $2
       RETURNING *`,
      [userId, triggerId]
    );

    if (triggers.length === 0) {
      return res.status(404).json({ success: false, error: 'Trigger not found' });
    }

    res.json({ success: true, data: triggers[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Deactivate trigger
router.post('/:triggerId/deactivate', async (req: AuthRequest, res: Response) => {
  try {
    const { triggerId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const triggers = await queryWithTenant(
      tenantId,
      `UPDATE triggers SET
        is_active = false,
        modified_by = $1,
        modified_date = CURRENT_TIMESTAMP
       WHERE trigger_id = $2
       RETURNING *`,
      [userId, triggerId]
    );

    if (triggers.length === 0) {
      return res.status(404).json({ success: false, error: 'Trigger not found' });
    }

    res.json({ success: true, data: triggers[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get trigger logs
router.get('/:triggerId/logs', async (req: AuthRequest, res: Response) => {
  try {
    const { triggerId } = req.params;
    const { limit = 100, status } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [triggerId];

    if (status) {
      whereClause += ' AND tl.status = $' + (params.length + 1);
      params.push(status);
    }

    const logs = await queryWithTenant(
      tenantId,
      `SELECT tl.*
       FROM trigger_logs tl
       WHERE tl.trigger_id = $1 ${whereClause}
       ORDER BY tl.executed_at DESC
       LIMIT $${params.length + 1}`,
      [...params, limit]
    );

    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test trigger with sample data
router.post('/:triggerId/test', async (req: AuthRequest, res: Response) => {
  try {
    const { triggerId } = req.params;
    const { test_records } = req.body;
    const tenantId = req.tenantId!;

    if (!test_records || !Array.isArray(test_records)) {
      return res.status(400).json({ success: false, error: 'Test records array is required' });
    }

    const triggers = await queryWithTenant(
      tenantId,
      'SELECT * FROM triggers WHERE trigger_id = $1',
      [triggerId]
    );

    if (triggers.length === 0) {
      return res.status(404).json({ success: false, error: 'Trigger not found' });
    }

    const trigger = triggers[0];

    // Simple test execution (in production, would use VM2 sandboxing)
    const startTime = Date.now();
    const result = {
      trigger_name: trigger.trigger_name,
      trigger_type: trigger.trigger_type,
      test_mode: true,
      execution_time_ms: 0,
      status: 'success',
      output: 'Test execution completed (sandboxed execution not implemented)',
      records_processed: test_records.length
    };

    result.execution_time_ms = Date.now() - startTime;

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete trigger
router.delete('/:triggerId', async (req: AuthRequest, res: Response) => {
  try {
    const { triggerId } = req.params;
    const tenantId = req.tenantId!;

    await queryWithTenant(
      tenantId,
      'DELETE FROM triggers WHERE trigger_id = $1',
      [triggerId]
    );

    res.json({ success: true, message: 'Trigger deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
