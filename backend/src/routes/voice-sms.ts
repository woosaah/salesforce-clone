import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/voice-sms/calls
 * Get voice call records
 */
router.get('/calls', async (req: Request, res: Response) => {
  try {
    const { status, direction, agent_id } = req.query;

    let query = `SELECT * FROM voice_calls WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (direction) {
      query += ` AND direction = $${paramIndex}`;
      params.push(direction);
      paramIndex++;
    }

    if (agent_id) {
      query += ` AND agent_id = $${paramIndex}`;
      params.push(agent_id);
      paramIndex++;
    }

    query += ` ORDER BY call_start_time DESC LIMIT 100`;

    const calls = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: calls,
    });
  } catch (error: any) {
    console.error('Error fetching voice calls:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch voice calls',
      error: error.message,
    });
  }
});

/**
 * GET /api/voice-sms/calls/:id
 * Get a specific voice call
 */
router.get('/calls/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const calls = await queryWithTenant(
      `SELECT * FROM voice_calls WHERE call_id = $1`,
      [id]
    );

    if (calls.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Voice call not found',
      });
    }

    res.json({
      success: true,
      data: calls[0],
    });
  } catch (error: any) {
    console.error('Error fetching voice call:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch voice call',
      error: error.message,
    });
  }
});

/**
 * POST /api/voice-sms/calls
 * Create a voice call record
 */
router.post('/calls', async (req: Request, res: Response) => {
  try {
    const {
      from_number,
      to_number,
      direction,
      related_to_id,
      related_to_type,
      agent_id,
    } = req.body;

    if (!from_number || !to_number || !direction) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: from_number, to_number, direction',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO voice_calls (
        from_number,
        to_number,
        direction,
        related_to_id,
        related_to_type,
        agent_id,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [from_number, to_number, direction, related_to_id, related_to_type, agent_id, 'Initiated']
    );

    res.status(201).json({
      success: true,
      message: 'Voice call created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating voice call:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create voice call',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/voice-sms/calls/:id
 * Update a voice call record
 */
router.patch('/calls/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['status', 'call_end_time', 'duration_seconds', 'recording_url', 'notes'];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    });

    if (setFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    values.push(id);

    const result = await queryWithTenant(
      `UPDATE voice_calls SET ${setFields.join(', ')}
       WHERE call_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Voice call not found',
      });
    }

    res.json({
      success: true,
      message: 'Voice call updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating voice call:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update voice call',
      error: error.message,
    });
  }
});

/**
 * GET /api/voice-sms/sms
 * Get SMS messages
 */
router.get('/sms', async (req: Request, res: Response) => {
  try {
    const { status, direction, phone_number } = req.query;

    let query = `SELECT * FROM sms_messages WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (direction) {
      query += ` AND direction = $${paramIndex}`;
      params.push(direction);
      paramIndex++;
    }

    if (phone_number) {
      query += ` AND (from_number = $${paramIndex} OR to_number = $${paramIndex})`;
      params.push(phone_number);
      paramIndex++;
    }

    query += ` ORDER BY sent_at DESC LIMIT 100`;

    const messages = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: messages,
    });
  } catch (error: any) {
    console.error('Error fetching SMS messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SMS messages',
      error: error.message,
    });
  }
});

/**
 * GET /api/voice-sms/sms/:id
 * Get a specific SMS message
 */
router.get('/sms/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const messages = await queryWithTenant(
      `SELECT * FROM sms_messages WHERE message_id = $1`,
      [id]
    );

    if (messages.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'SMS message not found',
      });
    }

    res.json({
      success: true,
      data: messages[0],
    });
  } catch (error: any) {
    console.error('Error fetching SMS message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SMS message',
      error: error.message,
    });
  }
});

/**
 * POST /api/voice-sms/sms
 * Send an SMS message
 */
router.post('/sms', async (req: Request, res: Response) => {
  try {
    const {
      from_number,
      to_number,
      message_body,
      related_to_id,
      related_to_type,
    } = req.body;

    if (!from_number || !to_number || !message_body) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: from_number, to_number, message_body',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO sms_messages (
        from_number,
        to_number,
        message_body,
        direction,
        related_to_id,
        related_to_type,
        sent_by,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        from_number,
        to_number,
        message_body,
        'Outbound',
        related_to_id,
        related_to_type,
        (req as any).user.userId,
        'Sent',
      ]
    );

    // In real implementation, would send via SMS gateway here

    res.status(201).json({
      success: true,
      message: 'SMS sent successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error sending SMS:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send SMS',
      error: error.message,
    });
  }
});

/**
 * POST /api/voice-sms/sms/receive
 * Receive an incoming SMS (webhook endpoint)
 */
router.post('/sms/receive', async (req: Request, res: Response) => {
  try {
    const { from_number, to_number, message_body, external_id } = req.body;

    if (!from_number || !to_number || !message_body) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: from_number, to_number, message_body',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO sms_messages (
        from_number,
        to_number,
        message_body,
        direction,
        external_message_id,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [from_number, to_number, message_body, 'Inbound', external_id, 'Received']
    );

    res.json({
      success: true,
      message: 'SMS received successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error receiving SMS:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to receive SMS',
      error: error.message,
    });
  }
});

/**
 * GET /api/voice-sms/phone-numbers
 * Get registered phone numbers
 */
router.get('/phone-numbers', async (req: Request, res: Response) => {
  try {
    const { is_active, capability } = req.query;

    let query = `SELECT * FROM phone_numbers WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (is_active !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }

    if (capability) {
      query += ` AND capabilities::jsonb ? $${paramIndex}`;
      params.push(capability);
      paramIndex++;
    }

    query += ` ORDER BY phone_number`;

    const numbers = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: numbers,
    });
  } catch (error: any) {
    console.error('Error fetching phone numbers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch phone numbers',
      error: error.message,
    });
  }
});

/**
 * POST /api/voice-sms/phone-numbers
 * Register a phone number
 */
router.post('/phone-numbers', async (req: Request, res: Response) => {
  try {
    const { phone_number, friendly_name, capabilities, is_active } = req.body;

    if (!phone_number) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: phone_number',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO phone_numbers (
        phone_number,
        friendly_name,
        capabilities,
        is_active
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [
        phone_number,
        friendly_name,
        JSON.stringify(capabilities || { voice: true, sms: true }),
        is_active !== false,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Phone number registered successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error registering phone number:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register phone number',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/voice-sms/phone-numbers/:id
 * Update a phone number
 */
router.patch('/phone-numbers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['friendly_name', 'capabilities', 'is_active'];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(
          key === 'capabilities' && typeof updates[key] === 'object'
            ? JSON.stringify(updates[key])
            : updates[key]
        );
        paramIndex++;
      }
    });

    if (setFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    values.push(id);

    const result = await queryWithTenant(
      `UPDATE phone_numbers SET ${setFields.join(', ')}
       WHERE number_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Phone number not found',
      });
    }

    res.json({
      success: true,
      message: 'Phone number updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating phone number:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update phone number',
      error: error.message,
    });
  }
});

/**
 * GET /api/voice-sms/analytics
 * Get voice/SMS analytics
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const { start_date, end_date } = req.query;

    const params: any[] = [];
    let dateFilter = '';

    if (start_date && end_date) {
      dateFilter = ` WHERE call_start_time BETWEEN $1 AND $2`;
      params.push(start_date, end_date);
    }

    // Call statistics
    const callStats = await queryWithTenant(
      `SELECT
        COUNT(*) as total_calls,
        AVG(duration_seconds) as avg_duration,
        COUNT(CASE WHEN direction = 'Inbound' THEN 1 END) as inbound_calls,
        COUNT(CASE WHEN direction = 'Outbound' THEN 1 END) as outbound_calls,
        COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed_calls
       FROM voice_calls${dateFilter}`,
      params
    );

    // SMS statistics
    const smsDateFilter = dateFilter.replace('call_start_time', 'sent_at');
    const smsStats = await queryWithTenant(
      `SELECT
        COUNT(*) as total_messages,
        COUNT(CASE WHEN direction = 'Inbound' THEN 1 END) as inbound_messages,
        COUNT(CASE WHEN direction = 'Outbound' THEN 1 END) as outbound_messages,
        COUNT(CASE WHEN status = 'Delivered' THEN 1 END) as delivered_messages
       FROM sms_messages${smsDateFilter}`,
      params
    );

    res.json({
      success: true,
      data: {
        calls: callStats[0],
        sms: smsStats[0],
      },
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message,
    });
  }
});

export default router;
