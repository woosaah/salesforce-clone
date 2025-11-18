import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all subscriptions for a report
router.get('/report/:reportId', async (req: AuthRequest, res: Response) => {
  try {
    const { reportId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const subscriptions = await queryWithTenant(
      tenantId,
      `SELECT rs.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        r.report_name
       FROM report_subscriptions rs
       LEFT JOIN users u ON rs.created_by = u.user_id
       LEFT JOIN reports r ON rs.report_id = r.report_id
       WHERE rs.report_id = $1 AND rs.created_by = $2
       ORDER BY rs.created_date DESC`,
      [reportId, userId]
    );

    res.json({ success: true, data: subscriptions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all subscriptions for current user
router.get('/my', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const subscriptions = await queryWithTenant(
      tenantId,
      `SELECT rs.*,
        r.report_name,
        r.object_name
       FROM report_subscriptions rs
       LEFT JOIN reports r ON rs.report_id = r.report_id
       WHERE rs.created_by = $1
       ORDER BY rs.created_date DESC`,
      [userId]
    );

    res.json({ success: true, data: subscriptions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single subscription
router.get('/:subscriptionId', async (req: AuthRequest, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const subscriptions = await queryWithTenant(
      tenantId,
      `SELECT rs.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        r.report_name
       FROM report_subscriptions rs
       LEFT JOIN users u ON rs.created_by = u.user_id
       LEFT JOIN reports r ON rs.report_id = r.report_id
       WHERE rs.subscription_id = $1 AND rs.created_by = $2`,
      [subscriptionId, userId]
    );

    if (subscriptions.length === 0) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    res.json({ success: true, data: subscriptions[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create subscription
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      report_id,
      subscription_name,
      schedule_frequency,
      schedule_config,
      export_format = 'PDF',
      recipients,
      is_active = true
    } = req.body;

    if (!report_id || !subscription_name || !schedule_frequency) {
      return res.status(400).json({
        success: false,
        error: 'Report ID, subscription name, and schedule frequency are required'
      });
    }

    // Verify report exists and user has access
    const reports = await queryWithTenant(
      tenantId,
      'SELECT report_id FROM reports WHERE report_id = $1 AND (created_by = $2 OR is_public = true)',
      [report_id, userId]
    );

    if (reports.length === 0) {
      return res.status(404).json({ success: false, error: 'Report not found or no access' });
    }

    const subscriptions = await queryWithTenant(
      tenantId,
      `INSERT INTO report_subscriptions (
        tenant_id, report_id, subscription_name, schedule_frequency,
        schedule_config, export_format, recipients, is_active,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
      RETURNING *`,
      [
        tenantId, report_id, subscription_name, schedule_frequency,
        schedule_config ? JSON.stringify(schedule_config) : null,
        export_format,
        recipients ? JSON.stringify(recipients) : null,
        is_active, userId
      ]
    );

    res.status(201).json({ success: true, data: subscriptions[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update subscription
router.put('/:subscriptionId', async (req: AuthRequest, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const updates = req.body;

    // Check ownership
    const existing = await queryWithTenant(
      tenantId,
      'SELECT created_by FROM report_subscriptions WHERE subscription_id = $1',
      [subscriptionId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    if (existing[0].created_by !== userId) {
      return res.status(403).json({ success: false, error: 'You can only update your own subscriptions' });
    }

    const subscriptions = await queryWithTenant(
      tenantId,
      `UPDATE report_subscriptions SET
        subscription_name = COALESCE($1, subscription_name),
        schedule_frequency = COALESCE($2, schedule_frequency),
        schedule_config = COALESCE($3, schedule_config),
        export_format = COALESCE($4, export_format),
        recipients = COALESCE($5, recipients),
        is_active = COALESCE($6, is_active),
        modified_by = $7,
        modified_date = CURRENT_TIMESTAMP
       WHERE subscription_id = $8
       RETURNING *`,
      [
        updates.subscription_name,
        updates.schedule_frequency,
        updates.schedule_config ? JSON.stringify(updates.schedule_config) : null,
        updates.export_format,
        updates.recipients ? JSON.stringify(updates.recipients) : null,
        updates.is_active,
        userId,
        subscriptionId
      ]
    );

    res.json({ success: true, data: subscriptions[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete subscription
router.delete('/:subscriptionId', async (req: AuthRequest, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    // Check ownership
    const existing = await queryWithTenant(
      tenantId,
      'SELECT created_by FROM report_subscriptions WHERE subscription_id = $1',
      [subscriptionId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    if (existing[0].created_by !== userId) {
      return res.status(403).json({ success: false, error: 'You can only delete your own subscriptions' });
    }

    await queryWithTenant(
      tenantId,
      'DELETE FROM report_subscriptions WHERE subscription_id = $1',
      [subscriptionId]
    );

    res.json({ success: true, message: 'Subscription deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Activate/deactivate subscription
router.patch('/:subscriptionId/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    // Check ownership
    const existing = await queryWithTenant(
      tenantId,
      'SELECT created_by, is_active FROM report_subscriptions WHERE subscription_id = $1',
      [subscriptionId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    if (existing[0].created_by !== userId) {
      return res.status(403).json({ success: false, error: 'You can only toggle your own subscriptions' });
    }

    const newStatus = !existing[0].is_active;

    const subscriptions = await queryWithTenant(
      tenantId,
      `UPDATE report_subscriptions SET
        is_active = $1,
        modified_by = $2,
        modified_date = CURRENT_TIMESTAMP
       WHERE subscription_id = $3
       RETURNING *`,
      [newStatus, userId, subscriptionId]
    );

    res.json({
      success: true,
      data: subscriptions[0],
      message: `Subscription ${newStatus ? 'activated' : 'deactivated'}`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update last run time (internal use)
router.patch('/:subscriptionId/run', async (req: AuthRequest, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const tenantId = req.tenantId!;

    await queryWithTenant(
      tenantId,
      'UPDATE report_subscriptions SET last_run_date = CURRENT_TIMESTAMP WHERE subscription_id = $1',
      [subscriptionId]
    );

    res.json({ success: true, message: 'Last run date updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
