import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all opportunity stages
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

    const stages = await queryWithTenant(
      tenantId,
      `SELECT os.*,
        COUNT(o.opportunity_id) as opportunity_count,
        COALESCE(SUM(o.amount), 0) as total_amount
       FROM opportunity_stages os
       LEFT JOIN opportunities o ON os.stage_name = o.stage_name AND o.tenant_id = os.tenant_id
       WHERE 1=1 ${whereClause}
       GROUP BY os.stage_id
       ORDER BY os.stage_order`,
      params
    );

    res.json({ success: true, data: stages });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single opportunity stage
router.get('/:stageId', async (req: AuthRequest, res: Response) => {
  try {
    const { stageId } = req.params;
    const tenantId = req.tenantId!;

    const stages = await queryWithTenant(
      tenantId,
      'SELECT * FROM opportunity_stages WHERE stage_id = $1',
      [stageId]
    );

    if (stages.length === 0) {
      return res.status(404).json({ success: false, error: 'Opportunity stage not found' });
    }

    res.json({ success: true, data: stages[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create opportunity stage
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const {
      stage_name,
      probability,
      is_closed = false,
      is_won = false,
      is_active = true,
      stage_order
    } = req.body;

    if (!stage_name || probability === undefined) {
      return res.status(400).json({ success: false, error: 'Stage name and probability are required' });
    }

    // Auto-assign stage order if not provided
    let order = stage_order;
    if (!order) {
      const maxOrder = await queryWithTenant<{max: number}>(
        tenantId,
        'SELECT COALESCE(MAX(stage_order), 0) as max FROM opportunity_stages WHERE tenant_id = $1',
        [tenantId]
      );
      order = (maxOrder[0].max || 0) + 10;
    }

    const stages = await queryWithTenant(
      tenantId,
      `INSERT INTO opportunity_stages (
        tenant_id, stage_name, probability, is_closed, is_won, is_active, stage_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [tenantId, stage_name, probability, is_closed, is_won, is_active, order]
    );

    res.status(201).json({ success: true, data: stages[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update opportunity stage
router.put('/:stageId', async (req: AuthRequest, res: Response) => {
  try {
    const { stageId } = req.params;
    const tenantId = req.tenantId!;
    const updates = req.body;

    const stages = await queryWithTenant(
      tenantId,
      `UPDATE opportunity_stages SET
        stage_name = COALESCE($1, stage_name),
        probability = COALESCE($2, probability),
        is_closed = COALESCE($3, is_closed),
        is_won = COALESCE($4, is_won),
        is_active = COALESCE($5, is_active),
        stage_order = COALESCE($6, stage_order),
        modified_date = CURRENT_TIMESTAMP
       WHERE stage_id = $7
       RETURNING *`,
      [
        updates.stage_name, updates.probability, updates.is_closed,
        updates.is_won, updates.is_active, updates.stage_order, stageId
      ]
    );

    if (stages.length === 0) {
      return res.status(404).json({ success: false, error: 'Opportunity stage not found' });
    }

    res.json({ success: true, data: stages[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reorder stages
router.post('/reorder', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { stage_orders } = req.body; // Array of {stage_id, stage_order}

    if (!Array.isArray(stage_orders)) {
      return res.status(400).json({ success: false, error: 'stage_orders must be an array' });
    }

    // Update each stage's order
    for (const item of stage_orders) {
      await queryWithTenant(
        tenantId,
        'UPDATE opportunity_stages SET stage_order = $1 WHERE stage_id = $2',
        [item.stage_order, item.stage_id]
      );
    }

    // Fetch updated stages
    const stages = await queryWithTenant(
      tenantId,
      'SELECT * FROM opportunity_stages ORDER BY stage_order',
      []
    );

    res.json({ success: true, data: stages });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete opportunity stage
router.delete('/:stageId', async (req: AuthRequest, res: Response) => {
  try {
    const { stageId } = req.params;
    const tenantId = req.tenantId!;

    // Check if any opportunities use this stage
    const oppCount = await queryWithTenant(
      tenantId,
      `SELECT COUNT(*) as count FROM opportunities o
       JOIN opportunity_stages os ON o.stage_name = os.stage_name
       WHERE os.stage_id = $1`,
      [stageId]
    );

    if (parseInt(oppCount[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete stage that is in use by opportunities'
      });
    }

    await queryWithTenant(
      tenantId,
      'DELETE FROM opportunity_stages WHERE stage_id = $1',
      [stageId]
    );

    res.json({ success: true, message: 'Opportunity stage deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
