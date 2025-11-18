import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/notes
 * Get all notes for the tenant
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { parent_id, owner_id, limit = 50 } = req.query;

    let query = `
      SELECT n.*,
             u.first_name || ' ' || u.last_name as owner_name
      FROM notes n
      LEFT JOIN users u ON n.owner_id = u.user_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (parent_id) {
      query += ` AND n.parent_id = $${paramIndex}`;
      params.push(parent_id);
      paramIndex++;
    }

    if (owner_id) {
      query += ` AND n.owner_id = $${paramIndex}`;
      params.push(owner_id);
      paramIndex++;
    }

    query += ` ORDER BY n.created_date DESC LIMIT $${paramIndex}`;
    params.push(Number(limit));

    const notes = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: notes,
    });
  } catch (error: any) {
    console.error('Error fetching notes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notes',
      error: error.message,
    });
  }
});

/**
 * GET /api/notes/:id
 * Get a specific note
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const notes = await queryWithTenant(
      `SELECT n.*,
              u.first_name || ' ' || u.last_name as owner_name
       FROM notes n
       LEFT JOIN users u ON n.owner_id = u.user_id
       WHERE n.note_id = $1`,
      [id]
    );

    if (notes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Note not found',
      });
    }

    res.json({
      success: true,
      data: notes[0],
    });
  } catch (error: any) {
    console.error('Error fetching note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch note',
      error: error.message,
    });
  }
});

/**
 * POST /api/notes
 * Create a new note
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, body, parent_id, is_private } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, body',
      });
    }

    const owner_id = (req as any).user.userId;

    const result = await queryWithTenant(
      `INSERT INTO notes (
        title,
        body,
        parent_id,
        owner_id,
        is_private
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [title, body, parent_id, owner_id, is_private || false]
    );

    res.status(201).json({
      success: true,
      message: 'Note created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create note',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/notes/:id
 * Update a note
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['title', 'body', 'is_private'];

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
      `UPDATE notes SET ${setFields.join(', ')}, updated_date = CURRENT_TIMESTAMP
       WHERE note_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Note not found',
      });
    }

    res.json({
      success: true,
      message: 'Note updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update note',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/notes/:id
 * Delete a note
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM notes WHERE note_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Note not found',
      });
    }

    res.json({
      success: true,
      message: 'Note deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete note',
      error: error.message,
    });
  }
});

/**
 * GET /api/notes/attachments
 * Get attachments
 */
router.get('/attachments', async (req: Request, res: Response) => {
  try {
    const { parent_id } = req.query;

    let query = `SELECT * FROM attachments WHERE 1=1`;
    const params: any[] = [];

    if (parent_id) {
      query += ` AND parent_id = $1`;
      params.push(parent_id);
    }

    query += ` ORDER BY created_date DESC`;

    const attachments = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: attachments,
    });
  } catch (error: any) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attachments',
      error: error.message,
    });
  }
});

/**
 * POST /api/notes/attachments
 * Create an attachment
 */
router.post('/attachments', async (req: Request, res: Response) => {
  try {
    const { name, body, content_type, parent_id, is_private } = req.body;

    if (!name || !body || !parent_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, body, parent_id',
      });
    }

    const owner_id = (req as any).user.userId;

    const result = await queryWithTenant(
      `INSERT INTO attachments (
        name,
        body,
        content_type,
        parent_id,
        owner_id,
        is_private
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [name, body, content_type, parent_id, owner_id, is_private || false]
    );

    res.status(201).json({
      success: true,
      message: 'Attachment created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating attachment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create attachment',
      error: error.message,
    });
  }
});

export default router;
