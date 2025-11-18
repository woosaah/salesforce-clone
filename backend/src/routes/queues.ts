import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all queues
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { object_type, is_active } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (object_type) {
      whereClause += ' AND q.object_type = $' + (params.length + 1);
      params.push(object_type);
    }
    if (is_active !== undefined) {
      whereClause += ' AND q.is_active = $' + (params.length + 1);
      params.push(is_active === 'true');
    }

    const queues = await queryWithTenant(
      tenantId,
      `SELECT q.*,
        COUNT(qm.user_id) as member_count
       FROM queues q
       LEFT JOIN queue_members qm ON q.queue_id = qm.queue_id
       WHERE 1=1 ${whereClause}
       GROUP BY q.queue_id
       ORDER BY q.queue_name`,
      params
    );

    res.json({ success: true, data: queues });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single queue with members
router.get('/:queueId', async (req: AuthRequest, res: Response) => {
  try {
    const { queueId } = req.params;
    const tenantId = req.tenantId!;

    const queues = await queryWithTenant(
      tenantId,
      `SELECT q.*,
        COALESCE(jsonb_agg(jsonb_build_object(
          'user_id', qm.user_id,
          'email', u.email,
          'first_name', u.first_name,
          'last_name', u.last_name
        ) ORDER BY u.last_name) FILTER (WHERE qm.user_id IS NOT NULL), '[]') as members
       FROM queues q
       LEFT JOIN queue_members qm ON q.queue_id = qm.queue_id
       LEFT JOIN users u ON qm.user_id = u.user_id
       WHERE q.queue_id = $1
       GROUP BY q.queue_id`,
      [queueId]
    );

    if (queues.length === 0) {
      return res.status(404).json({ success: false, error: 'Queue not found' });
    }

    res.json({ success: true, data: queues[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create queue
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { queue_name, description, object_type = 'Case', is_active = true } = req.body;

    if (!queue_name) {
      return res.status(400).json({ success: false, error: 'Queue name is required' });
    }

    const queues = await queryWithTenant(
      tenantId,
      `INSERT INTO queues (
        tenant_id, queue_name, description, object_type, is_active
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [tenantId, queue_name, description, object_type, is_active]
    );

    res.status(201).json({ success: true, data: queues[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update queue
router.put('/:queueId', async (req: AuthRequest, res: Response) => {
  try {
    const { queueId } = req.params;
    const tenantId = req.tenantId!;
    const updates = req.body;

    const queues = await queryWithTenant(
      tenantId,
      `UPDATE queues SET
        queue_name = COALESCE($1, queue_name),
        description = COALESCE($2, description),
        object_type = COALESCE($3, object_type),
        is_active = COALESCE($4, is_active),
        modified_date = CURRENT_TIMESTAMP
       WHERE queue_id = $5
       RETURNING *`,
      [updates.queue_name, updates.description, updates.object_type, updates.is_active, queueId]
    );

    if (queues.length === 0) {
      return res.status(404).json({ success: false, error: 'Queue not found' });
    }

    res.json({ success: true, data: queues[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add member to queue
router.post('/:queueId/members', async (req: AuthRequest, res: Response) => {
  try {
    const { queueId } = req.params;
    const tenantId = req.tenantId!;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    // Verify queue exists
    const queues = await queryWithTenant(
      tenantId,
      'SELECT queue_id FROM queues WHERE queue_id = $1',
      [queueId]
    );

    if (queues.length === 0) {
      return res.status(404).json({ success: false, error: 'Queue not found' });
    }

    await queryWithTenant(
      tenantId,
      'INSERT INTO queue_members (queue_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [queueId, user_id]
    );

    res.json({ success: true, message: 'Member added to queue' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove member from queue
router.delete('/:queueId/members/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const { queueId, userId } = req.params;
    const tenantId = req.tenantId!;

    await queryWithTenant(
      tenantId,
      'DELETE FROM queue_members WHERE queue_id = $1 AND user_id = $2',
      [queueId, userId]
    );

    res.json({ success: true, message: 'Member removed from queue' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete queue
router.delete('/:queueId', async (req: AuthRequest, res: Response) => {
  try {
    const { queueId } = req.params;
    const tenantId = req.tenantId!;

    await queryWithTenant(
      tenantId,
      'DELETE FROM queues WHERE queue_id = $1',
      [queueId]
    );

    res.json({ success: true, message: 'Queue deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
