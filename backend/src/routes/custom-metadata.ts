import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/custom-metadata/types
 * Get all custom metadata types
 */
router.get('/types', async (req: Request, res: Response) => {
  try {
    const { is_protected } = req.query;

    let query = `SELECT * FROM custom_metadata_types WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (is_protected !== undefined) {
      query += ` AND is_protected = $${paramIndex}`;
      params.push(is_protected === 'true');
      paramIndex++;
    }

    query += ` ORDER BY type_name`;

    const types = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: types,
    });
  } catch (error: any) {
    console.error('Error fetching custom metadata types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch custom metadata types',
      error: error.message,
    });
  }
});

/**
 * GET /api/custom-metadata/types/:id
 * Get a specific custom metadata type
 */
router.get('/types/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const types = await queryWithTenant(
      `SELECT * FROM custom_metadata_types WHERE type_id = $1`,
      [id]
    );

    if (types.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Custom metadata type not found',
      });
    }

    res.json({
      success: true,
      data: types[0],
    });
  } catch (error: any) {
    console.error('Error fetching custom metadata type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch custom metadata type',
      error: error.message,
    });
  }
});

/**
 * POST /api/custom-metadata/types
 * Create a custom metadata type
 */
router.post('/types', async (req: Request, res: Response) => {
  try {
    const { type_name, label, plural_label, description, is_protected } = req.body;

    if (!type_name || !label) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: type_name, label',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO custom_metadata_types (
        type_name,
        label,
        plural_label,
        description,
        is_protected
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [type_name, label, plural_label || label, description, is_protected || false]
    );

    res.status(201).json({
      success: true,
      message: 'Custom metadata type created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating custom metadata type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create custom metadata type',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/custom-metadata/types/:id
 * Update a custom metadata type
 */
router.patch('/types/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['label', 'plural_label', 'description'];

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
      `UPDATE custom_metadata_types SET ${setFields.join(', ')}
       WHERE type_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Custom metadata type not found',
      });
    }

    res.json({
      success: true,
      message: 'Custom metadata type updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating custom metadata type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update custom metadata type',
      error: error.message,
    });
  }
});

/**
 * GET /api/custom-metadata/types/:typeId/fields
 * Get fields for a custom metadata type
 */
router.get('/types/:typeId/fields', async (req: Request, res: Response) => {
  try {
    const { typeId } = req.params;

    const fields = await queryWithTenant(
      `SELECT * FROM custom_metadata_fields WHERE type_id = $1 ORDER BY field_name`,
      [typeId]
    );

    res.json({
      success: true,
      data: fields,
    });
  } catch (error: any) {
    console.error('Error fetching fields:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fields',
      error: error.message,
    });
  }
});

/**
 * POST /api/custom-metadata/types/:typeId/fields
 * Add a field to a custom metadata type
 */
router.post('/types/:typeId/fields', async (req: Request, res: Response) => {
  try {
    const { typeId } = req.params;
    const { field_name, label, data_type, default_value, is_required } = req.body;

    if (!field_name || !label || !data_type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: field_name, label, data_type',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO custom_metadata_fields (
        type_id,
        field_name,
        label,
        data_type,
        default_value,
        is_required
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [typeId, field_name, label, data_type, default_value, is_required || false]
    );

    res.status(201).json({
      success: true,
      message: 'Field added successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error adding field:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add field',
      error: error.message,
    });
  }
});

/**
 * GET /api/custom-metadata/records
 * Get custom metadata records
 */
router.get('/records', async (req: Request, res: Response) => {
  try {
    const { type_id } = req.query;

    let query = `
      SELECT cmr.*,
             cmt.type_name,
             cmt.label as type_label
      FROM custom_metadata_records cmr
      JOIN custom_metadata_types cmt ON cmr.type_id = cmt.type_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (type_id) {
      query += ` AND cmr.type_id = $${paramIndex}`;
      params.push(type_id);
      paramIndex++;
    }

    query += ` ORDER BY cmr.record_name`;

    const records = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: records,
    });
  } catch (error: any) {
    console.error('Error fetching custom metadata records:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch custom metadata records',
      error: error.message,
    });
  }
});

/**
 * GET /api/custom-metadata/records/:id
 * Get a specific custom metadata record
 */
router.get('/records/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const records = await queryWithTenant(
      `SELECT cmr.*,
              cmt.type_name,
              cmt.label as type_label
       FROM custom_metadata_records cmr
       JOIN custom_metadata_types cmt ON cmr.type_id = cmt.type_id
       WHERE cmr.record_id = $1`,
      [id]
    );

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Custom metadata record not found',
      });
    }

    res.json({
      success: true,
      data: records[0],
    });
  } catch (error: any) {
    console.error('Error fetching custom metadata record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch custom metadata record',
      error: error.message,
    });
  }
});

/**
 * POST /api/custom-metadata/records
 * Create a custom metadata record
 */
router.post('/records', async (req: Request, res: Response) => {
  try {
    const { type_id, record_name, label, field_values } = req.body;

    if (!type_id || !record_name || !label) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: type_id, record_name, label',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO custom_metadata_records (
        type_id,
        record_name,
        label,
        field_values
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [type_id, record_name, label, JSON.stringify(field_values || {})]
    );

    res.status(201).json({
      success: true,
      message: 'Custom metadata record created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating custom metadata record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create custom metadata record',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/custom-metadata/records/:id
 * Update a custom metadata record
 */
router.patch('/records/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['label', 'field_values'];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(
          key === 'field_values' && typeof updates[key] === 'object'
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
      `UPDATE custom_metadata_records SET ${setFields.join(', ')}
       WHERE record_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Custom metadata record not found',
      });
    }

    res.json({
      success: true,
      message: 'Custom metadata record updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating custom metadata record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update custom metadata record',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/custom-metadata/records/:id
 * Delete a custom metadata record
 */
router.delete('/records/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM custom_metadata_records WHERE record_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Custom metadata record not found',
      });
    }

    res.json({
      success: true,
      message: 'Custom metadata record deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting custom metadata record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete custom metadata record',
      error: error.message,
    });
  }
});

/**
 * POST /api/custom-metadata/deploy
 * Deploy custom metadata (for packaging/deployment)
 */
router.post('/deploy', async (req: Request, res: Response) => {
  try {
    const { type_ids, record_ids } = req.body;

    if (!type_ids && !record_ids) {
      return res.status(400).json({
        success: false,
        message: 'Must provide type_ids or record_ids for deployment',
      });
    }

    const deployment = {
      types: [],
      records: [],
      status: 'Success',
    };

    // Get types to deploy
    if (type_ids && Array.isArray(type_ids)) {
      const types = await queryWithTenant(
        `SELECT * FROM custom_metadata_types WHERE type_id = ANY($1::uuid[])`,
        [type_ids]
      );
      deployment.types = types;
    }

    // Get records to deploy
    if (record_ids && Array.isArray(record_ids)) {
      const records = await queryWithTenant(
        `SELECT * FROM custom_metadata_records WHERE record_id = ANY($1::uuid[])`,
        [record_ids]
      );
      deployment.records = records;
    }

    // In real implementation, this would create deployment package
    res.json({
      success: true,
      message: 'Custom metadata deployment prepared',
      data: deployment,
    });
  } catch (error: any) {
    console.error('Error deploying custom metadata:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deploy custom metadata',
      error: error.message,
    });
  }
});

export default router;
