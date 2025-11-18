import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/list-views
 * Get all list views for the tenant
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { object_name } = req.query;

    let query = `SELECT * FROM list_views WHERE 1=1`;
    const params: any[] = [];

    if (object_name) {
      query += ` AND object_name = $1`;
      params.push(object_name);
    }

    query += ` ORDER BY view_name`;

    const views = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: views,
    });
  } catch (error: any) {
    console.error('Error fetching list views:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch list views',
      error: error.message,
    });
  }
});

/**
 * GET /api/list-views/:id
 * Get a specific list view
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const views = await queryWithTenant(
      `SELECT * FROM list_views WHERE view_id = $1`,
      [id]
    );

    if (views.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'List view not found',
      });
    }

    res.json({
      success: true,
      data: views[0],
    });
  } catch (error: any) {
    console.error('Error fetching list view:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch list view',
      error: error.message,
    });
  }
});

/**
 * POST /api/list-views
 * Create a new list view
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      view_name,
      object_name,
      columns,
      filters,
      sort_field,
      sort_order,
      is_public,
    } = req.body;

    if (!view_name || !object_name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: view_name, object_name',
      });
    }

    const owner_id = (req as any).user.userId;

    const result = await queryWithTenant(
      `INSERT INTO list_views (
        view_name,
        object_name,
        owner_id,
        columns,
        filters,
        sort_field,
        sort_order,
        is_public
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        view_name,
        object_name,
        owner_id,
        JSON.stringify(columns || []),
        JSON.stringify(filters || []),
        sort_field,
        sort_order || 'ASC',
        is_public !== false,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'List view created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating list view:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create list view',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/list-views/:id
 * Update a list view
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'view_name',
      'columns',
      'filters',
      'sort_field',
      'sort_order',
      'is_public',
    ];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(
          ['columns', 'filters'].includes(key) && typeof updates[key] === 'object'
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
      `UPDATE list_views SET ${setFields.join(', ')}
       WHERE view_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'List view not found',
      });
    }

    res.json({
      success: true,
      message: 'List view updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating list view:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update list view',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/list-views/:id
 * Delete a list view
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM list_views WHERE view_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'List view not found',
      });
    }

    res.json({
      success: true,
      message: 'List view deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting list view:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete list view',
      error: error.message,
    });
  }
});

/**
 * POST /api/list-views/:id/execute
 * Execute a list view and get records
 */
router.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.body;

    // Get the list view
    const views = await queryWithTenant(
      `SELECT * FROM list_views WHERE view_id = $1`,
      [id]
    );

    if (views.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'List view not found',
      });
    }

    const view = views[0];

    // Get the object
    const objects = await queryWithTenant(
      `SELECT * FROM objects_meta WHERE object_name = $1`,
      [view.object_name]
    );

    if (objects.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Object not found',
      });
    }

    const object = objects[0];

    // Build query based on filters
    let query = `SELECT * FROM object_data WHERE object_id = $1`;
    const params: any[] = [object.object_id];
    let paramIndex = 2;

    // Apply filters
    const filters = view.filters || [];
    filters.forEach((filter: any) => {
      if (filter.field && filter.operator && filter.value !== undefined) {
        if (filter.operator === 'equals') {
          query += ` AND data->>'${filter.field}' = $${paramIndex}`;
          params.push(filter.value);
          paramIndex++;
        } else if (filter.operator === 'contains') {
          query += ` AND data->>'${filter.field}' ILIKE $${paramIndex}`;
          params.push(`%${filter.value}%`);
          paramIndex++;
        } else if (filter.operator === 'greater_than') {
          query += ` AND (data->>'${filter.field}')::numeric > $${paramIndex}`;
          params.push(filter.value);
          paramIndex++;
        } else if (filter.operator === 'less_than') {
          query += ` AND (data->>'${filter.field}')::numeric < $${paramIndex}`;
          params.push(filter.value);
          paramIndex++;
        }
      }
    });

    // Apply sorting
    if (view.sort_field) {
      query += ` ORDER BY data->>'${view.sort_field}' ${view.sort_order || 'ASC'}`;
    }

    // Apply pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const records = await queryWithTenant(query, params);

    res.json({
      success: true,
      view_name: view.view_name,
      columns: view.columns,
      count: records.length,
      data: records,
    });
  } catch (error: any) {
    console.error('Error executing list view:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute list view',
      error: error.message,
    });
  }
});

export default router;
