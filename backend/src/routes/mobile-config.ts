import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/mobile-config
 * Get mobile configuration for the tenant
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const configs = await queryWithTenant(
      `SELECT * FROM mobile_config ORDER BY created_date DESC`,
      []
    );

    res.json({
      success: true,
      data: configs.length > 0 ? configs[0] : null,
    });
  } catch (error: any) {
    console.error('Error fetching mobile config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch mobile config',
      error: error.message,
    });
  }
});

/**
 * POST /api/mobile-config
 * Create or update mobile configuration
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { enabled_objects, mobile_navigation, offline_enabled, settings } = req.body;

    // Check if config already exists
    const existing = await queryWithTenant(`SELECT * FROM mobile_config LIMIT 1`, []);

    let result;
    if (existing.length > 0) {
      // Update existing config
      result = await queryWithTenant(
        `UPDATE mobile_config SET
          enabled_objects = $1,
          mobile_navigation = $2,
          offline_enabled = $3,
          settings = $4,
          updated_date = CURRENT_TIMESTAMP
         WHERE config_id = $5
         RETURNING *`,
        [
          JSON.stringify(enabled_objects || []),
          JSON.stringify(mobile_navigation || []),
          offline_enabled !== false,
          JSON.stringify(settings || {}),
          existing[0].config_id,
        ]
      );
    } else {
      // Create new config
      result = await queryWithTenant(
        `INSERT INTO mobile_config (
          enabled_objects,
          mobile_navigation,
          offline_enabled,
          settings
        ) VALUES ($1, $2, $3, $4)
        RETURNING *`,
        [
          JSON.stringify(enabled_objects || []),
          JSON.stringify(mobile_navigation || []),
          offline_enabled !== false,
          JSON.stringify(settings || {}),
        ]
      );
    }

    res.status(existing.length > 0 ? 200 : 201).json({
      success: true,
      message: `Mobile configuration ${existing.length > 0 ? 'updated' : 'created'} successfully`,
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error saving mobile config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save mobile config',
      error: error.message,
    });
  }
});

/**
 * GET /api/mobile-config/objects
 * Get enabled objects for mobile
 */
router.get('/objects', async (req: Request, res: Response) => {
  try {
    const configs = await queryWithTenant(
      `SELECT enabled_objects FROM mobile_config LIMIT 1`,
      []
    );

    const enabledObjects = configs.length > 0 ? configs[0].enabled_objects || [] : [];

    res.json({
      success: true,
      data: enabledObjects,
    });
  } catch (error: any) {
    console.error('Error fetching mobile objects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch mobile objects',
      error: error.message,
    });
  }
});

/**
 * POST /api/mobile-config/objects
 * Enable or disable objects for mobile
 */
router.post('/objects', async (req: Request, res: Response) => {
  try {
    const { object_name, enabled } = req.body;

    if (!object_name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: object_name',
      });
    }

    const configs = await queryWithTenant(`SELECT * FROM mobile_config LIMIT 1`, []);

    let enabledObjects = configs.length > 0 ? configs[0].enabled_objects || [] : [];

    if (enabled) {
      // Add object if not already enabled
      if (!enabledObjects.includes(object_name)) {
        enabledObjects.push(object_name);
      }
    } else {
      // Remove object
      enabledObjects = enabledObjects.filter((obj: string) => obj !== object_name);
    }

    let result;
    if (configs.length > 0) {
      result = await queryWithTenant(
        `UPDATE mobile_config SET enabled_objects = $1 WHERE config_id = $2 RETURNING *`,
        [JSON.stringify(enabledObjects), configs[0].config_id]
      );
    } else {
      result = await queryWithTenant(
        `INSERT INTO mobile_config (enabled_objects) VALUES ($1) RETURNING *`,
        [JSON.stringify(enabledObjects)]
      );
    }

    res.json({
      success: true,
      message: `Object ${enabled ? 'enabled' : 'disabled'} for mobile`,
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating mobile objects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update mobile objects',
      error: error.message,
    });
  }
});

/**
 * GET /api/mobile-config/navigation
 * Get mobile navigation configuration
 */
router.get('/navigation', async (req: Request, res: Response) => {
  try {
    const configs = await queryWithTenant(
      `SELECT mobile_navigation FROM mobile_config LIMIT 1`,
      []
    );

    const navigation = configs.length > 0 ? configs[0].mobile_navigation || [] : [];

    res.json({
      success: true,
      data: navigation,
    });
  } catch (error: any) {
    console.error('Error fetching mobile navigation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch mobile navigation',
      error: error.message,
    });
  }
});

/**
 * POST /api/mobile-config/navigation
 * Update mobile navigation configuration
 */
router.post('/navigation', async (req: Request, res: Response) => {
  try {
    const { navigation } = req.body;

    if (!navigation || !Array.isArray(navigation)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid navigation data: must be an array',
      });
    }

    const configs = await queryWithTenant(`SELECT * FROM mobile_config LIMIT 1`, []);

    let result;
    if (configs.length > 0) {
      result = await queryWithTenant(
        `UPDATE mobile_config SET mobile_navigation = $1 WHERE config_id = $2 RETURNING *`,
        [JSON.stringify(navigation), configs[0].config_id]
      );
    } else {
      result = await queryWithTenant(
        `INSERT INTO mobile_config (mobile_navigation) VALUES ($1) RETURNING *`,
        [JSON.stringify(navigation)]
      );
    }

    res.json({
      success: true,
      message: 'Mobile navigation updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating mobile navigation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update mobile navigation',
      error: error.message,
    });
  }
});

export default router;
