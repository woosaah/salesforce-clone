import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/lightning-pages
 * Get all lightning pages
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { page_type, is_active } = req.query;

    let query = `SELECT * FROM lightning_pages WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (page_type) {
      query += ` AND page_type = $${paramIndex}`;
      params.push(page_type);
      paramIndex++;
    }

    if (is_active !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }

    query += ` ORDER BY page_name`;

    const pages = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: pages,
    });
  } catch (error: any) {
    console.error('Error fetching lightning pages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lightning pages',
      error: error.message,
    });
  }
});

/**
 * GET /api/lightning-pages/:id
 * Get a specific lightning page
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const pages = await queryWithTenant(
      `SELECT * FROM lightning_pages WHERE page_id = $1`,
      [id]
    );

    if (pages.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lightning page not found',
      });
    }

    res.json({
      success: true,
      data: pages[0],
    });
  } catch (error: any) {
    console.error('Error fetching lightning page:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lightning page',
      error: error.message,
    });
  }
});

/**
 * POST /api/lightning-pages
 * Create a new lightning page
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { page_name, page_type, layout, components, is_active } = req.body;

    if (!page_name || !page_type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: page_name, page_type',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO lightning_pages (
        page_name,
        page_type,
        layout,
        components,
        is_active
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        page_name,
        page_type,
        JSON.stringify(layout || {}),
        JSON.stringify(components || []),
        is_active !== false,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Lightning page created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating lightning page:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create lightning page',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/lightning-pages/:id
 * Update a lightning page
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['page_name', 'layout', 'components', 'is_active'];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(
          ['layout', 'components'].includes(key) && typeof updates[key] === 'object'
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
      `UPDATE lightning_pages SET ${setFields.join(', ')}
       WHERE page_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lightning page not found',
      });
    }

    res.json({
      success: true,
      message: 'Lightning page updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating lightning page:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update lightning page',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/lightning-pages/:id
 * Delete a lightning page
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM lightning_pages WHERE page_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lightning page not found',
      });
    }

    res.json({
      success: true,
      message: 'Lightning page deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting lightning page:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete lightning page',
      error: error.message,
    });
  }
});

/**
 * POST /api/lightning-pages/:id/clone
 * Clone a lightning page
 */
router.post('/:id/clone', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { new_name } = req.body;

    // Get the original page
    const pages = await queryWithTenant(
      `SELECT * FROM lightning_pages WHERE page_id = $1`,
      [id]
    );

    if (pages.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lightning page not found',
      });
    }

    const original = pages[0];

    // Create clone
    const result = await queryWithTenant(
      `INSERT INTO lightning_pages (
        page_name,
        page_type,
        layout,
        components,
        is_active
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        new_name || `${original.page_name} (Copy)`,
        original.page_type,
        original.layout,
        original.components,
        false, // Start inactive
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Lightning page cloned successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error cloning lightning page:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clone lightning page',
      error: error.message,
    });
  }
});

export default router;
