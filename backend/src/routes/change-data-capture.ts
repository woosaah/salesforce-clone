import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/change-data-capture/channels
 * Get all change data capture channels
 */
router.get('/channels', async (req: Request, res: Response) => {
  try {
    const { is_active } = req.query;

    let query = `SELECT * FROM cdc_channels WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (is_active !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }

    query += ` ORDER BY channel_name`;

    const channels = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: channels,
    });
  } catch (error: any) {
    console.error('Error fetching CDC channels:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch CDC channels',
      error: error.message,
    });
  }
});

/**
 * GET /api/change-data-capture/channels/:id
 * Get a specific CDC channel
 */
router.get('/channels/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const channels = await queryWithTenant(
      `SELECT * FROM cdc_channels WHERE channel_id = $1`,
      [id]
    );

    if (channels.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'CDC channel not found',
      });
    }

    res.json({
      success: true,
      data: channels[0],
    });
  } catch (error: any) {
    console.error('Error fetching CDC channel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch CDC channel',
      error: error.message,
    });
  }
});

/**
 * POST /api/change-data-capture/channels
 * Create a CDC channel
 */
router.post('/channels', async (req: Request, res: Response) => {
  try {
    const { channel_name, entity_name, entity_type, is_active } = req.body;

    if (!channel_name || !entity_name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: channel_name, entity_name',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO cdc_channels (
        channel_name,
        entity_name,
        entity_type,
        is_active
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [channel_name, entity_name, entity_type || 'Object', is_active !== false]
    );

    res.status(201).json({
      success: true,
      message: 'CDC channel created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating CDC channel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create CDC channel',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/change-data-capture/channels/:id
 * Update a CDC channel
 */
router.patch('/channels/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['channel_name', 'is_active'];

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
      `UPDATE cdc_channels SET ${setFields.join(', ')}
       WHERE channel_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'CDC channel not found',
      });
    }

    res.json({
      success: true,
      message: 'CDC channel updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating CDC channel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update CDC channel',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/change-data-capture/channels/:id
 * Delete a CDC channel
 */
router.delete('/channels/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM cdc_channels WHERE channel_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'CDC channel not found',
      });
    }

    res.json({
      success: true,
      message: 'CDC channel deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting CDC channel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete CDC channel',
      error: error.message,
    });
  }
});

/**
 * GET /api/change-data-capture/events
 * Get change events
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const { channel_id, operation_type, entity_id } = req.query;

    let query = `
      SELECT ce.*,
             cc.channel_name
      FROM cdc_events ce
      JOIN cdc_channels cc ON ce.channel_id = cc.channel_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (channel_id) {
      query += ` AND ce.channel_id = $${paramIndex}`;
      params.push(channel_id);
      paramIndex++;
    }

    if (operation_type) {
      query += ` AND ce.operation_type = $${paramIndex}`;
      params.push(operation_type);
      paramIndex++;
    }

    if (entity_id) {
      query += ` AND ce.entity_id = $${paramIndex}`;
      params.push(entity_id);
      paramIndex++;
    }

    query += ` ORDER BY ce.event_time DESC LIMIT 100`;

    const events = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: events,
    });
  } catch (error: any) {
    console.error('Error fetching CDC events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch CDC events',
      error: error.message,
    });
  }
});

/**
 * GET /api/change-data-capture/events/:id
 * Get a specific change event
 */
router.get('/events/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const events = await queryWithTenant(
      `SELECT ce.*,
              cc.channel_name,
              cc.entity_name
       FROM cdc_events ce
       JOIN cdc_channels cc ON ce.channel_id = cc.channel_id
       WHERE ce.event_id = $1`,
      [id]
    );

    if (events.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Change event not found',
      });
    }

    res.json({
      success: true,
      data: events[0],
    });
  } catch (error: any) {
    console.error('Error fetching change event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch change event',
      error: error.message,
    });
  }
});

/**
 * POST /api/change-data-capture/events
 * Create a change event (typically called by system triggers)
 */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const { channel_id, entity_id, operation_type, change_data } = req.body;

    if (!channel_id || !entity_id || !operation_type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: channel_id, entity_id, operation_type',
      });
    }

    // Verify channel is active
    const channels = await queryWithTenant(
      `SELECT * FROM cdc_channels WHERE channel_id = $1 AND is_active = true`,
      [channel_id]
    );

    if (channels.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active CDC channel not found',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO cdc_events (
        channel_id,
        entity_id,
        operation_type,
        change_data
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [channel_id, entity_id, operation_type, JSON.stringify(change_data || {})]
    );

    // In real implementation, would publish event to subscribers here

    res.status(201).json({
      success: true,
      message: 'Change event created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating change event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create change event',
      error: error.message,
    });
  }
});

/**
 * GET /api/change-data-capture/subscriptions
 * Get CDC subscriptions
 */
router.get('/subscriptions', async (req: Request, res: Response) => {
  try {
    const { channel_id } = req.query;

    let query = `
      SELECT cs.*,
             cc.channel_name,
             cc.entity_name
      FROM cdc_subscriptions cs
      JOIN cdc_channels cc ON cs.channel_id = cc.channel_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (channel_id) {
      query += ` AND cs.channel_id = $${paramIndex}`;
      params.push(channel_id);
      paramIndex++;
    }

    query += ` ORDER BY cs.created_date DESC`;

    const subscriptions = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: subscriptions,
    });
  } catch (error: any) {
    console.error('Error fetching CDC subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch CDC subscriptions',
      error: error.message,
    });
  }
});

/**
 * POST /api/change-data-capture/subscriptions
 * Subscribe to change events
 */
router.post('/subscriptions', async (req: Request, res: Response) => {
  try {
    const { channel_id, callback_url, filter_criteria } = req.body;

    if (!channel_id || !callback_url) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: channel_id, callback_url',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO cdc_subscriptions (
        channel_id,
        callback_url,
        filter_criteria,
        is_active
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [channel_id, callback_url, JSON.stringify(filter_criteria || {}), true]
    );

    res.status(201).json({
      success: true,
      message: 'CDC subscription created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating CDC subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create CDC subscription',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/change-data-capture/subscriptions/:id
 * Update a CDC subscription
 */
router.patch('/subscriptions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['callback_url', 'filter_criteria', 'is_active'];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(
          key === 'filter_criteria' && typeof updates[key] === 'object'
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
      `UPDATE cdc_subscriptions SET ${setFields.join(', ')}
       WHERE subscription_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'CDC subscription not found',
      });
    }

    res.json({
      success: true,
      message: 'CDC subscription updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating CDC subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update CDC subscription',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/change-data-capture/subscriptions/:id
 * Unsubscribe from change events
 */
router.delete('/subscriptions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM cdc_subscriptions WHERE subscription_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'CDC subscription not found',
      });
    }

    res.json({
      success: true,
      message: 'CDC subscription deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting CDC subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete CDC subscription',
      error: error.message,
    });
  }
});

/**
 * GET /api/change-data-capture/replay/:channelId
 * Replay change events from a specific point
 */
router.get('/replay/:channelId', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const { replay_id, limit } = req.query;

    let query = `
      SELECT ce.*
      FROM cdc_events ce
      WHERE ce.channel_id = $1
    `;
    const params: any[] = [channelId];
    let paramIndex = 2;

    if (replay_id) {
      query += ` AND ce.event_id > $${paramIndex}`;
      params.push(replay_id);
      paramIndex++;
    }

    query += ` ORDER BY ce.event_time`;

    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(parseInt(limit as string, 10));
    } else {
      query += ` LIMIT 100`;
    }

    const events = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: events,
      replay_id: events.length > 0 ? events[events.length - 1].event_id : replay_id,
    });
  } catch (error: any) {
    console.error('Error replaying CDC events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to replay CDC events',
      error: error.message,
    });
  }
});

export default router;
