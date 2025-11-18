import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all email campaigns
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { campaign_id, status } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (campaign_id) {
      whereClause += ' AND ec.campaign_id = $' + (params.length + 1);
      params.push(campaign_id);
    }
    if (status) {
      whereClause += ' AND ec.status = $' + (params.length + 1);
      params.push(status);
    }

    const emailCampaigns = await queryWithTenant(
      tenantId,
      `SELECT ec.*,
        c.campaign_name,
        et.template_name,
        u.first_name || ' ' || u.last_name as created_by_name
       FROM email_campaigns ec
       LEFT JOIN campaigns c ON ec.campaign_id = c.campaign_id
       LEFT JOIN email_templates et ON ec.template_id = et.template_id
       LEFT JOIN users u ON ec.created_by = u.user_id
       WHERE 1=1 ${whereClause}
       ORDER BY ec.created_date DESC`,
      params
    );

    res.json({ success: true, data: emailCampaigns });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single email campaign
router.get('/:emailCampaignId', async (req: AuthRequest, res: Response) => {
  try {
    const { emailCampaignId } = req.params;
    const tenantId = req.tenantId!;

    const emailCampaigns = await queryWithTenant(
      tenantId,
      `SELECT ec.*,
        c.campaign_name,
        et.template_name,
        et.html_body,
        u.first_name || ' ' || u.last_name as created_by_name,
        (SELECT COUNT(*) FROM email_analytics ea WHERE ea.email_campaign_id = ec.email_campaign_id) as total_recipients,
        (SELECT COUNT(*) FROM email_analytics ea WHERE ea.email_campaign_id = ec.email_campaign_id AND ea.opened = true) as total_opened,
        (SELECT COUNT(*) FROM email_analytics ea WHERE ea.email_campaign_id = ec.email_campaign_id AND ea.clicked = true) as total_clicked
       FROM email_campaigns ec
       LEFT JOIN campaigns c ON ec.campaign_id = c.campaign_id
       LEFT JOIN email_templates et ON ec.template_id = et.template_id
       LEFT JOIN users u ON ec.created_by = u.user_id
       WHERE ec.email_campaign_id = $1`,
      [emailCampaignId]
    );

    if (emailCampaigns.length === 0) {
      return res.status(404).json({ success: false, error: 'Email campaign not found' });
    }

    res.json({ success: true, data: emailCampaigns[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create email campaign
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      campaign_id,
      template_id,
      subject,
      from_name,
      from_email,
      reply_to_email,
      scheduled_date,
      recipients,
      status = 'Draft'
    } = req.body;

    if (!campaign_id || !subject || !from_name || !from_email) {
      return res.status(400).json({
        success: false,
        error: 'Campaign ID, subject, from name, and from email are required'
      });
    }

    const emailCampaigns = await queryWithTenant(
      tenantId,
      `INSERT INTO email_campaigns (
        tenant_id, campaign_id, template_id, subject, from_name, from_email,
        reply_to_email, scheduled_date, recipients, status,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
      RETURNING *`,
      [
        tenantId, campaign_id, template_id, subject, from_name, from_email,
        reply_to_email, scheduled_date,
        recipients ? JSON.stringify(recipients) : null,
        status, userId
      ]
    );

    res.status(201).json({ success: true, data: emailCampaigns[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update email campaign
router.put('/:emailCampaignId', async (req: AuthRequest, res: Response) => {
  try {
    const { emailCampaignId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const updates = req.body;

    const emailCampaigns = await queryWithTenant(
      tenantId,
      `UPDATE email_campaigns SET
        template_id = COALESCE($1, template_id),
        subject = COALESCE($2, subject),
        from_name = COALESCE($3, from_name),
        from_email = COALESCE($4, from_email),
        reply_to_email = COALESCE($5, reply_to_email),
        scheduled_date = COALESCE($6, scheduled_date),
        recipients = COALESCE($7, recipients),
        status = COALESCE($8, status),
        modified_by = $9,
        modified_date = CURRENT_TIMESTAMP
       WHERE email_campaign_id = $10
       RETURNING *`,
      [
        updates.template_id, updates.subject, updates.from_name,
        updates.from_email, updates.reply_to_email, updates.scheduled_date,
        updates.recipients ? JSON.stringify(updates.recipients) : null,
        updates.status, userId, emailCampaignId
      ]
    );

    if (emailCampaigns.length === 0) {
      return res.status(404).json({ success: false, error: 'Email campaign not found' });
    }

    res.json({ success: true, data: emailCampaigns[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete email campaign
router.delete('/:emailCampaignId', async (req: AuthRequest, res: Response) => {
  try {
    const { emailCampaignId } = req.params;
    const tenantId = req.tenantId!;

    const result = await queryWithTenant(
      tenantId,
      'DELETE FROM email_campaigns WHERE email_campaign_id = $1 RETURNING email_campaign_id',
      [emailCampaignId]
    );

    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Email campaign not found' });
    }

    res.json({ success: true, message: 'Email campaign deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send email campaign
router.post('/:emailCampaignId/send', async (req: AuthRequest, res: Response) => {
  try {
    const { emailCampaignId } = req.params;
    const tenantId = req.tenantId!;

    // Get email campaign details
    const emailCampaigns = await queryWithTenant(
      tenantId,
      `SELECT ec.*, et.html_body, et.text_body
       FROM email_campaigns ec
       LEFT JOIN email_templates et ON ec.template_id = et.template_id
       WHERE ec.email_campaign_id = $1`,
      [emailCampaignId]
    );

    if (emailCampaigns.length === 0) {
      return res.status(404).json({ success: false, error: 'Email campaign not found' });
    }

    const emailCampaign = emailCampaigns[0];

    // Check if already sent
    if (emailCampaign.status === 'Sent') {
      return res.status(400).json({ success: false, error: 'Email campaign already sent' });
    }

    // Get campaign members
    const members = await queryWithTenant(
      tenantId,
      `SELECT cm.*,
        CASE
          WHEN cm.lead_id IS NOT NULL THEN (SELECT data->>'email' FROM object_data WHERE object_id = cm.lead_id)
          WHEN cm.contact_id IS NOT NULL THEN (SELECT data->>'email' FROM object_data WHERE object_id = cm.contact_id)
        END as email,
        CASE
          WHEN cm.lead_id IS NOT NULL THEN 'Lead'
          WHEN cm.contact_id IS NOT NULL THEN 'Contact'
        END as recipient_type,
        COALESCE(cm.lead_id, cm.contact_id) as recipient_id
       FROM campaign_members cm
       WHERE cm.campaign_id = $1`,
      [emailCampaign.campaign_id]
    );

    // Check unsubscribe list
    const unsubscribeList = await queryWithTenant(
      tenantId,
      'SELECT email FROM unsubscribe_list',
      []
    );
    const unsubscribedEmails = new Set(unsubscribeList.map((u: any) => u.email));

    let sentCount = 0;
    let deliveredCount = 0;
    let bouncedCount = 0;

    // Create analytics records for each recipient
    for (const member of members) {
      if (!member.email) continue;
      if (unsubscribedEmails.has(member.email)) continue;

      // In a real implementation, you would send the actual email here
      // For now, we'll just create the analytics record
      const sent = true; // Simulate successful send
      const delivered = Math.random() > 0.05; // 95% delivery rate

      await queryWithTenant(
        tenantId,
        `INSERT INTO email_analytics (
          tenant_id, email_campaign_id, recipient_email, recipient_type,
          recipient_id, sent, sent_date, delivered, delivered_date
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, ${delivered ? 'CURRENT_TIMESTAMP' : 'NULL'})`,
        [
          tenantId, emailCampaignId, member.email, member.recipient_type,
          member.recipient_id, sent, delivered
        ]
      );

      if (sent) sentCount++;
      if (delivered) deliveredCount++;
      if (!delivered) bouncedCount++;
    }

    // Update email campaign stats
    await queryWithTenant(
      tenantId,
      `UPDATE email_campaigns SET
        status = 'Sent',
        sent_date = CURRENT_TIMESTAMP,
        total_sent = $1,
        total_delivered = $2,
        total_bounced = $3
       WHERE email_campaign_id = $4`,
      [sentCount, deliveredCount, bouncedCount, emailCampaignId]
    );

    res.json({
      success: true,
      message: 'Email campaign sent',
      data: {
        total_sent: sentCount,
        total_delivered: deliveredCount,
        total_bounced: bouncedCount
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get email campaign analytics
router.get('/:emailCampaignId/analytics', async (req: AuthRequest, res: Response) => {
  try {
    const { emailCampaignId } = req.params;
    const tenantId = req.tenantId!;

    const analytics = await queryWithTenant(
      tenantId,
      `SELECT ea.*
       FROM email_analytics ea
       WHERE ea.email_campaign_id = $1
       ORDER BY ea.sent_date DESC`,
      [emailCampaignId]
    );

    // Calculate summary stats
    const stats = {
      total_sent: analytics.length,
      total_delivered: analytics.filter((a: any) => a.delivered).length,
      total_opened: analytics.filter((a: any) => a.opened).length,
      total_clicked: analytics.filter((a: any) => a.clicked).length,
      total_bounced: analytics.filter((a: any) => a.bounced).length,
      total_unsubscribed: analytics.filter((a: any) => a.unsubscribed).length,
      open_rate: 0,
      click_rate: 0,
      bounce_rate: 0
    };

    if (stats.total_delivered > 0) {
      stats.open_rate = (stats.total_opened / stats.total_delivered * 100);
      stats.click_rate = (stats.total_clicked / stats.total_delivered * 100);
    }
    if (stats.total_sent > 0) {
      stats.bounce_rate = (stats.total_bounced / stats.total_sent * 100);
    }

    res.json({
      success: true,
      data: {
        stats,
        recipients: analytics
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Track email open
router.post('/:emailCampaignId/track/open/:analyticsId', async (req: AuthRequest, res: Response) => {
  try {
    const { emailCampaignId, analyticsId } = req.params;
    const tenantId = req.tenantId!;

    await queryWithTenant(
      tenantId,
      `UPDATE email_analytics SET
        opened = true,
        opened_date = COALESCE(opened_date, CURRENT_TIMESTAMP),
        open_count = open_count + 1
       WHERE analytics_id = $1 AND email_campaign_id = $2`,
      [analyticsId, emailCampaignId]
    );

    res.json({ success: true, message: 'Open tracked' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Track email click
router.post('/:emailCampaignId/track/click/:analyticsId', async (req: AuthRequest, res: Response) => {
  try {
    const { emailCampaignId, analyticsId } = req.params;
    const tenantId = req.tenantId!;

    await queryWithTenant(
      tenantId,
      `UPDATE email_analytics SET
        clicked = true,
        clicked_date = COALESCE(clicked_date, CURRENT_TIMESTAMP),
        click_count = click_count + 1
       WHERE analytics_id = $1 AND email_campaign_id = $2`,
      [analyticsId, emailCampaignId]
    );

    res.json({ success: true, message: 'Click tracked' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unsubscribe
router.post('/unsubscribe', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { email, reason } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    // Add to unsubscribe list
    await queryWithTenant(
      tenantId,
      'INSERT INTO unsubscribe_list (tenant_id, email, reason) VALUES ($1, $2, $3) ON CONFLICT (tenant_id, email) DO NOTHING',
      [tenantId, email, reason]
    );

    // Update analytics for this email
    await queryWithTenant(
      tenantId,
      `UPDATE email_analytics SET
        unsubscribed = true,
        unsubscribed_date = CURRENT_TIMESTAMP
       WHERE recipient_email = $1`,
      [email]
    );

    res.json({ success: true, message: 'Email unsubscribed' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
