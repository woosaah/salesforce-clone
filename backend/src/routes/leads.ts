import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all leads
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 50, offset = 0, status, rating } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND l.status = $' + (params.length + 1);
      params.push(status);
    }
    if (rating) {
      whereClause += ' AND l.rating = $' + (params.length + 1);
      params.push(rating);
    }

    const leads = await queryWithTenant(
      tenantId,
      `SELECT l.*, ls.total_score, ls.grade
       FROM leads l
       LEFT JOIN lead_scores ls ON l.lead_id = ls.lead_id
       WHERE 1=1 ${whereClause}
       ORDER BY l.created_date DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({ success: true, data: { leads, total: leads.length } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single lead
router.get('/:leadId', async (req: AuthRequest, res: Response) => {
  try {
    const { leadId } = req.params;
    const tenantId = req.tenantId!;

    const leads = await queryWithTenant(
      tenantId,
      `SELECT l.*, ls.total_score, ls.grade, ls.score_breakdown
       FROM leads l
       LEFT JOIN lead_scores ls ON l.lead_id = ls.lead_id
       WHERE l.lead_id = $1`,
      [leadId]
    );

    if (leads.length === 0) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    res.json({ success: true, data: leads[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create lead
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const { first_name, last_name, company, email, phone, status = 'New', rating, lead_source } = req.body;

    if (!last_name || !company) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const count = await queryWithTenant<{count: string}>(
      tenantId,
      'SELECT COUNT(*) as count FROM leads WHERE tenant_id = $1',
      [tenantId]
    );
    const lead_number = `LEAD-${String(parseInt(count[0].count) + 1).padStart(5, '0')}`;

    const leads = await queryWithTenant(
      tenantId,
      `INSERT INTO leads (
        tenant_id, lead_number, first_name, last_name, company,
        email, phone, status, rating, lead_source,
        owner_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $11)
      RETURNING *`,
      [tenantId, lead_number, first_name, last_name, company, email, phone, status, rating, lead_source, userId]
    );

    res.status(201).json({ success: true, data: leads[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Convert lead
router.post('/:leadId/convert', async (req: AuthRequest, res: Response) => {
  try {
    const { leadId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const { create_opportunity, opportunity_name, opportunity_amount } = req.body;

    const leads = await queryWithTenant(tenantId, 'SELECT * FROM leads WHERE lead_id = $1', [leadId]);
    if (leads.length === 0) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }
    const lead = leads[0];

    // Create Account
    const accounts = await queryWithTenant(
      tenantId,
      `INSERT INTO object_data (tenant_id, object_name, data, owner_id, created_by, modified_by)
       VALUES ($1, 'Account', $2, $3, $3, $3) RETURNING record_id`,
      [tenantId, JSON.stringify({ Name: lead.company }), userId]
    );
    const account_id = accounts[0].record_id;

    // Create Contact
    const contacts = await queryWithTenant(
      tenantId,
      `INSERT INTO object_data (tenant_id, object_name, data, owner_id, created_by, modified_by)
       VALUES ($1, 'Contact', $2, $3, $3, $3) RETURNING record_id`,
      [tenantId, JSON.stringify({ FirstName: lead.first_name, LastName: lead.last_name, Email: lead.email, AccountId: account_id }), userId]
    );
    const contact_id = contacts[0].record_id;

    let opportunity_id = null;
    if (create_opportunity) {
      const opp_count = await queryWithTenant<{count: string}>(
        tenantId,
        'SELECT COUNT(*) as count FROM opportunities WHERE tenant_id = $1',
        [tenantId]
      );
      const opp_number = `OPP-${String(parseInt(opp_count[0].count) + 1).padStart(5, '0')}`;

      const opps = await queryWithTenant(
        tenantId,
        `INSERT INTO opportunities (
          tenant_id, opportunity_number, opportunity_name, account_id, contact_id,
          amount, close_date, stage_name, probability,
          owner_id, created_by, modified_by
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE + INTERVAL '30 days', 'Prospecting', 10, $7, $7, $7)
        RETURNING opportunity_id`,
        [tenantId, opp_number, opportunity_name || `${lead.company} Opportunity`, account_id, contact_id, opportunity_amount || 0, userId]
      );
      opportunity_id = opps[0].opportunity_id;
    }

    // Update lead
    await queryWithTenant(
      tenantId,
      `UPDATE leads SET
        is_converted = true, converted_date = CURRENT_TIMESTAMP, status = 'Converted',
        converted_account_id = $1, converted_contact_id = $2, converted_opportunity_id = $3
       WHERE lead_id = $4`,
      [account_id, contact_id, opportunity_id, leadId]
    );

    res.json({ success: true, data: { account_id, contact_id, opportunity_id } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
