import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/service-console/settings
 * Get service console configuration
 */
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const settings = await queryWithTenant(
      `SELECT * FROM service_console_config LIMIT 1`,
      []
    );

    res.json({
      success: true,
      data: settings.length > 0 ? settings[0] : null,
    });
  } catch (error: any) {
    console.error('Error fetching service console settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service console settings',
      error: error.message,
    });
  }
});

/**
 * POST /api/service-console/settings
 * Update service console configuration
 */
router.post('/settings', async (req: Request, res: Response) => {
  try {
    const {
      enabled_apps,
      layout_config,
      quick_actions,
      keyboard_shortcuts,
      presence_config,
    } = req.body;

    const existing = await queryWithTenant(
      `SELECT * FROM service_console_config LIMIT 1`,
      []
    );

    let result;
    if (existing.length > 0) {
      result = await queryWithTenant(
        `UPDATE service_console_config SET
          enabled_apps = $1,
          layout_config = $2,
          quick_actions = $3,
          keyboard_shortcuts = $4,
          presence_config = $5
         WHERE config_id = $6
         RETURNING *`,
        [
          JSON.stringify(enabled_apps || []),
          JSON.stringify(layout_config || {}),
          JSON.stringify(quick_actions || []),
          JSON.stringify(keyboard_shortcuts || {}),
          JSON.stringify(presence_config || {}),
          existing[0].config_id,
        ]
      );
    } else {
      result = await queryWithTenant(
        `INSERT INTO service_console_config (
          enabled_apps,
          layout_config,
          quick_actions,
          keyboard_shortcuts,
          presence_config
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [
          JSON.stringify(enabled_apps || []),
          JSON.stringify(layout_config || {}),
          JSON.stringify(quick_actions || []),
          JSON.stringify(keyboard_shortcuts || {}),
          JSON.stringify(presence_config || {}),
        ]
      );
    }

    res.json({
      success: true,
      message: 'Service console settings updated',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating service console settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update service console settings',
      error: error.message,
    });
  }
});

/**
 * GET /api/service-console/utilities
 * Get utility bar utilities
 */
router.get('/utilities', async (req: Request, res: Response) => {
  try {
    const utilities = await queryWithTenant(
      `SELECT * FROM console_utilities ORDER BY sort_order`,
      []
    );

    res.json({
      success: true,
      data: utilities,
    });
  } catch (error: any) {
    console.error('Error fetching utilities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch utilities',
      error: error.message,
    });
  }
});

/**
 * POST /api/service-console/utilities
 * Add a utility to the utility bar
 */
router.post('/utilities', async (req: Request, res: Response) => {
  try {
    const { utility_name, utility_type, config, is_active, sort_order } = req.body;

    if (!utility_name || !utility_type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: utility_name, utility_type',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO console_utilities (
        utility_name,
        utility_type,
        config,
        is_active,
        sort_order
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        utility_name,
        utility_type,
        JSON.stringify(config || {}),
        is_active !== false,
        sort_order || 0,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Utility added successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error adding utility:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add utility',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/service-console/utilities/:id
 * Update a utility
 */
router.patch('/utilities/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['utility_name', 'config', 'is_active', 'sort_order'];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(
          key === 'config' && typeof updates[key] === 'object'
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
      `UPDATE console_utilities SET ${setFields.join(', ')}
       WHERE utility_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utility not found',
      });
    }

    res.json({
      success: true,
      message: 'Utility updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating utility:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update utility',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/service-console/utilities/:id
 * Remove a utility
 */
router.delete('/utilities/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM console_utilities WHERE utility_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utility not found',
      });
    }

    res.json({
      success: true,
      message: 'Utility removed successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error removing utility:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove utility',
      error: error.message,
    });
  }
});

export default router;
