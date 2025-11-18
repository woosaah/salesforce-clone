import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/topics
 * Get all topics
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const topics = await queryWithTenant(
      `SELECT t.*,
              COUNT(DISTINCT ra.record_id) as record_count
       FROM topics t
       LEFT JOIN record_topics rt ON t.topic_id = rt.topic_id
       LEFT JOIN record_associations ra ON rt.record_topic_id = ra.record_topic_id
       GROUP BY t.topic_id
       ORDER BY record_count DESC, t.topic_name`,
      []
    );

    res.json({
      success: true,
      data: topics,
    });
  } catch (error: any) {
    console.error('Error fetching topics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch topics',
      error: error.message,
    });
  }
});

/**
 * GET /api/topics/:id
 * Get a specific topic
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const topics = await queryWithTenant(
      `SELECT * FROM topics WHERE topic_id = $1`,
      [id]
    );

    if (topics.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found',
      });
    }

    res.json({
      success: true,
      data: topics[0],
    });
  } catch (error: any) {
    console.error('Error fetching topic:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch topic',
      error: error.message,
    });
  }
});

/**
 * POST /api/topics
 * Create a new topic
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { topic_name, description } = req.body;

    if (!topic_name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: topic_name',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO topics (topic_name, description)
       VALUES ($1, $2)
       RETURNING *`,
      [topic_name, description]
    );

    res.status(201).json({
      success: true,
      message: 'Topic created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating topic:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create topic',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/topics/:id
 * Delete a topic
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM topics WHERE topic_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found',
      });
    }

    res.json({
      success: true,
      message: 'Topic deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting topic:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete topic',
      error: error.message,
    });
  }
});

/**
 * POST /api/topics/:id/assign
 * Assign a topic to records
 */
router.post('/:id/assign', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { record_ids } = req.body;

    if (!record_ids || !Array.isArray(record_ids)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: record_ids (array)',
      });
    }

    const results = [];
    for (const recordId of record_ids) {
      try {
        // Create record-topic association
        const recordTopic = await queryWithTenant(
          `INSERT INTO record_topics (topic_id, record_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING
           RETURNING *`,
          [id, recordId]
        );

        if (recordTopic.length > 0) {
          // Create record association entry
          await queryWithTenant(
            `INSERT INTO record_associations (record_topic_id, record_id)
             VALUES ($1, $2)`,
            [recordTopic[0].record_topic_id, recordId]
          );
        }

        results.push({ record_id: recordId, success: true });
      } catch (error: any) {
        results.push({ record_id: recordId, success: false, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Assigned topic to ${results.filter((r) => r.success).length} of ${record_ids.length} records`,
      data: results,
    });
  } catch (error: any) {
    console.error('Error assigning topic:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign topic',
      error: error.message,
    });
  }
});

/**
 * GET /api/topics/:id/records
 * Get all records associated with a topic
 */
router.get('/:id/records', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const records = await queryWithTenant(
      `SELECT ra.record_id
       FROM record_associations ra
       JOIN record_topics rt ON ra.record_topic_id = rt.record_topic_id
       WHERE rt.topic_id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: records,
    });
  } catch (error: any) {
    console.error('Error fetching topic records:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch topic records',
      error: error.message,
    });
  }
});

export default router;
