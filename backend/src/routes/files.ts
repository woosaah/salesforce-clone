import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/files
 * Get all files for the tenant
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { parent_id, owner_id, limit = 50 } = req.query;

    let query = `
      SELECT f.*,
             u.first_name || ' ' || u.last_name as owner_name,
             (SELECT COUNT(*) FROM file_versions fv WHERE fv.file_id = f.file_id) as version_count
      FROM files f
      LEFT JOIN users u ON f.owner_id = u.user_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (parent_id) {
      query += ` AND f.parent_id = $${paramIndex}`;
      params.push(parent_id);
      paramIndex++;
    }

    if (owner_id) {
      query += ` AND f.owner_id = $${paramIndex}`;
      params.push(owner_id);
      paramIndex++;
    }

    query += ` ORDER BY f.created_date DESC LIMIT $${paramIndex}`;
    params.push(Number(limit));

    const files = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: files,
    });
  } catch (error: any) {
    console.error('Error fetching files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch files',
      error: error.message,
    });
  }
});

/**
 * GET /api/files/:id
 * Get a specific file
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const files = await queryWithTenant(
      `SELECT f.*,
              u.first_name || ' ' || u.last_name as owner_name
       FROM files f
       LEFT JOIN users u ON f.owner_id = u.user_id
       WHERE f.file_id = $1`,
      [id]
    );

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    res.json({
      success: true,
      data: files[0],
    });
  } catch (error: any) {
    console.error('Error fetching file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch file',
      error: error.message,
    });
  }
});

/**
 * POST /api/files
 * Upload a new file
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      file_name,
      file_type,
      file_size,
      file_path,
      parent_id,
      description,
      is_public,
    } = req.body;

    if (!file_name || !file_type || !file_size || !file_path) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: file_name, file_type, file_size, file_path',
      });
    }

    const owner_id = (req as any).user.userId; // From auth middleware

    const result = await queryWithTenant(
      `INSERT INTO files (
        file_name,
        file_type,
        file_size,
        file_path,
        parent_id,
        owner_id,
        description,
        is_public
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        file_name,
        file_type,
        file_size,
        file_path,
        parent_id,
        owner_id,
        description,
        is_public !== false,
      ]
    );

    // Create initial version
    await queryWithTenant(
      `INSERT INTO file_versions (
        file_id,
        version_number,
        file_size,
        file_path,
        uploaded_by
      ) VALUES ($1, $2, $3, $4, $5)`,
      [result[0].file_id, 1, file_size, file_path, owner_id]
    );

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload file',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/files/:id
 * Update file metadata
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['file_name', 'description', 'is_public', 'parent_id'];

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
      `UPDATE files SET ${setFields.join(', ')}, updated_date = CURRENT_TIMESTAMP
       WHERE file_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    res.json({
      success: true,
      message: 'File updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update file',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/files/:id
 * Delete a file
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Delete all versions first
    await queryWithTenant(`DELETE FROM file_versions WHERE file_id = $1`, [id]);

    const result = await queryWithTenant(
      `DELETE FROM files WHERE file_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    res.json({
      success: true,
      message: 'File deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: error.message,
    });
  }
});

/**
 * GET /api/files/:id/versions
 * Get all versions of a file
 */
router.get('/:id/versions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const versions = await queryWithTenant(
      `SELECT fv.*,
              u.first_name || ' ' || u.last_name as uploaded_by_name
       FROM file_versions fv
       LEFT JOIN users u ON fv.uploaded_by = u.user_id
       WHERE fv.file_id = $1
       ORDER BY fv.version_number DESC`,
      [id]
    );

    res.json({
      success: true,
      data: versions,
    });
  } catch (error: any) {
    console.error('Error fetching file versions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch file versions',
      error: error.message,
    });
  }
});

/**
 * POST /api/files/:id/versions
 * Upload a new version of a file
 */
router.post('/:id/versions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { file_size, file_path, change_notes } = req.body;

    if (!file_size || !file_path) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: file_size, file_path',
      });
    }

    const owner_id = (req as any).user.userId;

    // Get next version number
    const versionNumbers = await queryWithTenant(
      `SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
       FROM file_versions
       WHERE file_id = $1`,
      [id]
    );

    const versionNumber = versionNumbers[0].next_version;

    const result = await queryWithTenant(
      `INSERT INTO file_versions (
        file_id,
        version_number,
        file_size,
        file_path,
        change_notes,
        uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [id, versionNumber, file_size, file_path, change_notes, owner_id]
    );

    // Update file's current version and size
    await queryWithTenant(
      `UPDATE files SET file_size = $1, updated_date = CURRENT_TIMESTAMP
       WHERE file_id = $2`,
      [file_size, id]
    );

    res.status(201).json({
      success: true,
      message: 'New file version uploaded successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error uploading file version:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload file version',
      error: error.message,
    });
  }
});

/**
 * GET /api/files/:id/share
 * Get file sharing settings
 */
router.get('/:id/share', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const shares = await queryWithTenant(
      `SELECT fs.*,
              u.first_name || ' ' || u.last_name as shared_with_name
       FROM file_shares fs
       LEFT JOIN users u ON fs.shared_with_user_id = u.user_id
       WHERE fs.file_id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: shares,
    });
  } catch (error: any) {
    console.error('Error fetching file shares:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch file shares',
      error: error.message,
    });
  }
});

/**
 * POST /api/files/:id/share
 * Share a file with a user
 */
router.post('/:id/share', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { shared_with_user_id, permission_level } = req.body;

    if (!shared_with_user_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: shared_with_user_id',
      });
    }

    const owner_id = (req as any).user.userId;

    const result = await queryWithTenant(
      `INSERT INTO file_shares (
        file_id,
        shared_with_user_id,
        shared_by_user_id,
        permission_level
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [id, shared_with_user_id, owner_id, permission_level || 'View']
    );

    res.status(201).json({
      success: true,
      message: 'File shared successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error sharing file:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to share file',
      error: error.message,
    });
  }
});

export default router;
