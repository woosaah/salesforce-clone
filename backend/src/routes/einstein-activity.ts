import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/einstein-activity/captured
 * Get captured activities
 */
router.get('/captured', async (req: Request, res: Response) => {
  try {
    const { user_id, activity_type, status } = req.query;

    let query = `
      SELECT ca.*,
             u.first_name || ' ' || u.last_name as user_name
      FROM captured_activities ca
      LEFT JOIN users u ON ca.user_id = u.user_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (user_id) {
      query += ` AND ca.user_id = $${paramIndex}`;
      params.push(user_id);
      paramIndex++;
    }

    if (activity_type) {
      query += ` AND ca.activity_type = $${paramIndex}`;
      params.push(activity_type);
      paramIndex++;
    }

    if (status) {
      query += ` AND ca.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY ca.captured_date DESC LIMIT 100`;

    const activities = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: activities,
    });
  } catch (error: any) {
    console.error('Error fetching captured activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch captured activities',
      error: error.message,
    });
  }
});

/**
 * GET /api/einstein-activity/captured/:id
 * Get a specific captured activity
 */
router.get('/captured/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const activities = await queryWithTenant(
      `SELECT * FROM captured_activities WHERE activity_id = $1`,
      [id]
    );

    if (activities.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Captured activity not found',
      });
    }

    res.json({
      success: true,
      data: activities[0],
    });
  } catch (error: any) {
    console.error('Error fetching captured activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch captured activity',
      error: error.message,
    });
  }
});

/**
 * POST /api/einstein-activity/captured
 * Create a captured activity
 */
router.post('/captured', async (req: Request, res: Response) => {
  try {
    const {
      user_id,
      activity_type,
      subject,
      body,
      attendees,
      source,
      external_id,
    } = req.body;

    if (!user_id || !activity_type || !subject) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: user_id, activity_type, subject',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO captured_activities (
        user_id,
        activity_type,
        subject,
        body,
        attendees,
        source,
        external_id,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        user_id,
        activity_type,
        subject,
        body,
        JSON.stringify(attendees || []),
        source || 'Email',
        external_id,
        'Pending',
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Activity captured successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error capturing activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to capture activity',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/einstein-activity/captured/:id
 * Update a captured activity
 */
router.patch('/captured/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['subject', 'body', 'attendees', 'status', 'related_to_id'];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(
          key === 'attendees' && typeof updates[key] === 'object'
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
      `UPDATE captured_activities SET ${setFields.join(', ')}
       WHERE activity_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Captured activity not found',
      });
    }

    res.json({
      success: true,
      message: 'Activity updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update activity',
      error: error.message,
    });
  }
});

/**
 * POST /api/einstein-activity/captured/:id/link
 * Link captured activity to a CRM record
 */
router.post('/captured/:id/link', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { related_to_id, related_to_type } = req.body;

    if (!related_to_id || !related_to_type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: related_to_id, related_to_type',
      });
    }

    const result = await queryWithTenant(
      `UPDATE captured_activities
       SET related_to_id = $1,
           related_to_type = $2,
           status = 'Linked'
       WHERE activity_id = $3
       RETURNING *`,
      [related_to_id, related_to_type, id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Captured activity not found',
      });
    }

    res.json({
      success: true,
      message: 'Activity linked successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error linking activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to link activity',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/einstein-activity/captured/:id
 * Delete a captured activity
 */
router.delete('/captured/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM captured_activities WHERE activity_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Captured activity not found',
      });
    }

    res.json({
      success: true,
      message: 'Activity deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete activity',
      error: error.message,
    });
  }
});

/**
 * GET /api/einstein-activity/insights
 * Get activity insights for a user
 */
router.get('/insights', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: user_id',
      });
    }

    // Get activity statistics
    const stats = await queryWithTenant(
      `SELECT
        activity_type,
        status,
        COUNT(*) as count
       FROM captured_activities
       WHERE user_id = $1
       GROUP BY activity_type, status`,
      [user_id]
    );

    // Get recent activity trends
    const trends = await queryWithTenant(
      `SELECT
        DATE(captured_date) as date,
        COUNT(*) as activity_count
       FROM captured_activities
       WHERE user_id = $1
         AND captured_date >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY DATE(captured_date)
       ORDER BY date DESC`,
      [user_id]
    );

    res.json({
      success: true,
      data: {
        statistics: stats,
        trends,
      },
    });
  } catch (error: any) {
    console.error('Error fetching insights:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch insights',
      error: error.message,
    });
  }
});

export default router;
