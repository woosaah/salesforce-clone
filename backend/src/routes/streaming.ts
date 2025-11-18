import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/streaming/channels
 * Get streaming channels (PushTopics)
 */
router.get('/channels', async (req: Request, res: Response) => {
  try {
    const { is_active } = req.query;

    let query = `SELECT * FROM push_topics WHERE 1=1`;
    const params: any[] = [];

    if (is_active !== undefined) {
      query += ` AND is_active = $1`;
      params.push(is_active === 'true');
    }

    query += ` ORDER BY topic_name`;

    const channels = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: channels,
    });
  } catch (error: any) {
    console.error('Error fetching streaming channels:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch streaming channels',
      error: error.message,
    });
  }
});

/**
 * POST /api/streaming/channels
 * Create a streaming channel (PushTopic)
 */
router.post('/channels', async (req: Request, res: Response) => {
  try {
    const { topic_name, query, notify_for_operations, is_active } = req.body;

    if (!topic_name || !query) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: topic_name, query',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO push_topics (
        topic_name,
        query,
        notify_for_operations,
        is_active
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [
        topic_name,
        query,
        JSON.stringify(notify_for_operations || ['create', 'update', 'delete']),
        is_active !== false,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Streaming channel created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating streaming channel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create streaming channel',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/streaming/channels/:id
 * Update a streaming channel
 */
router.patch('/channels/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['topic_name', 'query', 'notify_for_operations', 'is_active'];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(
          key === 'notify_for_operations' && typeof updates[key] === 'object'
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
      `UPDATE push_topics SET ${setFields.join(', ')}
       WHERE topic_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Streaming channel not found',
      });
    }

    res.json({
      success: true,
      message: 'Streaming channel updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating streaming channel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update streaming channel',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/streaming/channels/:id
 * Delete a streaming channel
 */
router.delete('/channels/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM push_topics WHERE topic_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Streaming channel not found',
      });
    }

    res.json({
      success: true,
      message: 'Streaming channel deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting streaming channel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete streaming channel',
      error: error.message,
    });
  }
});

/**
 * GET /api/streaming/subscribe/:topicId
 * Subscribe to a streaming channel
 * Note: In a real implementation, this would use WebSocket or Server-Sent Events
 */
router.get('/subscribe/:topicId', async (req: Request, res: Response) => {
  try {
    const { topicId } = req.params;

    // Get the topic
    const topics = await queryWithTenant(
      `SELECT * FROM push_topics WHERE topic_id = $1 AND is_active = true`,
      [topicId]
    );

    if (topics.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active streaming channel not found',
      });
    }

    // In a real implementation, this would establish a WebSocket connection
    // or use Server-Sent Events for real-time updates
    res.json({
      success: true,
      message: 'Subscription established',
      topic: topics[0],
      note: 'In production, this would be a WebSocket or SSE connection',
    });
  } catch (error: any) {
    console.error('Error subscribing to channel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to subscribe to channel',
      error: error.message,
    });
  }
});

/**
 * POST /api/streaming/publish
 * Publish an event to streaming channels
 * (Called internally when data changes)
 */
router.post('/publish', async (req: Request, res: Response) => {
  try {
    const { object_type, record_id, operation, data } = req.body;

    if (!object_type || !record_id || !operation) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: object_type, record_id, operation',
      });
    }

    // Find matching push topics
    const topics = await queryWithTenant(
      `SELECT * FROM push_topics
       WHERE is_active = true
         AND notify_for_operations::jsonb ? $1`,
      [operation]
    );

    // Filter topics based on query (simplified - in real implementation would execute SOQL)
    const matchingTopics = topics.filter((topic: any) => {
      // Simple check if query mentions the object type
      return topic.query.toLowerCase().includes(object_type.toLowerCase());
    });

    // In a real implementation, this would push events to WebSocket/SSE connections
    const publishedCount = matchingTopics.length;

    res.json({
      success: true,
      message: `Event published to ${publishedCount} channels`,
      published_to: matchingTopics.map((t: any) => t.topic_name),
    });
  } catch (error: any) {
    console.error('Error publishing event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish event',
      error: error.message,
    });
  }
});

/**
 * GET /api/streaming/events
 * Get recent streaming events (for debugging/monitoring)
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const { topic_id, limit = 50 } = req.query;

    // In a real implementation, events would be stored temporarily
    // For now, return a placeholder response
    res.json({
      success: true,
      message: 'Streaming events endpoint',
      note: 'In production, this would return recent events for the topic',
      data: [],
    });
  } catch (error: any) {
    console.error('Error fetching streaming events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch streaming events',
      error: error.message,
    });
  }
});

export default router;
