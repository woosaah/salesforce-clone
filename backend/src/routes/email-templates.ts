import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all email templates
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { is_active, template_type } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (is_active !== undefined) {
      whereClause += ' AND is_active = $' + (params.length + 1);
      params.push(is_active === 'true');
    }
    if (template_type) {
      whereClause += ' AND template_type = $' + (params.length + 1);
      params.push(template_type);
    }

    const templates = await queryWithTenant(
      tenantId,
      `SELECT * FROM email_templates
       WHERE 1=1 ${whereClause}
       ORDER BY template_name`,
      params
    );

    res.json({ success: true, data: templates });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single email template
router.get('/:templateId', async (req: AuthRequest, res: Response) => {
  try {
    const { templateId } = req.params;
    const tenantId = req.tenantId!;

    const templates = await queryWithTenant(
      tenantId,
      'SELECT * FROM email_templates WHERE template_id = $1',
      [templateId]
    );

    if (templates.length === 0) {
      return res.status(404).json({ success: false, error: 'Email template not found' });
    }

    res.json({ success: true, data: templates[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create email template
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      template_name,
      subject,
      body_html,
      body_text,
      template_type = 'Alert',
      is_active = true,
      available_merge_fields
    } = req.body;

    if (!template_name || !subject) {
      return res.status(400).json({ success: false, error: 'Template name and subject are required' });
    }

    const templates = await queryWithTenant(
      tenantId,
      `INSERT INTO email_templates (
        tenant_id, template_name, subject, body_html, body_text,
        template_type, is_active, available_merge_fields,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
      RETURNING *`,
      [tenantId, template_name, subject, body_html, body_text, template_type, is_active, available_merge_fields, userId]
    );

    res.status(201).json({ success: true, data: templates[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update email template
router.put('/:templateId', async (req: AuthRequest, res: Response) => {
  try {
    const { templateId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const updates = req.body;

    const templates = await queryWithTenant(
      tenantId,
      `UPDATE email_templates SET
        template_name = COALESCE($1, template_name),
        subject = COALESCE($2, subject),
        body_html = COALESCE($3, body_html),
        body_text = COALESCE($4, body_text),
        template_type = COALESCE($5, template_type),
        is_active = COALESCE($6, is_active),
        available_merge_fields = COALESCE($7, available_merge_fields),
        modified_by = $8,
        modified_date = CURRENT_TIMESTAMP
       WHERE template_id = $9
       RETURNING *`,
      [
        updates.template_name, updates.subject, updates.body_html,
        updates.body_text, updates.template_type, updates.is_active,
        updates.available_merge_fields, userId, templateId
      ]
    );

    if (templates.length === 0) {
      return res.status(404).json({ success: false, error: 'Email template not found' });
    }

    res.json({ success: true, data: templates[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Preview template with merge fields
router.post('/:templateId/preview', async (req: AuthRequest, res: Response) => {
  try {
    const { templateId } = req.params;
    const { sample_data } = req.body;
    const tenantId = req.tenantId!;

    const templates = await queryWithTenant(
      tenantId,
      'SELECT * FROM email_templates WHERE template_id = $1',
      [templateId]
    );

    if (templates.length === 0) {
      return res.status(404).json({ success: false, error: 'Email template not found' });
    }

    const template = templates[0];

    // Simple merge field replacement
    let previewSubject = template.subject;
    let previewBody = template.body_html || template.body_text;

    if (sample_data) {
      Object.keys(sample_data).forEach(key => {
        const regex = new RegExp(`\\{\\{\\{${key}\\}\\}\\}`, 'g');
        previewSubject = previewSubject.replace(regex, sample_data[key]);
        previewBody = previewBody.replace(regex, sample_data[key]);
      });
    }

    res.json({
      success: true,
      data: {
        subject: previewSubject,
        body: previewBody
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete email template
router.delete('/:templateId', async (req: AuthRequest, res: Response) => {
  try {
    const { templateId } = req.params;
    const tenantId = req.tenantId!;

    // Check if template is being used
    const usageCount = await queryWithTenant(
      tenantId,
      'SELECT COUNT(*) as count FROM workflow_email_alerts WHERE template_id = $1',
      [templateId]
    );

    if (parseInt(usageCount[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete template that is in use by workflows'
      });
    }

    await queryWithTenant(
      tenantId,
      'DELETE FROM email_templates WHERE template_id = $1',
      [templateId]
    );

    res.json({ success: true, message: 'Email template deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
