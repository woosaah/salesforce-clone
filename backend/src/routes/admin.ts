import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { queryWithTenant } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Helper to handle async routes
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: Function) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Validation helper
const validate = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
};

// ============================================================================
// OBJECT MANAGEMENT
// ============================================================================

// Get all objects (including custom)
router.get('/objects', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const result = await queryWithTenant(
    req.tenantId!,
    `SELECT object_id, object_name, label, plural_label, is_custom, is_active,
            description, created_date, modified_date
     FROM objects_meta
     ORDER BY is_custom ASC, label ASC`
  );

  res.json({ success: true, data: result.rows });
}));

// Get single object with fields
router.get('/objects/:objectId',
  authenticate,
  param('objectId').isUUID(),
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    // Get object
    const objectResult = await queryWithTenant(
      req.tenantId!,
      `SELECT * FROM objects_meta WHERE object_id = $1`,
      [req.params.objectId]
    );

    if (objectResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Object not found' });
    }

    // Get fields
    const fieldsResult = await queryWithTenant(
      req.tenantId!,
      `SELECT f.*, o.object_name as lookup_object_name, o.label as lookup_object_label
       FROM fields_meta f
       LEFT JOIN objects_meta o ON f.lookup_object_id = o.object_id
       WHERE f.object_id = $1
       ORDER BY f.created_date ASC`,
      [req.params.objectId]
    );

    res.json({
      success: true,
      data: {
        object: objectResult.rows[0],
        fields: fieldsResult.rows
      }
    });
  })
);

// Create new object
router.post('/objects',
  authenticate,
  [
    body('object_name').trim().notEmpty().matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)
      .withMessage('Object name must start with letter and contain only alphanumeric and underscore'),
    body('label').trim().notEmpty(),
    body('plural_label').trim().notEmpty(),
    body('description').optional().trim(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const { object_name, label, plural_label, description } = req.body;

    // Check if object name already exists
    const existingCheck = await queryWithTenant(
      req.tenantId!,
      `SELECT object_id FROM objects_meta WHERE LOWER(object_name) = LOWER($1)`,
      [object_name]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Object with this name already exists'
      });
    }

    const objectId = uuidv4();

    const result = await queryWithTenant(
      req.tenantId!,
      `INSERT INTO objects_meta
       (object_id, tenant_id, object_name, label, plural_label, is_custom, is_active, description, created_by)
       VALUES ($1, $2, $3, $4, $5, true, true, $6, $7)
       RETURNING *`,
      [objectId, req.tenantId, object_name, label, plural_label, description || null, req.userId]
    );

    // Create default Name field
    const nameFieldId = uuidv4();
    await queryWithTenant(
      req.tenantId!,
      `INSERT INTO fields_meta
       (field_id, tenant_id, object_id, field_name, label, field_type, is_required, max_length)
       VALUES ($1, $2, $3, 'Name', 'Name', 'text', true, 255)`,
      [nameFieldId, req.tenantId, objectId]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Object created successfully'
    });
  })
);

// Update object
router.put('/objects/:objectId',
  authenticate,
  [
    param('objectId').isUUID(),
    body('label').optional().trim().notEmpty(),
    body('plural_label').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('is_active').optional().isBoolean(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const { label, plural_label, description, is_active } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (label !== undefined) {
      updates.push(`label = $${paramCount++}`);
      values.push(label);
    }
    if (plural_label !== undefined) {
      updates.push(`plural_label = $${paramCount++}`);
      values.push(plural_label);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push(`modified_date = CURRENT_TIMESTAMP`);
    values.push(req.params.objectId);

    const result = await queryWithTenant(
      req.tenantId!,
      `UPDATE objects_meta
       SET ${updates.join(', ')}
       WHERE object_id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Object not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Object updated successfully'
    });
  })
);

// Delete object (soft delete)
router.delete('/objects/:objectId',
  authenticate,
  param('objectId').isUUID(),
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    // Check if it's a standard object
    const objectCheck = await queryWithTenant(
      req.tenantId!,
      `SELECT is_custom FROM objects_meta WHERE object_id = $1`,
      [req.params.objectId]
    );

    if (objectCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Object not found' });
    }

    if (!objectCheck.rows[0].is_custom) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete standard objects'
      });
    }

    // Soft delete - set is_active to false
    await queryWithTenant(
      req.tenantId!,
      `UPDATE objects_meta SET is_active = false, modified_date = CURRENT_TIMESTAMP
       WHERE object_id = $1`,
      [req.params.objectId]
    );

    res.json({
      success: true,
      message: 'Object deleted successfully'
    });
  })
);

// ============================================================================
// FIELD MANAGEMENT
// ============================================================================

// Create new field
router.post('/objects/:objectId/fields',
  authenticate,
  [
    param('objectId').isUUID(),
    body('field_name').trim().notEmpty().matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)
      .withMessage('Field name must start with letter and contain only alphanumeric and underscore'),
    body('label').trim().notEmpty(),
    body('field_type').isIn([
      'text', 'textarea', 'email', 'phone', 'url',
      'number', 'currency', 'percent',
      'date', 'datetime', 'time',
      'checkbox', 'picklist', 'multipicklist',
      'lookup', 'master_detail',
      'formula', 'rollup_summary', 'auto_number'
    ]),
    body('is_required').optional().isBoolean(),
    body('is_unique').optional().isBoolean(),
    body('default_value').optional(),
    body('description').optional().trim(),
    body('max_length').optional().isInt({ min: 1, max: 131072 }),
    body('min_value').optional().isNumeric(),
    body('max_value').optional().isNumeric(),
    body('picklist_values').optional().isArray(),
    body('lookup_object_id').optional().isUUID(),
    body('formula_expression').optional().trim(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const {
      field_name, label, field_type, is_required, is_unique,
      default_value, description, max_length, min_value, max_value,
      picklist_values, lookup_object_id, formula_expression
    } = req.body;

    // Check if field name already exists for this object
    const existingCheck = await queryWithTenant(
      req.tenantId!,
      `SELECT field_id FROM fields_meta WHERE object_id = $1 AND LOWER(field_name) = LOWER($2)`,
      [req.params.objectId, field_name]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Field with this name already exists on this object'
      });
    }

    // Validate picklist values for picklist fields
    if ((field_type === 'picklist' || field_type === 'multipicklist') && !picklist_values) {
      return res.status(400).json({
        success: false,
        message: 'Picklist values are required for picklist fields'
      });
    }

    // Validate lookup object for lookup/master-detail fields
    if ((field_type === 'lookup' || field_type === 'master_detail') && !lookup_object_id) {
      return res.status(400).json({
        success: false,
        message: 'Lookup object is required for relationship fields'
      });
    }

    const fieldId = uuidv4();

    const result = await queryWithTenant(
      req.tenantId!,
      `INSERT INTO fields_meta
       (field_id, tenant_id, object_id, field_name, label, field_type,
        is_required, is_unique, default_value, description,
        max_length, min_value, max_value, picklist_values,
        lookup_object_id, formula_expression)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        fieldId, req.tenantId, req.params.objectId, field_name, label, field_type,
        is_required || false, is_unique || false, default_value || null, description || null,
        max_length || null, min_value || null, max_value || null,
        picklist_values ? JSON.stringify(picklist_values) : null,
        lookup_object_id || null, formula_expression || null
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Field created successfully'
    });
  })
);

// Update field
router.put('/objects/:objectId/fields/:fieldId',
  authenticate,
  [
    param('objectId').isUUID(),
    param('fieldId').isUUID(),
    body('label').optional().trim().notEmpty(),
    body('is_required').optional().isBoolean(),
    body('is_unique').optional().isBoolean(),
    body('default_value').optional(),
    body('description').optional().trim(),
    body('max_length').optional().isInt({ min: 1, max: 131072 }),
    body('min_value').optional().isNumeric(),
    body('max_value').optional().isNumeric(),
    body('picklist_values').optional().isArray(),
    body('formula_expression').optional().trim(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const {
      label, is_required, is_unique, default_value, description,
      max_length, min_value, max_value, picklist_values, formula_expression
    } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (label !== undefined) {
      updates.push(`label = $${paramCount++}`);
      values.push(label);
    }
    if (is_required !== undefined) {
      updates.push(`is_required = $${paramCount++}`);
      values.push(is_required);
    }
    if (is_unique !== undefined) {
      updates.push(`is_unique = $${paramCount++}`);
      values.push(is_unique);
    }
    if (default_value !== undefined) {
      updates.push(`default_value = $${paramCount++}`);
      values.push(default_value);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (max_length !== undefined) {
      updates.push(`max_length = $${paramCount++}`);
      values.push(max_length);
    }
    if (min_value !== undefined) {
      updates.push(`min_value = $${paramCount++}`);
      values.push(min_value);
    }
    if (max_value !== undefined) {
      updates.push(`max_value = $${paramCount++}`);
      values.push(max_value);
    }
    if (picklist_values !== undefined) {
      updates.push(`picklist_values = $${paramCount++}`);
      values.push(JSON.stringify(picklist_values));
    }
    if (formula_expression !== undefined) {
      updates.push(`formula_expression = $${paramCount++}`);
      values.push(formula_expression);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push(`modified_date = CURRENT_TIMESTAMP`);
    values.push(req.params.objectId);
    values.push(req.params.fieldId);

    const result = await queryWithTenant(
      req.tenantId!,
      `UPDATE fields_meta
       SET ${updates.join(', ')}
       WHERE object_id = $${paramCount} AND field_id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Field not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Field updated successfully'
    });
  })
);

// Delete field
router.delete('/objects/:objectId/fields/:fieldId',
  authenticate,
  [
    param('objectId').isUUID(),
    param('fieldId').isUUID(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    // Check if field exists and is not a system field
    const fieldCheck = await queryWithTenant(
      req.tenantId!,
      `SELECT f.field_name, o.is_custom
       FROM fields_meta f
       JOIN objects_meta o ON f.object_id = o.object_id
       WHERE f.field_id = $1 AND f.object_id = $2`,
      [req.params.fieldId, req.params.objectId]
    );

    if (fieldCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Field not found' });
    }

    // Prevent deletion of Name field
    if (fieldCheck.rows[0].field_name === 'Name') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the Name field'
      });
    }

    // Delete the field (hard delete for custom fields)
    await queryWithTenant(
      req.tenantId!,
      `DELETE FROM fields_meta WHERE field_id = $1 AND object_id = $2`,
      [req.params.fieldId, req.params.objectId]
    );

    res.json({
      success: true,
      message: 'Field deleted successfully'
    });
  })
);

// ============================================================================
// RECORD TYPE MANAGEMENT
// ============================================================================

// Get record types for an object
router.get('/objects/:objectId/record-types',
  authenticate,
  param('objectId').isUUID(),
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const result = await queryWithTenant(
      req.tenantId!,
      `SELECT * FROM record_types
       WHERE object_id = $1
       ORDER BY is_default DESC, record_type_name ASC`,
      [req.params.objectId]
    );

    res.json({ success: true, data: result.rows });
  })
);

// Create record type
router.post('/objects/:objectId/record-types',
  authenticate,
  [
    param('objectId').isUUID(),
    body('record_type_name').trim().notEmpty(),
    body('label').trim().notEmpty(),
    body('description').optional().trim(),
    body('is_default').optional().isBoolean(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const { record_type_name, label, description, is_default } = req.body;

    // Check if record type name already exists for this object
    const existingCheck = await queryWithTenant(
      req.tenantId!,
      `SELECT record_type_id FROM record_types
       WHERE object_id = $1 AND LOWER(record_type_name) = LOWER($2)`,
      [req.params.objectId, record_type_name]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Record type with this name already exists on this object'
      });
    }

    // If this is set as default, unset other defaults
    if (is_default) {
      await queryWithTenant(
        req.tenantId!,
        `UPDATE record_types SET is_default = false WHERE object_id = $1`,
        [req.params.objectId]
      );
    }

    const recordTypeId = uuidv4();

    const result = await queryWithTenant(
      req.tenantId!,
      `INSERT INTO record_types
       (record_type_id, tenant_id, object_id, record_type_name, label, description, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [recordTypeId, req.tenantId, req.params.objectId, record_type_name, label,
       description || null, is_default || false]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Record type created successfully'
    });
  })
);

// Update record type
router.put('/objects/:objectId/record-types/:recordTypeId',
  authenticate,
  [
    param('objectId').isUUID(),
    param('recordTypeId').isUUID(),
    body('label').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('is_default').optional().isBoolean(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const { label, description, is_default } = req.body;

    // If this is set as default, unset other defaults
    if (is_default) {
      await queryWithTenant(
        req.tenantId!,
        `UPDATE record_types SET is_default = false WHERE object_id = $1`,
        [req.params.objectId]
      );
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (label !== undefined) {
      updates.push(`label = $${paramCount++}`);
      values.push(label);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (is_default !== undefined) {
      updates.push(`is_default = $${paramCount++}`);
      values.push(is_default);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(req.params.objectId);
    values.push(req.params.recordTypeId);

    const result = await queryWithTenant(
      req.tenantId!,
      `UPDATE record_types
       SET ${updates.join(', ')}
       WHERE object_id = $${paramCount} AND record_type_id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Record type not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Record type updated successfully'
    });
  })
);

// Delete record type
router.delete('/objects/:objectId/record-types/:recordTypeId',
  authenticate,
  [
    param('objectId').isUUID(),
    param('recordTypeId').isUUID(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    // Check if any records use this record type
    const recordCheck = await queryWithTenant(
      req.tenantId!,
      `SELECT COUNT(*) as count FROM object_data
       WHERE object_id = $1 AND record_type_id = $2`,
      [req.params.objectId, req.params.recordTypeId]
    );

    if (parseInt(recordCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete record type that is in use by records'
      });
    }

    await queryWithTenant(
      req.tenantId!,
      `DELETE FROM record_types WHERE object_id = $1 AND record_type_id = $2`,
      [req.params.objectId, req.params.recordTypeId]
    );

    res.json({
      success: true,
      message: 'Record type deleted successfully'
    });
  })
);

export default router;
