import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/email-to-case/settings
 * Get email-to-case settings
 */
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const settings = await queryWithTenant(
      `SELECT * FROM email_to_case_settings LIMIT 1`,
      []
    );

    res.json({
      success: true,
      data: settings.length > 0 ? settings[0] : null,
    });
  } catch (error: any) {
    console.error('Error fetching email-to-case settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings',
      error: error.message,
    });
  }
});

/**
 * POST /api/email-to-case/settings
 * Create or update email-to-case settings
 */
router.post('/settings', async (req: Request, res: Response) => {
  try {
    const {
      is_enabled,
      routing_address,
      default_owner_id,
      default_priority,
      auto_response_template_id,
      thread_matching,
    } = req.body;

    // Check if settings exist
    const existing = await queryWithTenant(
      `SELECT * FROM email_to_case_settings LIMIT 1`,
      []
    );

    let result;
    if (existing.length > 0) {
      // Update
      result = await queryWithTenant(
        `UPDATE email_to_case_settings SET
          is_enabled = $1,
          routing_address = $2,
          default_owner_id = $3,
          default_priority = $4,
          auto_response_template_id = $5,
          thread_matching = $6
         WHERE settings_id = $7
         RETURNING *`,
        [
          is_enabled !== false,
          routing_address,
          default_owner_id,
          default_priority,
          auto_response_template_id,
          thread_matching !== false,
          existing[0].settings_id,
        ]
      );
    } else {
      // Create
      result = await queryWithTenant(
        `INSERT INTO email_to_case_settings (
          is_enabled,
          routing_address,
          default_owner_id,
          default_priority,
          auto_response_template_id,
          thread_matching
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          is_enabled !== false,
          routing_address,
          default_owner_id,
          default_priority,
          auto_response_template_id,
          thread_matching !== false,
        ]
      );
    }

    res.json({
      success: true,
      message: 'Settings saved successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error saving settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save settings',
      error: error.message,
    });
  }
});

/**
 * POST /api/email-to-case/process
 * Process an incoming email and create a case
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    const {
      from_address,
      subject,
      body,
      cc_addresses,
      attachments,
      message_id,
      in_reply_to,
    } = req.body;

    if (!from_address || !subject) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: from_address, subject',
      });
    }

    // Get settings
    const settings = await queryWithTenant(
      `SELECT * FROM email_to_case_settings WHERE is_enabled = true LIMIT 1`,
      []
    );

    if (settings.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Email-to-Case is not enabled',
      });
    }

    const config = settings[0];

    // Check for existing thread if thread matching is enabled
    let caseId = null;
    if (config.thread_matching && in_reply_to) {
      const threads = await queryWithTenant(
        `SELECT et.case_id
         FROM email_threads et
         WHERE et.message_id = $1 OR et.references LIKE $2
         LIMIT 1`,
        [in_reply_to, `%${in_reply_to}%`]
      );

      if (threads.length > 0) {
        caseId = threads[0].case_id;
      }
    }

    // Create new case if no thread found
    if (!caseId) {
      // Find or create contact
      let contactId = null;
      const contacts = await queryWithTenant(
        `SELECT od.record_id
         FROM object_data od
         JOIN objects_meta om ON od.object_id = om.object_id
         WHERE om.object_name = 'Contact'
           AND od.data->>'email' = $1
         LIMIT 1`,
        [from_address]
      );

      if (contacts.length > 0) {
        contactId = contacts[0].record_id;
      }

      // Create case
      const caseObject = await queryWithTenant(
        `SELECT object_id FROM objects_meta WHERE object_name = 'Case' LIMIT 1`,
        []
      );

      if (caseObject.length > 0) {
        const caseData = {
          subject,
          description: body,
          status: 'New',
          priority: config.default_priority || 'Medium',
          origin: 'Email',
          contact_id: contactId,
          owner_id: config.default_owner_id,
        };

        const newCase = await queryWithTenant(
          `INSERT INTO object_data (object_id, data)
           VALUES ($1, $2)
           RETURNING record_id`,
          [caseObject[0].object_id, JSON.stringify(caseData)]
        );

        caseId = newCase[0].record_id;
      }
    }

    // Create email thread entry
    if (caseId) {
      await queryWithTenant(
        `INSERT INTO email_threads (
          case_id,
          message_id,
          subject,
          from_address,
          to_address,
          cc_addresses,
          body,
          is_incoming,
          references
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          caseId,
          message_id,
          subject,
          from_address,
          config.routing_address,
          JSON.stringify(cc_addresses || []),
          body,
          true,
          in_reply_to || '',
        ]
      );

      // Send auto-response if configured
      if (config.auto_response_template_id) {
        // Auto-response logic here
      }
    }

    res.status(201).json({
      success: true,
      message: 'Email processed successfully',
      case_id: caseId,
    });
  } catch (error: any) {
    console.error('Error processing email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process email',
      error: error.message,
    });
  }
});

/**
 * GET /api/email-to-case/threads/:caseId
 * Get email thread for a case
 */
router.get('/threads/:caseId', async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;

    const threads = await queryWithTenant(
      `SELECT * FROM email_threads
       WHERE case_id = $1
       ORDER BY received_date ASC`,
      [caseId]
    );

    res.json({
      success: true,
      data: threads,
    });
  } catch (error: any) {
    console.error('Error fetching email thread:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email thread',
      error: error.message,
    });
  }
});

export default router;
