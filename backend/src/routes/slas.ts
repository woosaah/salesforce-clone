import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all SLA policies
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

    const slas = await queryWithTenant(
      tenantId,
      `SELECT * FROM sla_policies
       WHERE 1=1 ${whereClause}
       ORDER BY name`,
      params
    );

    res.json({ success: true, data: slas });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single SLA policy
router.get('/:slaId', async (req: AuthRequest, res: Response) => {
  try {
    const { slaId } = req.params;
    const tenantId = req.tenantId!;

    const slas = await queryWithTenant(
      tenantId,
      'SELECT * FROM sla_policies WHERE sla_policy_id = $1',
      [slaId]
    );

    if (slas.length === 0) {
      return res.status(404).json({ success: false, error: 'SLA policy not found' });
    }

    res.json({ success: true, data: slas[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create SLA policy
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const {
      name,
      description,
      is_active = true,
      first_response_hours,
      resolution_hours_high,
      resolution_hours_medium,
      resolution_hours_low,
      business_hours_only = true
    } = req.body;

    if (!name || !first_response_hours) {
      return res.status(400).json({ success: false, error: 'Name and first response hours are required' });
    }

    const slas = await queryWithTenant(
      tenantId,
      `INSERT INTO sla_policies (
        tenant_id, name, description, is_active,
        first_response_hours, resolution_hours_high, resolution_hours_medium,
        resolution_hours_low, business_hours_only
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        tenantId, name, description, is_active,
        first_response_hours, resolution_hours_high, resolution_hours_medium,
        resolution_hours_low, business_hours_only
      ]
    );

    res.status(201).json({ success: true, data: slas[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update SLA policy
router.put('/:slaId', async (req: AuthRequest, res: Response) => {
  try {
    const { slaId } = req.params;
    const tenantId = req.tenantId!;
    const updates = req.body;

    const slas = await queryWithTenant(
      tenantId,
      `UPDATE sla_policies SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        is_active = COALESCE($3, is_active),
        first_response_hours = COALESCE($4, first_response_hours),
        resolution_hours_high = COALESCE($5, resolution_hours_high),
        resolution_hours_medium = COALESCE($6, resolution_hours_medium),
        resolution_hours_low = COALESCE($7, resolution_hours_low),
        business_hours_only = COALESCE($8, business_hours_only),
        modified_date = CURRENT_TIMESTAMP
       WHERE sla_policy_id = $9
       RETURNING *`,
      [
        updates.name, updates.description, updates.is_active,
        updates.first_response_hours, updates.resolution_hours_high,
        updates.resolution_hours_medium, updates.resolution_hours_low,
        updates.business_hours_only, slaId
      ]
    );

    if (slas.length === 0) {
      return res.status(404).json({ success: false, error: 'SLA policy not found' });
    }

    res.json({ success: true, data: slas[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete SLA policy
router.delete('/:slaId', async (req: AuthRequest, res: Response) => {
  try {
    const { slaId } = req.params;
    const tenantId = req.tenantId!;

    await queryWithTenant(
      tenantId,
      'DELETE FROM sla_policies WHERE sla_policy_id = $1',
      [slaId]
    );

    res.json({ success: true, message: 'SLA policy deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
