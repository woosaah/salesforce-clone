import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/knowledge-versions
 * Get article versions
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { article_id, language } = req.query;

    if (!article_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: article_id',
      });
    }

    let query = `SELECT * FROM knowledge_article_versions WHERE article_id = $1`;
    const params: any[] = [article_id];
    let paramIndex = 2;

    if (language) {
      query += ` AND language = $${paramIndex}`;
      params.push(language);
      paramIndex++;
    }

    query += ` ORDER BY version_number DESC`;

    const versions = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: versions,
    });
  } catch (error: any) {
    console.error('Error fetching article versions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch article versions',
      error: error.message,
    });
  }
});

/**
 * GET /api/knowledge-versions/:id
 * Get a specific version
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const versions = await queryWithTenant(
      `SELECT * FROM knowledge_article_versions WHERE version_id = $1`,
      [id]
    );

    if (versions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Article version not found',
      });
    }

    res.json({
      success: true,
      data: versions[0],
    });
  } catch (error: any) {
    console.error('Error fetching version:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch version',
      error: error.message,
    });
  }
});

/**
 * POST /api/knowledge-versions
 * Create a new article version
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { article_id, language, title, content, summary, is_major_version } = req.body;

    if (!article_id || !language || !title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: article_id, language, title, content',
      });
    }

    // Get the latest version number
    const latestVersions = await queryWithTenant(
      `SELECT COALESCE(MAX(version_number), 0) as max_version
       FROM knowledge_article_versions
       WHERE article_id = $1 AND language = $2`,
      [article_id, language]
    );

    const nextVersion = latestVersions[0].max_version + 1;

    const result = await queryWithTenant(
      `INSERT INTO knowledge_article_versions (
        article_id,
        language,
        version_number,
        title,
        content,
        summary,
        is_major_version,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        article_id,
        language,
        nextVersion,
        title,
        content,
        summary,
        is_major_version || false,
        'Draft',
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Article version created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating version:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create version',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/knowledge-versions/:id
 * Update an article version
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['title', 'content', 'summary', 'status'];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(updates[key]);
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
      `UPDATE knowledge_article_versions SET ${setFields.join(', ')}
       WHERE version_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Article version not found',
      });
    }

    res.json({
      success: true,
      message: 'Version updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating version:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update version',
      error: error.message,
    });
  }
});

/**
 * POST /api/knowledge-versions/:id/publish
 * Publish an article version
 */
router.post('/:id/publish', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Update status to published
    const result = await queryWithTenant(
      `UPDATE knowledge_article_versions
       SET status = 'Published', published_date = CURRENT_TIMESTAMP
       WHERE version_id = $1
       RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Article version not found',
      });
    }

    res.json({
      success: true,
      message: 'Version published successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error publishing version:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish version',
      error: error.message,
    });
  }
});

/**
 * POST /api/knowledge-versions/:id/archive
 * Archive an article version
 */
router.post('/:id/archive', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `UPDATE knowledge_article_versions
       SET status = 'Archived'
       WHERE version_id = $1
       RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Article version not found',
      });
    }

    res.json({
      success: true,
      message: 'Version archived successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error archiving version:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to archive version',
      error: error.message,
    });
  }
});

/**
 * GET /api/knowledge-versions/:id/compare/:compareId
 * Compare two versions of an article
 */
router.get('/:id/compare/:compareId', async (req: Request, res: Response) => {
  try {
    const { id, compareId } = req.params;

    const versions = await queryWithTenant(
      `SELECT * FROM knowledge_article_versions
       WHERE version_id IN ($1, $2)
       ORDER BY version_number`,
      [id, compareId]
    );

    if (versions.length < 2) {
      return res.status(404).json({
        success: false,
        message: 'One or both versions not found',
      });
    }

    res.json({
      success: true,
      data: {
        original: versions[0],
        comparison: versions[1],
      },
    });
  } catch (error: any) {
    console.error('Error comparing versions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to compare versions',
      error: error.message,
    });
  }
});

export default router;
