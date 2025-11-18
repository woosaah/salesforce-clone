import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/paths
 * Get all paths
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { object_name, is_active } = req.query;

    let query = `SELECT * FROM paths WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (object_name) {
      query += ` AND object_name = $${paramIndex}`;
      params.push(object_name);
      paramIndex++;
    }

    if (is_active !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }

    query += ` ORDER BY path_name`;

    const paths = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: paths,
    });
  } catch (error: any) {
    console.error('Error fetching paths:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch paths',
      error: error.message,
    });
  }
});

/**
 * GET /api/paths/:id
 * Get a specific path
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const paths = await queryWithTenant(
      `SELECT * FROM paths WHERE path_id = $1`,
      [id]
    );

    if (paths.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Path not found',
      });
    }

    res.json({
      success: true,
      data: paths[0],
    });
  } catch (error: any) {
    console.error('Error fetching path:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch path',
      error: error.message,
    });
  }
});

/**
 * POST /api/paths
 * Create a new path
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { path_name, object_name, field_name, steps, is_active } = req.body;

    if (!path_name || !object_name || !field_name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: path_name, object_name, field_name',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO paths (
        path_name,
        object_name,
        field_name,
        steps,
        is_active
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        path_name,
        object_name,
        field_name,
        JSON.stringify(steps || []),
        is_active !== false,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Path created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating path:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create path',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/paths/:id
 * Update a path
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['path_name', 'steps', 'is_active'];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(
          key === 'steps' && typeof updates[key] === 'object'
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
      `UPDATE paths SET ${setFields.join(', ')}
       WHERE path_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Path not found',
      });
    }

    res.json({
      success: true,
      message: 'Path updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating path:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update path',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/paths/:id
 * Delete a path
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM paths WHERE path_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Path not found',
      });
    }

    res.json({
      success: true,
      message: 'Path deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting path:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete path',
      error: error.message,
    });
  }
});

/**
 * GET /api/paths/:id/steps
 * Get all steps for a path with guidance
 */
router.get('/:id/steps', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const paths = await queryWithTenant(
      `SELECT steps FROM paths WHERE path_id = $1`,
      [id]
    );

    if (paths.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Path not found',
      });
    }

    const steps = paths[0].steps || [];

    res.json({
      success: true,
      data: steps,
    });
  } catch (error: any) {
    console.error('Error fetching path steps:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch path steps',
      error: error.message,
    });
  }
});

export default router;
