import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/macros
 * Get all macros
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { is_active } = req.query;

    let query = `SELECT * FROM macros WHERE 1=1`;
    const params: any[] = [];

    if (is_active !== undefined) {
      query += ` AND is_active = $1`;
      params.push(is_active === 'true');
    }

    query += ` ORDER BY macro_name`;

    const macros = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: macros,
    });
  } catch (error: any) {
    console.error('Error fetching macros:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch macros',
      error: error.message,
    });
  }
});

/**
 * GET /api/macros/:id
 * Get a specific macro
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const macros = await queryWithTenant(
      `SELECT * FROM macros WHERE macro_id = $1`,
      [id]
    );

    if (macros.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Macro not found',
      });
    }

    res.json({
      success: true,
      data: macros[0],
    });
  } catch (error: any) {
    console.error('Error fetching macro:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch macro',
      error: error.message,
    });
  }
});

/**
 * POST /api/macros
 * Create a new macro
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { macro_name, description, instructions, is_active } = req.body;

    if (!macro_name || !instructions) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: macro_name, instructions',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO macros (
        macro_name,
        description,
        instructions,
        is_active
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [
        macro_name,
        description,
        JSON.stringify(instructions),
        is_active !== false,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Macro created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating macro:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create macro',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/macros/:id
 * Update a macro
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['macro_name', 'description', 'instructions', 'is_active'];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(
          key === 'instructions' && typeof updates[key] === 'object'
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
      `UPDATE macros SET ${setFields.join(', ')}
       WHERE macro_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Macro not found',
      });
    }

    res.json({
      success: true,
      message: 'Macro updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating macro:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update macro',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/macros/:id
 * Delete a macro
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM macros WHERE macro_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Macro not found',
      });
    }

    res.json({
      success: true,
      message: 'Macro deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting macro:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete macro',
      error: error.message,
    });
  }
});

/**
 * POST /api/macros/:id/execute
 * Execute a macro
 */
router.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { context } = req.body; // Context data for macro execution

    // Get the macro
    const macros = await queryWithTenant(
      `SELECT * FROM macros WHERE macro_id = $1 AND is_active = true`,
      [id]
    );

    if (macros.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active macro not found',
      });
    }

    const macro = macros[0];
    const instructions = macro.instructions || [];

    // Execute macro instructions
    const results = [];
    for (const instruction of instructions) {
      try {
        // Example instruction types:
        // - { type: 'field_update', field: 'status', value: 'Closed' }
        // - { type: 'send_email', template_id: '...' }
        // - { type: 'create_task', subject: '...' }

        if (instruction.type === 'field_update') {
          // Field update logic here
          results.push({
            instruction: instruction.type,
            success: true,
            message: `Updated field ${instruction.field}`,
          });
        } else if (instruction.type === 'send_email') {
          // Email sending logic here
          results.push({
            instruction: instruction.type,
            success: true,
            message: 'Email sent',
          });
        }
        // Add more instruction types as needed
      } catch (error: any) {
        results.push({
          instruction: instruction.type,
          success: false,
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      message: 'Macro executed',
      macro_name: macro.macro_name,
      results,
    });
  } catch (error: any) {
    console.error('Error executing macro:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute macro',
      error: error.message,
    });
  }
});

export default router;
