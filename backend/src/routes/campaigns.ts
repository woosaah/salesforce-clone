import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all campaigns
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, campaign_type, owner_id } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND c.status = $' + (params.length + 1);
      params.push(status);
    }
    if (campaign_type) {
      whereClause += ' AND c.campaign_type = $' + (params.length + 1);
      params.push(campaign_type);
    }
    if (owner_id) {
      whereClause += ' AND c.owner_id = $' + (params.length + 1);
      params.push(owner_id);
    }

    const campaigns = await queryWithTenant(
      tenantId,
      `SELECT c.*,
        u.first_name || ' ' || u.last_name as owner_name,
        (SELECT COUNT(*) FROM campaign_members cm WHERE cm.campaign_id = c.campaign_id) as member_count,
        (SELECT COUNT(*) FROM campaign_members cm WHERE cm.campaign_id = c.campaign_id AND cm.has_responded = true) as response_count
       FROM campaigns c
       LEFT JOIN users u ON c.owner_id = u.user_id
       WHERE 1=1 ${whereClause}
       ORDER BY c.created_date DESC`,
      params
    );

    res.json({ success: true, data: campaigns });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single campaign
router.get('/:campaignId', async (req: AuthRequest, res: Response) => {
  try {
    const { campaignId } = req.params;
    const tenantId = req.tenantId!;

    const campaigns = await queryWithTenant(
      tenantId,
      `SELECT c.*,
        u.first_name || ' ' || u.last_name as owner_name,
        (SELECT COUNT(*) FROM campaign_members cm WHERE cm.campaign_id = c.campaign_id) as member_count,
        (SELECT COUNT(*) FROM campaign_members cm WHERE cm.campaign_id = c.campaign_id AND cm.has_responded = true) as response_count,
        (SELECT COUNT(*) FROM campaign_members cm WHERE cm.campaign_id = c.campaign_id AND cm.status = 'Converted') as conversion_count
       FROM campaigns c
       LEFT JOIN users u ON c.owner_id = u.user_id
       WHERE c.campaign_id = $1`,
      [campaignId]
    );

    if (campaigns.length === 0) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    res.json({ success: true, data: campaigns[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create campaign
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      campaign_name,
      campaign_type = 'Email',
      status = 'Planned',
      start_date,
      end_date,
      budgeted_cost = 0,
      expected_revenue = 0,
      description,
      owner_id
    } = req.body;

    if (!campaign_name) {
      return res.status(400).json({ success: false, error: 'Campaign name is required' });
    }

    const campaigns = await queryWithTenant(
      tenantId,
      `INSERT INTO campaigns (
        tenant_id, campaign_name, campaign_type, status, start_date, end_date,
        budgeted_cost, expected_revenue, description, owner_id,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
      RETURNING *`,
      [
        tenantId, campaign_name, campaign_type, status, start_date, end_date,
        budgeted_cost, expected_revenue, description, owner_id || userId, userId
      ]
    );

    res.status(201).json({ success: true, data: campaigns[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update campaign
router.put('/:campaignId', async (req: AuthRequest, res: Response) => {
  try {
    const { campaignId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const updates = req.body;

    const campaigns = await queryWithTenant(
      tenantId,
      `UPDATE campaigns SET
        campaign_name = COALESCE($1, campaign_name),
        campaign_type = COALESCE($2, campaign_type),
        status = COALESCE($3, status),
        start_date = COALESCE($4, start_date),
        end_date = COALESCE($5, end_date),
        budgeted_cost = COALESCE($6, budgeted_cost),
        actual_cost = COALESCE($7, actual_cost),
        expected_revenue = COALESCE($8, expected_revenue),
        actual_revenue = COALESCE($9, actual_revenue),
        description = COALESCE($10, description),
        owner_id = COALESCE($11, owner_id),
        modified_by = $12,
        modified_date = CURRENT_TIMESTAMP
       WHERE campaign_id = $13
       RETURNING *`,
      [
        updates.campaign_name, updates.campaign_type, updates.status,
        updates.start_date, updates.end_date, updates.budgeted_cost,
        updates.actual_cost, updates.expected_revenue, updates.actual_revenue,
        updates.description, updates.owner_id, userId, campaignId
      ]
    );

    if (campaigns.length === 0) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    res.json({ success: true, data: campaigns[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete campaign
router.delete('/:campaignId', async (req: AuthRequest, res: Response) => {
  try {
    const { campaignId } = req.params;
    const tenantId = req.tenantId!;

    const result = await queryWithTenant(
      tenantId,
      'DELETE FROM campaigns WHERE campaign_id = $1 RETURNING campaign_id',
      [campaignId]
    );

    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    res.json({ success: true, message: 'Campaign deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get campaign members
router.get('/:campaignId/members', async (req: AuthRequest, res: Response) => {
  try {
    const { campaignId } = req.params;
    const { status } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = ' AND cm.campaign_id = $1';
    const params: any[] = [campaignId];

    if (status) {
      whereClause += ' AND cm.status = $' + (params.length + 1);
      params.push(status);
    }

    const members = await queryWithTenant(
      tenantId,
      `SELECT cm.*,
        CASE
          WHEN cm.lead_id IS NOT NULL THEN (SELECT data->>'firstName' || ' ' || data->>'lastName' FROM object_data WHERE object_id = cm.lead_id)
          WHEN cm.contact_id IS NOT NULL THEN (SELECT data->>'firstName' || ' ' || data->>'lastName' FROM object_data WHERE object_id = cm.contact_id)
        END as member_name,
        CASE
          WHEN cm.lead_id IS NOT NULL THEN (SELECT data->>'email' FROM object_data WHERE object_id = cm.lead_id)
          WHEN cm.contact_id IS NOT NULL THEN (SELECT data->>'email' FROM object_data WHERE object_id = cm.contact_id)
        END as member_email
       FROM campaign_members cm
       WHERE 1=1 ${whereClause}
       ORDER BY cm.created_date DESC`,
      params
    );

    res.json({ success: true, data: members });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add member to campaign
router.post('/:campaignId/members', async (req: AuthRequest, res: Response) => {
  try {
    const { campaignId } = req.params;
    const tenantId = req.tenantId!;
    const {
      lead_id,
      contact_id,
      status = 'Sent',
      notes
    } = req.body;

    if (!lead_id && !contact_id) {
      return res.status(400).json({ success: false, error: 'Either lead_id or contact_id is required' });
    }

    const members = await queryWithTenant(
      tenantId,
      `INSERT INTO campaign_members (
        tenant_id, campaign_id, lead_id, contact_id, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [tenantId, campaignId, lead_id, contact_id, status, notes]
    );

    res.status(201).json({ success: true, data: members[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update campaign member
router.put('/:campaignId/members/:memberId', async (req: AuthRequest, res: Response) => {
  try {
    const { campaignId, memberId } = req.params;
    const tenantId = req.tenantId!;
    const updates = req.body;

    const members = await queryWithTenant(
      tenantId,
      `UPDATE campaign_members SET
        status = COALESCE($1, status),
        has_responded = COALESCE($2, has_responded),
        first_responded_date = COALESCE($3, first_responded_date),
        notes = COALESCE($4, notes)
       WHERE member_id = $5 AND campaign_id = $6
       RETURNING *`,
      [
        updates.status, updates.has_responded, updates.first_responded_date,
        updates.notes, memberId, campaignId
      ]
    );

    if (members.length === 0) {
      return res.status(404).json({ success: false, error: 'Campaign member not found' });
    }

    res.json({ success: true, data: members[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove member from campaign
router.delete('/:campaignId/members/:memberId', async (req: AuthRequest, res: Response) => {
  try {
    const { campaignId, memberId } = req.params;
    const tenantId = req.tenantId!;

    const result = await queryWithTenant(
      tenantId,
      'DELETE FROM campaign_members WHERE member_id = $1 AND campaign_id = $2 RETURNING member_id',
      [memberId, campaignId]
    );

    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Campaign member not found' });
    }

    res.json({ success: true, message: 'Campaign member removed' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get campaign ROI
router.get('/:campaignId/roi', async (req: AuthRequest, res: Response) => {
  try {
    const { campaignId } = req.params;
    const tenantId = req.tenantId!;

    const campaigns = await queryWithTenant(
      tenantId,
      `SELECT
        campaign_id,
        campaign_name,
        budgeted_cost,
        actual_cost,
        expected_revenue,
        actual_revenue,
        CASE WHEN actual_cost > 0 THEN ((actual_revenue - actual_cost) / actual_cost * 100) ELSE 0 END as roi_percentage,
        (actual_revenue - actual_cost) as net_profit,
        (SELECT COUNT(*) FROM campaign_members WHERE campaign_id = $1) as total_members,
        (SELECT COUNT(*) FROM campaign_members WHERE campaign_id = $1 AND has_responded = true) as responded_members,
        (SELECT COUNT(*) FROM campaign_members WHERE campaign_id = $1 AND status = 'Converted') as converted_members
       FROM campaigns
       WHERE campaign_id = $1`,
      [campaignId]
    );

    if (campaigns.length === 0) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const campaign = campaigns[0];
    const responseRate = campaign.total_members > 0
      ? (campaign.responded_members / campaign.total_members * 100).toFixed(2)
      : 0;
    const conversionRate = campaign.total_members > 0
      ? (campaign.converted_members / campaign.total_members * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      data: {
        ...campaign,
        response_rate: responseRate,
        conversion_rate: conversionRate
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
