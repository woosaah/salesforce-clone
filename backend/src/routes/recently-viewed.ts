import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/recently-viewed
 * Get recently viewed items for the current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { object_type, limit = 10 } = req.query;
    const user_id = (req as any).user.userId;

    let query = `
      SELECT rv.*,
             om.object_name,
             om.label as object_label
      FROM recently_viewed rv
      LEFT JOIN objects_meta om ON rv.object_id = om.object_id
      WHERE rv.user_id = $1
    `;
    const params: any[] = [user_id];
    let paramIndex = 2;

    if (object_type) {
      query += ` AND om.object_name = $${paramIndex}`;
      params.push(object_type);
      paramIndex++;
    }

    query += ` ORDER BY rv.viewed_date DESC LIMIT $${paramIndex}`;
    params.push(Number(limit));

    const items = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: items,
    });
  } catch (error: any) {
    console.error('Error fetching recently viewed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recently viewed items',
      error: error.message,
    });
  }
});

/**
 * POST /api/recently-viewed
 * Track a viewed item
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { record_id, object_id } = req.body;
    const user_id = (req as any).user.userId;

    if (!record_id || !object_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: record_id, object_id',
      });
    }

    // Insert or update the viewed record
    const result = await queryWithTenant(
      `INSERT INTO recently_viewed (
        user_id,
        record_id,
        object_id,
        viewed_date
      ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, record_id)
      DO UPDATE SET viewed_date = CURRENT_TIMESTAMP
      RETURNING *`,
      [user_id, record_id, object_id]
    );

    // Cleanup old entries (keep only last 200 per user)
    await queryWithTenant(
      `DELETE FROM recently_viewed
       WHERE user_id = $1
       AND recently_viewed_id NOT IN (
         SELECT recently_viewed_id
         FROM recently_viewed
         WHERE user_id = $1
         ORDER BY viewed_date DESC
         LIMIT 200
       )`,
      [user_id]
    );

    res.status(201).json({
      success: true,
      message: 'View tracked successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error tracking view:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track view',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/recently-viewed/:id
 * Remove an item from recently viewed
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user_id = (req as any).user.userId;

    const result = await queryWithTenant(
      `DELETE FROM recently_viewed
       WHERE recently_viewed_id = $1 AND user_id = $2
       RETURNING *`,
      [id, user_id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recently viewed item not found',
      });
    }

    res.json({
      success: true,
      message: 'Item removed from recently viewed',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error removing recently viewed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove item',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/recently-viewed
 * Clear all recently viewed items for the current user
 */
router.delete('/', async (req: Request, res: Response) => {
  try {
    const user_id = (req as any).user.userId;

    const result = await queryWithTenant(
      `DELETE FROM recently_viewed WHERE user_id = $1 RETURNING recently_viewed_id`,
      [user_id]
    );

    res.json({
      success: true,
      message: `Cleared ${result.length} recently viewed items`,
      count: result.length,
    });
  } catch (error: any) {
    console.error('Error clearing recently viewed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear recently viewed items',
      error: error.message,
    });
  }
});

export default router;
