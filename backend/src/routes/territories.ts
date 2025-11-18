import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/territories
 * Get all territories for the tenant
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const territories = await queryWithTenant(
      `SELECT t.*,
              COUNT(DISTINCT ta.assignment_id) as account_count,
              COUNT(DISTINCT tu.user_territory_id) as user_count
       FROM territories t
       LEFT JOIN territory_assignments ta ON t.territory_id = ta.territory_id
       LEFT JOIN territory_users tu ON t.territory_id = tu.territory_id
       GROUP BY t.territory_id
       ORDER BY t.territory_name`,
      []
    );

    res.json({
      success: true,
      data: territories,
    });
  } catch (error: any) {
    console.error('Error fetching territories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch territories',
      error: error.message,
    });
  }
});

/**
 * GET /api/territories/:id
 * Get a specific territory
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const territories = await queryWithTenant(
      `SELECT * FROM territories WHERE territory_id = $1`,
      [id]
    );

    if (territories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Territory not found',
      });
    }

    res.json({
      success: true,
      data: territories[0],
    });
  } catch (error: any) {
    console.error('Error fetching territory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch territory',
      error: error.message,
    });
  }
});

/**
 * POST /api/territories
 * Create a new territory
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      territory_name,
      parent_territory_id,
      description,
      assignment_rules,
    } = req.body;

    // Validation
    if (!territory_name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: territory_name',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO territories (
        territory_name,
        parent_territory_id,
        description,
        assignment_rules
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [
        territory_name,
        parent_territory_id,
        description,
        JSON.stringify(assignment_rules || {}),
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Territory created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating territory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create territory',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/territories/:id
 * Update a territory
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Build dynamic update query
    const allowedFields = [
      'territory_name',
      'parent_territory_id',
      'description',
      'assignment_rules',
    ];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(
          key === 'assignment_rules' && typeof updates[key] === 'object'
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
      `UPDATE territories SET ${setFields.join(', ')}
       WHERE territory_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Territory not found',
      });
    }

    res.json({
      success: true,
      message: 'Territory updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating territory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update territory',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/territories/:id
 * Delete a territory
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM territories WHERE territory_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Territory not found',
      });
    }

    res.json({
      success: true,
      message: 'Territory deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting territory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete territory',
      error: error.message,
    });
  }
});

/**
 * GET /api/territories/:id/assignments
 * Get all account assignments for a territory
 */
router.get('/:id/assignments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const assignments = await queryWithTenant(
      `SELECT ta.*, od.data->>'name' as account_name
       FROM territory_assignments ta
       LEFT JOIN object_data od ON ta.account_id = od.record_id
       WHERE ta.territory_id = $1
       ORDER BY ta.assigned_date DESC`,
      [id]
    );

    res.json({
      success: true,
      data: assignments,
    });
  } catch (error: any) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assignments',
      error: error.message,
    });
  }
});

/**
 * POST /api/territories/:id/assignments
 * Assign an account to a territory
 */
router.post('/:id/assignments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { account_id, assignment_reason } = req.body;

    if (!account_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: account_id',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO territory_assignments (
        territory_id,
        account_id,
        assignment_reason
      ) VALUES ($1, $2, $3)
      RETURNING *`,
      [id, account_id, assignment_reason]
    );

    res.status(201).json({
      success: true,
      message: 'Account assigned to territory successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error assigning account:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign account',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/territories/:id/assignments/:assignmentId
 * Remove an account assignment from a territory
 */
router.delete('/:id/assignments/:assignmentId', async (req: Request, res: Response) => {
  try {
    const { id, assignmentId } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM territory_assignments
       WHERE territory_id = $1 AND assignment_id = $2
       RETURNING *`,
      [id, assignmentId]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found',
      });
    }

    res.json({
      success: true,
      message: 'Account removed from territory successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error removing assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove assignment',
      error: error.message,
    });
  }
});

/**
 * GET /api/territories/:id/users
 * Get all users assigned to a territory
 */
router.get('/:id/users', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const users = await queryWithTenant(
      `SELECT tu.*, u.first_name, u.last_name, u.email
       FROM territory_users tu
       JOIN users u ON tu.user_id = u.user_id
       WHERE tu.territory_id = $1
       ORDER BY tu.assigned_date DESC`,
      [id]
    );

    res.json({
      success: true,
      data: users,
    });
  } catch (error: any) {
    console.error('Error fetching territory users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch territory users',
      error: error.message,
    });
  }
});

/**
 * POST /api/territories/:id/users
 * Assign a user to a territory
 */
router.post('/:id/users', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id, role } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: user_id',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO territory_users (
        territory_id,
        user_id,
        role
      ) VALUES ($1, $2, $3)
      RETURNING *`,
      [id, user_id, role || 'Member']
    );

    res.status(201).json({
      success: true,
      message: 'User assigned to territory successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error assigning user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign user',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/territories/:id/users/:userTerritoryId
 * Remove a user from a territory
 */
router.delete('/:id/users/:userTerritoryId', async (req: Request, res: Response) => {
  try {
    const { id, userTerritoryId } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM territory_users
       WHERE territory_id = $1 AND user_territory_id = $2
       RETURNING *`,
      [id, userTerritoryId]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User assignment not found',
      });
    }

    res.json({
      success: true,
      message: 'User removed from territory successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error removing user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove user',
      error: error.message,
    });
  }
});

export default router;
