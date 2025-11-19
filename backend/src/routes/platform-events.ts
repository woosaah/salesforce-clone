import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/platform-events/definitions
 * Get all platform event definitions
 */
router.get('/definitions', async (req: Request, res: Response) => {
  try {
    const { is_active } = req.query;

    let query = `SELECT * FROM platform_event_definitions WHERE 1=1`;
    const params: any[] = [];

    if (is_active !== undefined) {
      query += ` AND is_active = $1`;
      params.push(is_active === 'true');
    }

    query += ` ORDER BY event_name`;

    const definitions = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: definitions,
    });
  } catch (error: any) {
    console.error('Error fetching platform event definitions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch platform event definitions',
      error: error.message,
    });
  }
});

/**
 * POST /api/platform-events/definitions
 * Create a platform event definition
 */
router.post('/definitions', async (req: Request, res: Response) => {
  try {
    const { event_name, description, fields, is_active } = req.body;

    if (!event_name || !fields) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: event_name, fields',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO platform_event_definitions (
        event_name,
        description,
        fields,
        is_active
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [event_name, description, JSON.stringify(fields), is_active !== false]
    );

    res.status(201).json({
      success: true,
      message: 'Platform event definition created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating platform event definition:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create platform event definition',
      error: error.message,
    });
  }
});

/**
 * POST /api/platform-events/publish
 * Publish a platform event
 */
router.post('/publish', async (req: Request, res: Response) => {
  try {
    const { event_name, event_data } = req.body;

    if (!event_name || !event_data) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: event_name, event_data',
      });
    }

    // Get event definition
    const definitions = await queryWithTenant(
      `SELECT * FROM platform_event_definitions WHERE event_name = $1 AND is_active = true`,
      [event_name]
    );

    if (definitions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active platform event definition not found',
      });
    }

    // Store the event
    const result = await queryWithTenant(
      `INSERT INTO platform_events (
        event_definition_id,
        event_data,
        published_by
      ) VALUES ($1, $2, $3)
      RETURNING *`,
      [definitions[0].event_definition_id, JSON.stringify(event_data), (req as any).user.userId]
    );

    // In a real implementation, this would trigger event delivery to subscribers
    res.status(201).json({
      success: true,
      message: 'Platform event published successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error publishing platform event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish platform event',
      error: error.message,
    });
  }
});

/**
 * POST /api/platform-events/publish/batch
 * Publish multiple platform events
 */
router.post('/publish/batch', async (req: Request, res: Response) => {
  try {
    const { events } = req.body;

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: events (array)',
      });
    }

    const results = [];
    for (const event of events) {
      try {
        const definitions = await queryWithTenant(
          `SELECT * FROM platform_event_definitions WHERE event_name = $1 AND is_active = true`,
          [event.event_name]
        );

        if (definitions.length > 0) {
          await queryWithTenant(
            `INSERT INTO platform_events (event_definition_id, event_data, published_by)
             VALUES ($1, $2, $3)`,
            [definitions[0].event_definition_id, JSON.stringify(event.event_data), (req as any).user.userId]
          );
          results.push({ event_name: event.event_name, success: true });
        } else {
          results.push({ event_name: event.event_name, success: false, error: 'Definition not found' });
        }
      } catch (error: any) {
        results.push({ event_name: event.event_name, success: false, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Published ${results.filter((r) => r.success).length} of ${events.length} events`,
      data: results,
    });
  } catch (error: any) {
    console.error('Error publishing batch events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish batch events',
      error: error.message,
    });
  }
});

/**
 * GET /api/platform-events/subscriptions
 * Get platform event subscriptions
 */
router.get('/subscriptions', async (req: Request, res: Response) => {
  try {
    const { event_definition_id } = req.query;

    let query = `
      SELECT pes.*,
             ped.event_name
      FROM platform_event_subscriptions pes
      JOIN platform_event_definitions ped ON pes.event_definition_id = ped.event_definition_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (event_definition_id) {
      query += ` AND pes.event_definition_id = $1`;
      params.push(event_definition_id);
    }

    query += ` ORDER BY pes.created_date DESC`;

    const subscriptions = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: subscriptions,
    });
  } catch (error: any) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscriptions',
      error: error.message,
    });
  }
});

/**
 * POST /api/platform-events/subscriptions
 * Subscribe to a platform event
 */
router.post('/subscriptions', async (req: Request, res: Response) => {
  try {
    const { event_definition_id, callback_url, filter_criteria } = req.body;

    if (!event_definition_id || !callback_url) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: event_definition_id, callback_url',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO platform_event_subscriptions (
        event_definition_id,
        callback_url,
        filter_criteria
      ) VALUES ($1, $2, $3)
      RETURNING *`,
      [event_definition_id, callback_url, JSON.stringify(filter_criteria || {})]
    );

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create subscription',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/platform-events/subscriptions/:id
 * Delete a subscription
 */
router.delete('/subscriptions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM platform_event_subscriptions WHERE subscription_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found',
      });
    }

    res.json({
      success: true,
      message: 'Subscription deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete subscription',
      error: error.message,
    });
  }
});

export default router;
