import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/social/posts
 * Get social media posts
 */
router.get('/posts', async (req: Request, res: Response) => {
  try {
    const { platform, status, parent_case_id } = req.query;

    let query = `SELECT * FROM social_posts WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (platform) {
      query += ` AND platform = $${paramIndex}`;
      params.push(platform);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (parent_case_id) {
      query += ` AND parent_case_id = $${paramIndex}`;
      params.push(parent_case_id);
      paramIndex++;
    }

    query += ` ORDER BY post_date DESC LIMIT 100`;

    const posts = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: posts,
    });
  } catch (error: any) {
    console.error('Error fetching social posts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch social posts',
      error: error.message,
    });
  }
});

/**
 * POST /api/social/posts
 * Create a social post (from monitoring)
 */
router.post('/posts', async (req: Request, res: Response) => {
  try {
    const {
      platform,
      external_id,
      author_name,
      author_handle,
      content,
      post_url,
      sentiment,
      language,
    } = req.body;

    if (!platform || !external_id || !content) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: platform, external_id, content',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO social_posts (
        platform,
        external_id,
        author_name,
        author_handle,
        content,
        post_url,
        sentiment,
        language,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        platform,
        external_id,
        author_name,
        author_handle,
        content,
        post_url,
        sentiment,
        language,
        'New',
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Social post created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating social post:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create social post',
      error: error.message,
    });
  }
});

/**
 * POST /api/social/posts/:id/convert-to-case
 * Convert a social post to a case
 */
router.post('/posts/:id/convert-to-case', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { priority, owner_id } = req.body;

    // Get the social post
    const posts = await queryWithTenant(
      `SELECT * FROM social_posts WHERE post_id = $1`,
      [id]
    );

    if (posts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Social post not found',
      });
    }

    const post = posts[0];

    // Create a case
    const caseObject = await queryWithTenant(
      `SELECT object_id FROM objects_meta WHERE object_name = 'Case' LIMIT 1`,
      []
    );

    if (caseObject.length > 0) {
      const caseData = {
        subject: `Social: ${post.platform} - ${post.author_handle}`,
        description: post.content,
        status: 'New',
        priority: priority || 'Medium',
        origin: `Social - ${post.platform}`,
        owner_id,
      };

      const newCase = await queryWithTenant(
        `INSERT INTO object_data (object_id, data)
         VALUES ($1, $2)
         RETURNING record_id`,
        [caseObject[0].object_id, JSON.stringify(caseData)]
      );

      // Update social post with case reference
      await queryWithTenant(
        `UPDATE social_posts SET parent_case_id = $1, status = 'Converted'
         WHERE post_id = $2`,
        [newCase[0].record_id, id]
      );

      res.status(201).json({
        success: true,
        message: 'Social post converted to case',
        case_id: newCase[0].record_id,
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Case object not found',
      });
    }
  } catch (error: any) {
    console.error('Error converting post to case:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to convert post to case',
      error: error.message,
    });
  }
});

/**
 * POST /api/social/posts/:id/respond
 * Respond to a social post
 */
router.post('/posts/:id/respond', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { response_text, agent_id } = req.body;

    if (!response_text) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: response_text',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO social_responses (
        post_id,
        response_text,
        agent_id
      ) VALUES ($1, $2, $3)
      RETURNING *`,
      [id, response_text, agent_id || (req as any).user.userId]
    );

    // Update post status
    await queryWithTenant(
      `UPDATE social_posts SET status = 'Responded' WHERE post_id = $1`,
      [id]
    );

    res.status(201).json({
      success: true,
      message: 'Response sent successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error sending response:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send response',
      error: error.message,
    });
  }
});

/**
 * GET /api/social/analytics
 * Get social media analytics
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const { start_date, end_date } = req.query;

    const params: any[] = [];
    let dateFilter = '';

    if (start_date && end_date) {
      dateFilter = ` WHERE post_date BETWEEN $1 AND $2`;
      params.push(start_date, end_date);
    }

    // Platform distribution
    const platformStats = await queryWithTenant(
      `SELECT platform, COUNT(*) as count
       FROM social_posts${dateFilter}
       GROUP BY platform`,
      params
    );

    // Sentiment analysis
    const sentimentStats = await queryWithTenant(
      `SELECT sentiment, COUNT(*) as count
       FROM social_posts${dateFilter}
       GROUP BY sentiment`,
      params
    );

    // Response rate
    const responseStats = await queryWithTenant(
      `SELECT
        COUNT(*) as total_posts,
        COUNT(CASE WHEN status = 'Responded' THEN 1 END) as responded
       FROM social_posts${dateFilter}`,
      params
    );

    res.json({
      success: true,
      data: {
        by_platform: platformStats,
        by_sentiment: sentimentStats,
        response_metrics: responseStats[0],
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
