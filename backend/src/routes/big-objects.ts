import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/big-objects
 * Get all big object definitions
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const bigObjects = await queryWithTenant(
      `SELECT * FROM big_objects ORDER BY object_name`,
      []
    );

    res.json({
      success: true,
      data: bigObjects,
    });
  } catch (error: any) {
    console.error('Error fetching big objects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch big objects',
      error: error.message,
    });
  }
});

/**
 * POST /api/big-objects
 * Create a new big object definition
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { object_name, fields, index_fields } = req.body;

    if (!object_name || !fields) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: object_name, fields',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO big_objects (
        object_name,
        fields,
        index_fields
      ) VALUES ($1, $2, $3)
      RETURNING *`,
      [object_name, JSON.stringify(fields), JSON.stringify(index_fields || [])]
    );

    res.status(201).json({
      success: true,
      message: 'Big object created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating big object:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create big object',
      error: error.message,
    });
  }
});

/**
 * GET /api/big-objects/:objectName/records
 * Query big object records
 */
router.get('/:objectName/records', async (req: Request, res: Response) => {
  try {
    const { objectName } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    // Check if big object exists
    const bigObjects = await queryWithTenant(
      `SELECT * FROM big_objects WHERE object_name = $1`,
      [objectName]
    );

    if (bigObjects.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Big object not found',
      });
    }

    // Query the archive table (partition by date)
    const records = await queryWithTenant(
      `SELECT * FROM big_object_archive
       WHERE object_name = $1
       ORDER BY created_date DESC
       LIMIT $2 OFFSET $3`,
      [objectName, Number(limit), Number(offset)]
    );

    res.json({
      success: true,
      object_name: objectName,
      count: records.length,
      data: records,
    });
  } catch (error: any) {
    console.error('Error querying big object records:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to query big object records',
      error: error.message,
    });
  }
});

/**
 * POST /api/big-objects/:objectName/records
 * Insert records into big object
 */
router.post('/:objectName/records', async (req: Request, res: Response) => {
  try {
    const { objectName } = req.params;
    const { records } = req.body;

    if (!records || !Array.isArray(records)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: records (array)',
      });
    }

    // Check if big object exists
    const bigObjects = await queryWithTenant(
      `SELECT * FROM big_objects WHERE object_name = $1`,
      [objectName]
    );

    if (bigObjects.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Big object not found',
      });
    }

    const results = [];
    for (const record of records) {
      try {
        const result = await queryWithTenant(
          `INSERT INTO big_object_archive (
            object_name,
            record_data
          ) VALUES ($1, $2)
          RETURNING *`,
          [objectName, JSON.stringify(record)]
        );
        results.push({ success: true, record_id: result[0].record_id });
      } catch (error: any) {
        results.push({ success: false, error: error.message });
      }
    }

    res.status(201).json({
      success: true,
      message: `Inserted ${results.filter((r) => r.success).length} of ${records.length} records`,
      data: results,
    });
  } catch (error: any) {
    console.error('Error inserting big object records:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to insert big object records',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/big-objects/:objectName/records
 * Delete old records from big object (data retention)
 */
router.delete('/:objectName/records', async (req: Request, res: Response) => {
  try {
    const { objectName } = req.params;
    const { before_date } = req.body;

    if (!before_date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: before_date',
      });
    }

    const result = await queryWithTenant(
      `DELETE FROM big_object_archive
       WHERE object_name = $1 AND created_date < $2
       RETURNING record_id`,
      [objectName, before_date]
    );

    res.json({
      success: true,
      message: `Deleted ${result.length} records`,
      deleted_count: result.length,
    });
  } catch (error: any) {
    console.error('Error deleting big object records:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete big object records',
      error: error.message,
    });
  }
});

export default router;
