import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all service contracts
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, support_level, account_id } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND sc.status = $' + (params.length + 1);
      params.push(status);
    }
    if (support_level) {
      whereClause += ' AND sc.support_level = $' + (params.length + 1);
      params.push(support_level);
    }
    if (account_id) {
      whereClause += ' AND sc.account_id = $' + (params.length + 1);
      params.push(account_id);
    }

    const contracts = await queryWithTenant(
      tenantId,
      `SELECT sc.*,
        acc.data->>'Name' as account_name,
        sla.name as sla_policy_name
       FROM service_contracts sc
       LEFT JOIN object_data acc ON sc.account_id = acc.record_id
       LEFT JOIN sla_policies sla ON sc.sla_policy_id = sla.sla_policy_id
       WHERE 1=1 ${whereClause}
       ORDER BY sc.start_date DESC`,
      params
    );

    res.json({ success: true, data: contracts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single service contract
router.get('/:contractId', async (req: AuthRequest, res: Response) => {
  try {
    const { contractId } = req.params;
    const tenantId = req.tenantId!;

    const contracts = await queryWithTenant(
      tenantId,
      `SELECT sc.*,
        acc.data->>'Name' as account_name,
        sla.name as sla_policy_name,
        sla.first_response_hours,
        sla.resolution_hours_high,
        sla.resolution_hours_medium,
        sla.resolution_hours_low
       FROM service_contracts sc
       LEFT JOIN object_data acc ON sc.account_id = acc.record_id
       LEFT JOIN sla_policies sla ON sc.sla_policy_id = sla.sla_policy_id
       WHERE sc.service_contract_id = $1`,
      [contractId]
    );

    if (contracts.length === 0) {
      return res.status(404).json({ success: false, error: 'Service contract not found' });
    }

    res.json({ success: true, data: contracts[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create service contract
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      account_id,
      contract_name,
      start_date,
      end_date,
      contract_term_months,
      sla_policy_id,
      support_level,
      status = 'Draft'
    } = req.body;

    if (!contract_name || !start_date) {
      return res.status(400).json({ success: false, error: 'Contract name and start date are required' });
    }

    // Generate contract number
    const count = await queryWithTenant<{count: string}>(
      tenantId,
      'SELECT COUNT(*) as count FROM service_contracts WHERE tenant_id = $1',
      [tenantId]
    );
    const contract_number = `SC-${String(parseInt(count[0].count) + 1).padStart(5, '0')}`;

    const contracts = await queryWithTenant(
      tenantId,
      `INSERT INTO service_contracts (
        tenant_id, contract_number, account_id, contract_name,
        start_date, end_date, contract_term_months,
        sla_policy_id, support_level, status,
        owner_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $11)
      RETURNING *`,
      [
        tenantId, contract_number, account_id, contract_name,
        start_date, end_date, contract_term_months,
        sla_policy_id, support_level, status, userId
      ]
    );

    res.status(201).json({ success: true, data: contracts[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update service contract
router.put('/:contractId', async (req: AuthRequest, res: Response) => {
  try {
    const { contractId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const updates = req.body;

    const contracts = await queryWithTenant(
      tenantId,
      `UPDATE service_contracts SET
        contract_name = COALESCE($1, contract_name),
        account_id = COALESCE($2, account_id),
        start_date = COALESCE($3, start_date),
        end_date = COALESCE($4, end_date),
        contract_term_months = COALESCE($5, contract_term_months),
        sla_policy_id = COALESCE($6, sla_policy_id),
        support_level = COALESCE($7, support_level),
        status = COALESCE($8, status),
        modified_by = $9,
        modified_date = CURRENT_TIMESTAMP
       WHERE service_contract_id = $10
       RETURNING *`,
      [
        updates.contract_name, updates.account_id, updates.start_date,
        updates.end_date, updates.contract_term_months, updates.sla_policy_id,
        updates.support_level, updates.status, userId, contractId
      ]
    );

    if (contracts.length === 0) {
      return res.status(404).json({ success: false, error: 'Service contract not found' });
    }

    res.json({ success: true, data: contracts[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Activate service contract
router.post('/:contractId/activate', async (req: AuthRequest, res: Response) => {
  try {
    const { contractId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const contracts = await queryWithTenant(
      tenantId,
      `UPDATE service_contracts SET
        status = 'Active',
        modified_by = $1,
        modified_date = CURRENT_TIMESTAMP
       WHERE service_contract_id = $2
       RETURNING *`,
      [userId, contractId]
    );

    if (contracts.length === 0) {
      return res.status(404).json({ success: false, error: 'Service contract not found' });
    }

    res.json({ success: true, data: contracts[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Expire service contract
router.post('/:contractId/expire', async (req: AuthRequest, res: Response) => {
  try {
    const { contractId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const contracts = await queryWithTenant(
      tenantId,
      `UPDATE service_contracts SET
        status = 'Expired',
        modified_by = $1,
        modified_date = CURRENT_TIMESTAMP
       WHERE service_contract_id = $2
       RETURNING *`,
      [userId, contractId]
    );

    if (contracts.length === 0) {
      return res.status(404).json({ success: false, error: 'Service contract not found' });
    }

    res.json({ success: true, data: contracts[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete service contract
router.delete('/:contractId', async (req: AuthRequest, res: Response) => {
  try {
    const { contractId } = req.params;
    const tenantId = req.tenantId!;

    await queryWithTenant(
      tenantId,
      'DELETE FROM service_contracts WHERE service_contract_id = $1',
      [contractId]
    );

    res.json({ success: true, message: 'Service contract deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
