import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/tags
 * Get all tags for the tenant
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search } = req.query;

    let query = `
      SELECT t.*,
             COUNT(rt.record_tag_id) as usage_count
      FROM tags t
      LEFT JOIN record_tags rt ON t.tag_id = rt.tag_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND t.tag_name ILIKE $1`;
      params.push(`%${search}%`);
    }

    query += ` GROUP BY t.tag_id ORDER BY usage_count DESC, t.tag_name`;

    const tags = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: tags,
    });
  } catch (error: any) {
    console.error('Error fetching tags:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tags',
      error: error.message,
    });
  }
});

/**
 * GET /api/tags/:id
 * Get a specific tag
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const tags = await queryWithTenant(
      `SELECT t.*,
              COUNT(rt.record_tag_id) as usage_count
       FROM tags t
       LEFT JOIN record_tags rt ON t.tag_id = rt.tag_id
       WHERE t.tag_id = $1
       GROUP BY t.tag_id`,
      [id]
    );

    if (tags.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tag not found',
      });
    }

    res.json({
      success: true,
      data: tags[0],
    });
  } catch (error: any) {
    console.error('Error fetching tag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tag',
      error: error.message,
    });
  }
});

/**
 * POST /api/tags
 * Create a new tag
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { tag_name, tag_type } = req.body;

    if (!tag_name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: tag_name',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO tags (tag_name, tag_type)
       VALUES ($1, $2)
       ON CONFLICT (tag_name) DO NOTHING
       RETURNING *`,
      [tag_name, tag_type || 'Public']
    );

    if (result.length === 0) {
      // Tag already exists, return it
      const existing = await queryWithTenant(
        `SELECT * FROM tags WHERE tag_name = $1`,
        [tag_name]
      );
      return res.json({
        success: true,
        message: 'Tag already exists',
        data: existing[0],
      });
    }

    res.status(201).json({
      success: true,
      message: 'Tag created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating tag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create tag',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/tags/:id
 * Delete a tag
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Delete all record associations first
    await queryWithTenant(`DELETE FROM record_tags WHERE tag_id = $1`, [id]);

    const result = await queryWithTenant(
      `DELETE FROM tags WHERE tag_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tag not found',
      });
    }

    res.json({
      success: true,
      message: 'Tag deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting tag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete tag',
      error: error.message,
    });
  }
});

/**
 * GET /api/tags/records/:recordId
 * Get all tags for a specific record
 */
router.get('/records/:recordId', async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;

    const tags = await queryWithTenant(
      `SELECT t.*, rt.tagged_date
       FROM tags t
       JOIN record_tags rt ON t.tag_id = rt.tag_id
       WHERE rt.record_id = $1
       ORDER BY rt.tagged_date DESC`,
      [recordId]
    );

    res.json({
      success: true,
      data: tags,
    });
  } catch (error: any) {
    console.error('Error fetching record tags:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch record tags',
      error: error.message,
    });
  }
});

/**
 * POST /api/tags/records/:recordId
 * Add a tag to a record
 */
router.post('/records/:recordId', async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;
    const { tag_id, tag_name } = req.body;

    let finalTagId = tag_id;

    // If tag_name is provided but no tag_id, create or find the tag
    if (!tag_id && tag_name) {
      const existingTags = await queryWithTenant(
        `SELECT tag_id FROM tags WHERE tag_name = $1`,
        [tag_name]
      );

      if (existingTags.length > 0) {
        finalTagId = existingTags[0].tag_id;
      } else {
        const newTag = await queryWithTenant(
          `INSERT INTO tags (tag_name) VALUES ($1) RETURNING tag_id`,
          [tag_name]
        );
        finalTagId = newTag[0].tag_id;
      }
    }

    if (!finalTagId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: tag_id or tag_name',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO record_tags (record_id, tag_id)
       VALUES ($1, $2)
       ON CONFLICT (record_id, tag_id) DO NOTHING
       RETURNING *`,
      [recordId, finalTagId]
    );

    if (result.length === 0) {
      return res.json({
        success: true,
        message: 'Tag already applied to this record',
      });
    }

    res.status(201).json({
      success: true,
      message: 'Tag added to record successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error adding tag to record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add tag to record',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/tags/records/:recordId/:tagId
 * Remove a tag from a record
 */
router.delete('/records/:recordId/:tagId', async (req: Request, res: Response) => {
  try {
    const { recordId, tagId } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM record_tags
       WHERE record_id = $1 AND tag_id = $2
       RETURNING *`,
      [recordId, tagId]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tag association not found',
      });
    }

    res.json({
      success: true,
      message: 'Tag removed from record successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error removing tag from record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove tag from record',
      error: error.message,
    });
  }
});

/**
 * GET /api/tags/:id/records
 * Get all records with a specific tag
 */
router.get('/:id/records', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const records = await queryWithTenant(
      `SELECT rt.record_id, rt.tagged_date
       FROM record_tags rt
       WHERE rt.tag_id = $1
       ORDER BY rt.tagged_date DESC`,
      [id]
    );

    res.json({
      success: true,
      data: records,
    });
  } catch (error: any) {
    console.error('Error fetching tagged records:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tagged records',
      error: error.message,
    });
  }
});

export default router;
