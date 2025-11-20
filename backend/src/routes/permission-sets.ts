import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { queryWithTenant } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const asyncHandler = (fn: Function) => (req: Request, res: Response, next: Function) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const validate = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
};

// ============================================================================
// PERMISSION SET MANAGEMENT
// ============================================================================

// Get all permission sets
router.get('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const result = await queryWithTenant(
    req.tenantId!,
    `SELECT ps.permission_set_id, ps.permission_set_name, ps.label, ps.description,
            ps.created_date,
            (SELECT COUNT(*) FROM permission_set_assignments psa
             WHERE psa.permission_set_id = ps.permission_set_id) as assignment_count
     FROM permission_sets ps
     WHERE ps.tenant_id = $1
     ORDER BY ps.label ASC`,
    [req.tenantId]
  );

  res.json({ success: true, data: result.rows });
}));

// Get single permission set with permissions
router.get('/:permissionSetId',
  authenticate,
  param('permissionSetId').isUUID(),
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const psResult = await queryWithTenant(
      req.tenantId!,
      `SELECT * FROM permission_sets WHERE permission_set_id = $1`,
      [req.params.permissionSetId]
    );

    if (psResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Permission set not found' });
    }

    // Get object permissions
    const objectPerms = await queryWithTenant(
      req.tenantId!,
      `SELECT op.*, o.object_name, o.label as object_label
       FROM permission_set_object_permissions op
       JOIN objects_meta o ON op.object_id = o.object_id
       WHERE op.permission_set_id = $1`,
      [req.params.permissionSetId]
    );

    // Get field permissions
    const fieldPerms = await queryWithTenant(
      req.tenantId!,
      `SELECT fp.*, f.field_name, f.label as field_label, o.object_name, o.label as object_label
       FROM permission_set_field_permissions fp
       JOIN fields_meta f ON fp.field_id = f.field_id
       JOIN objects_meta o ON f.object_id = o.object_id
       WHERE fp.permission_set_id = $1
       ORDER BY o.label, f.label`,
      [req.params.permissionSetId]
    );

    // Get assigned users
    const users = await queryWithTenant(
      req.tenantId!,
      `SELECT u.user_id, u.email, u.first_name, u.last_name,
              psa.assigned_date
       FROM permission_set_assignments psa
       JOIN users u ON psa.user_id = u.user_id
       WHERE psa.permission_set_id = $1
       ORDER BY u.last_name, u.first_name`,
      [req.params.permissionSetId]
    );

    res.json({
      success: true,
      data: {
        permissionSet: psResult.rows[0],
        objectPermissions: objectPerms.rows,
        fieldPermissions: fieldPerms.rows,
        assignedUsers: users.rows
      }
    });
  })
);

// Create permission set
router.post('/',
  authenticate,
  [
    body('permission_set_name').trim().notEmpty().matches(/^[a-zA-Z][a-zA-Z0-9_]*$/),
    body('label').trim().notEmpty(),
    body('description').optional().trim(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const { permission_set_name, label, description } = req.body;

    // Check if permission set name already exists
    const existing = await queryWithTenant(
      req.tenantId!,
      `SELECT permission_set_id FROM permission_sets
       WHERE LOWER(permission_set_name) = LOWER($1)`,
      [permission_set_name]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Permission set with this name already exists'
      });
    }

    const permissionSetId = uuidv4();

    const result = await queryWithTenant(
      req.tenantId!,
      `INSERT INTO permission_sets
       (permission_set_id, tenant_id, permission_set_name, label, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [permissionSetId, req.tenantId, permission_set_name, label, description || null]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Permission set created successfully'
    });
  })
);

// Update permission set
router.put('/:permissionSetId',
  authenticate,
  [
    param('permissionSetId').isUUID(),
    body('label').optional().trim().notEmpty(),
    body('description').optional().trim(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const { label, description } = req.body;
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

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(req.params.permissionSetId);

    const result = await queryWithTenant(
      req.tenantId!,
      `UPDATE permission_sets
       SET ${updates.join(', ')}
       WHERE permission_set_id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Permission set not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Permission set updated successfully'
    });
  })
);

// Delete permission set
router.delete('/:permissionSetId',
  authenticate,
  param('permissionSetId').isUUID(),
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    // Delete will cascade to assignments and permissions
    await queryWithTenant(
      req.tenantId!,
      `DELETE FROM permission_sets WHERE permission_set_id = $1`,
      [req.params.permissionSetId]
    );

    res.json({
      success: true,
      message: 'Permission set deleted successfully'
    });
  })
);

// ============================================================================
// OBJECT PERMISSIONS
// ============================================================================

// Set object permissions for permission set
router.put('/:permissionSetId/object-permissions/:objectId',
  authenticate,
  [
    param('permissionSetId').isUUID(),
    param('objectId').isUUID(),
    body('can_read').isBoolean(),
    body('can_create').isBoolean(),
    body('can_edit').isBoolean(),
    body('can_delete').isBoolean(),
    body('can_view_all').optional().isBoolean(),
    body('can_modify_all').optional().isBoolean(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const { can_read, can_create, can_edit, can_delete, can_view_all, can_modify_all } = req.body;

    // Check if permission already exists
    const existing = await queryWithTenant(
      req.tenantId!,
      `SELECT * FROM permission_set_object_permissions
       WHERE permission_set_id = $1 AND object_id = $2`,
      [req.params.permissionSetId, req.params.objectId]
    );

    if (existing.rows.length > 0) {
      // Update existing
      await queryWithTenant(
        req.tenantId!,
        `UPDATE permission_set_object_permissions
         SET can_read = $1, can_create = $2, can_edit = $3, can_delete = $4,
             can_view_all = $5, can_modify_all = $6
         WHERE permission_set_id = $7 AND object_id = $8`,
        [can_read, can_create, can_edit, can_delete,
         can_view_all || false, can_modify_all || false,
         req.params.permissionSetId, req.params.objectId]
      );
    } else {
      // Create new
      const permId = uuidv4();
      await queryWithTenant(
        req.tenantId!,
        `INSERT INTO permission_set_object_permissions
         (permission_id, tenant_id, permission_set_id, object_id,
          can_read, can_create, can_edit, can_delete, can_view_all, can_modify_all)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [permId, req.tenantId, req.params.permissionSetId, req.params.objectId,
         can_read, can_create, can_edit, can_delete,
         can_view_all || false, can_modify_all || false]
      );
    }

    res.json({
      success: true,
      message: 'Object permissions updated successfully'
    });
  })
);

// ============================================================================
// FIELD PERMISSIONS
// ============================================================================

// Set field permissions for permission set
router.put('/:permissionSetId/field-permissions/:fieldId',
  authenticate,
  [
    param('permissionSetId').isUUID(),
    param('fieldId').isUUID(),
    body('can_read').isBoolean(),
    body('can_edit').isBoolean(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const { can_read, can_edit } = req.body;

    // Check if permission already exists
    const existing = await queryWithTenant(
      req.tenantId!,
      `SELECT * FROM permission_set_field_permissions
       WHERE permission_set_id = $1 AND field_id = $2`,
      [req.params.permissionSetId, req.params.fieldId]
    );

    if (existing.rows.length > 0) {
      // Update existing
      await queryWithTenant(
        req.tenantId!,
        `UPDATE permission_set_field_permissions
         SET can_read = $1, can_edit = $2
         WHERE permission_set_id = $3 AND field_id = $4`,
        [can_read, can_edit, req.params.permissionSetId, req.params.fieldId]
      );
    } else {
      // Create new
      const permId = uuidv4();
      await queryWithTenant(
        req.tenantId!,
        `INSERT INTO permission_set_field_permissions
         (permission_id, tenant_id, permission_set_id, field_id, can_read, can_edit)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [permId, req.tenantId, req.params.permissionSetId, req.params.fieldId, can_read, can_edit]
      );
    }

    res.json({
      success: true,
      message: 'Field permissions updated successfully'
    });
  })
);

// Batch update field permissions
router.post('/:permissionSetId/field-permissions/batch',
  authenticate,
  [
    param('permissionSetId').isUUID(),
    body('permissions').isArray(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const { permissions } = req.body;

    for (const perm of permissions) {
      const { field_id, can_read, can_edit } = perm;

      const existing = await queryWithTenant(
        req.tenantId!,
        `SELECT * FROM permission_set_field_permissions
         WHERE permission_set_id = $1 AND field_id = $2`,
        [req.params.permissionSetId, field_id]
      );

      if (existing.rows.length > 0) {
        await queryWithTenant(
          req.tenantId!,
          `UPDATE permission_set_field_permissions
           SET can_read = $1, can_edit = $2
           WHERE permission_set_id = $3 AND field_id = $4`,
          [can_read, can_edit, req.params.permissionSetId, field_id]
        );
      } else {
        const permId = uuidv4();
        await queryWithTenant(
          req.tenantId!,
          `INSERT INTO permission_set_field_permissions
           (permission_id, tenant_id, permission_set_id, field_id, can_read, can_edit)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [permId, req.tenantId, req.params.permissionSetId, field_id, can_read, can_edit]
        );
      }
    }

    res.json({
      success: true,
      message: 'Field permissions updated successfully'
    });
  })
);

export default router;
