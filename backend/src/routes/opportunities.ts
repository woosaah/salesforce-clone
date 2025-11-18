import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all opportunities
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 50, offset = 0, stage_name, is_closed } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (stage_name) {
      whereClause += ' AND o.stage_name = $' + (params.length + 1);
      params.push(stage_name);
    }
    if (is_closed !== undefined) {
      whereClause += ' AND o.is_closed = $' + (params.length + 1);
      params.push(is_closed === 'true');
    }

    const opps = await queryWithTenant(
      tenantId,
      `SELECT o.*,
        acc.data->>'Name' as account_name,
        con.data->>'FirstName' || ' ' || con.data->>'LastName' as contact_name
       FROM opportunities o
       LEFT JOIN object_data acc ON o.account_id = acc.record_id
       LEFT JOIN object_data con ON o.contact_id = con.record_id
       WHERE 1=1 ${whereClause}
       ORDER BY o.close_date ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({ success: true, data: { opportunities: opps, total: opps.length } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get pipeline view (group by stage)
router.get('/pipeline', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;

    const pipeline = await queryWithTenant(
      tenantId,
      `SELECT
        o.stage_name,
        COUNT(*) as count,
        COALESCE(SUM(o.amount), 0) as total_amount,
        AVG(o.probability) as avg_probability
       FROM opportunities o
       WHERE o.is_closed = false
       GROUP BY o.stage_name
       ORDER BY MIN(
         (SELECT stage_order FROM opportunity_stages
          WHERE stage_name = o.stage_name AND tenant_id = $1 LIMIT 1)
       )`,
      [tenantId]
    );

    res.json({ success: true, data: pipeline });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single opportunity
router.get('/:oppId', async (req: AuthRequest, res: Response) => {
  try {
    const { oppId } = req.params;
    const tenantId = req.tenantId!;

    const opps = await queryWithTenant(
      tenantId,
      `SELECT o.*,
        COALESCE(jsonb_agg(jsonb_build_object(
          'opp_product_id', op.opp_product_id,
          'product_id', op.product_id,
          'line_number', op.line_number,
          'quantity', op.quantity,
          'unit_price', op.unit_price,
          'total_price', op.total_price,
          'product_name', p.product_name
        ) ORDER BY op.line_number) FILTER (WHERE op.opp_product_id IS NOT NULL), '[]') as products
       FROM opportunities o
       LEFT JOIN opportunity_products op ON o.opportunity_id = op.opportunity_id
       LEFT JOIN products p ON op.product_id = p.product_id
       WHERE o.opportunity_id = $1
       GROUP BY o.opportunity_id`,
      [oppId]
    );

    if (opps.length === 0) {
      return res.status(404).json({ success: false, error: 'Opportunity not found' });
    }

    res.json({ success: true, data: opps[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create opportunity
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const { opportunity_name, account_id, amount, close_date, stage_name = 'Prospecting' } = req.body;

    if (!opportunity_name || !close_date) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const count = await queryWithTenant<{count: string}>(
      tenantId,
      'SELECT COUNT(*) as count FROM opportunities WHERE tenant_id = $1',
      [tenantId]
    );
    const opp_number = `OPP-${String(parseInt(count[0].count) + 1).padStart(5, '0')}`;

    // Get stage probability
    const stages = await queryWithTenant(
      tenantId,
      'SELECT probability FROM opportunity_stages WHERE stage_name = $1 AND tenant_id = $2',
      [stage_name, tenantId]
    );
    const probability = stages.length > 0 ? stages[0].probability : 10;

    const opps = await queryWithTenant(
      tenantId,
      `INSERT INTO opportunities (
        tenant_id, opportunity_number, opportunity_name, account_id,
        amount, close_date, stage_name, probability,
        owner_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $9)
      RETURNING *`,
      [tenantId, opp_number, opportunity_name, account_id, amount || 0, close_date, stage_name, probability, userId]
    );

    res.status(201).json({ success: true, data: opps[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update opportunity (including stage changes)
router.put('/:oppId', async (req: AuthRequest, res: Response) => {
  try {
    const { oppId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const updates = req.body;

    // If stage is changing, update probability
    if (updates.stage_name) {
      const stages = await queryWithTenant(
        tenantId,
        'SELECT probability, is_closed, is_won FROM opportunity_stages WHERE stage_name = $1 AND tenant_id = $2',
        [updates.stage_name, tenantId]
      );
      if (stages.length > 0) {
        updates.probability = stages[0].probability;
        updates.is_closed = stages[0].is_closed;
        updates.is_won = stages[0].is_won;
        if (stages[0].is_closed) {
          updates.closed_date = new Date();
        }
      }
    }

    const opps = await queryWithTenant(
      tenantId,
      `UPDATE opportunities SET
        opportunity_name = COALESCE($1, opportunity_name),
        account_id = COALESCE($2, account_id),
        amount = COALESCE($3, amount),
        close_date = COALESCE($4, close_date),
        stage_name = COALESCE($5, stage_name),
        probability = COALESCE($6, probability),
        is_closed = COALESCE($7, is_closed),
        is_won = COALESCE($8, is_won),
        closed_date = COALESCE($9, closed_date),
        modified_by = $10,
        modified_date = CURRENT_TIMESTAMP
       WHERE opportunity_id = $11
       RETURNING *`,
      [
        updates.opportunity_name, updates.account_id, updates.amount, updates.close_date,
        updates.stage_name, updates.probability, updates.is_closed, updates.is_won, updates.closed_date,
        userId, oppId
      ]
    );

    res.json({ success: true, data: opps[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add product to opportunity
router.post('/:oppId/products', async (req: AuthRequest, res: Response) => {
  try {
    const { oppId } = req.params;
    const tenantId = req.tenantId!;
    const { product_id, quantity, unit_price } = req.body;

    const count = await queryWithTenant<{count: string}>(
      tenantId,
      'SELECT COUNT(*) as count FROM opportunity_products WHERE opportunity_id = $1',
      [oppId]
    );
    const line_number = parseInt(count[0].count) + 1;

    const total_price = quantity * unit_price;

    const products = await queryWithTenant(
      tenantId,
      `INSERT INTO opportunity_products (
        opportunity_id, product_id, line_number, quantity, unit_price, total_price
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [oppId, product_id, line_number, quantity, unit_price, total_price]
    );

    res.status(201).json({ success: true, data: products[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
