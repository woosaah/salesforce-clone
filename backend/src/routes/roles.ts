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
// ROLE MANAGEMENT
// ============================================================================

// Get all roles (with hierarchy)
router.get('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const result = await queryWithTenant(
    req.tenantId!,
    `SELECT r.role_id, r.role_name, r.parent_role_id, r.description,
            pr.role_name as parent_role_name,
            (SELECT COUNT(*) FROM users WHERE role_id = r.role_id AND tenant_id = $1) as user_count
     FROM roles r
     LEFT JOIN roles pr ON r.parent_role_id = pr.role_id
     WHERE r.tenant_id = $1
     ORDER BY r.role_name ASC`,
    [req.tenantId]
  );

  res.json({ success: true, data: result.rows });
}));

// Get role hierarchy tree
router.get('/hierarchy', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const result = await queryWithTenant(
    req.tenantId!,
    `SELECT r.role_id, r.role_name, r.parent_role_id, r.description,
            (SELECT COUNT(*) FROM users WHERE role_id = r.role_id AND tenant_id = $1) as user_count
     FROM roles r
     WHERE r.tenant_id = $1
     ORDER BY r.role_name ASC`,
    [req.tenantId]
  );

  // Build hierarchy tree
  const roles = result.rows;
  const roleMap = new Map();
  const tree: any[] = [];

  // Create map
  roles.forEach(role => {
    roleMap.set(role.role_id, { ...role, children: [] });
  });

  // Build tree
  roles.forEach(role => {
    const node = roleMap.get(role.role_id);
    if (role.parent_role_id) {
      const parent = roleMap.get(role.parent_role_id);
      if (parent) {
        parent.children.push(node);
      }
    } else {
      tree.push(node);
    }
  });

  res.json({ success: true, data: tree });
}));

// Get single role
router.get('/:roleId',
  authenticate,
  param('roleId').isUUID(),
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const roleResult = await queryWithTenant(
      req.tenantId!,
      `SELECT r.role_id, r.role_name, r.parent_role_id, r.description,
              pr.role_name as parent_role_name
       FROM roles r
       LEFT JOIN roles pr ON r.parent_role_id = pr.role_id
       WHERE r.role_id = $1`,
      [req.params.roleId]
    );

    if (roleResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    // Get users in this role
    const usersResult = await queryWithTenant(
      req.tenantId!,
      `SELECT user_id, email, first_name, last_name, is_active
       FROM users
       WHERE role_id = $1
       ORDER BY last_name, first_name`,
      [req.params.roleId]
    );

    res.json({
      success: true,
      data: {
        role: roleResult.rows[0],
        users: usersResult.rows
      }
    });
  })
);

// Create role
router.post('/',
  authenticate,
  [
    body('role_name').trim().notEmpty(),
    body('description').optional().trim(),
    body('parent_role_id').optional().isUUID(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const { role_name, description, parent_role_id } = req.body;

    // Check if role name already exists
    const existing = await queryWithTenant(
      req.tenantId!,
      `SELECT role_id FROM roles WHERE LOWER(role_name) = LOWER($1)`,
      [role_name]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Role with this name already exists'
      });
    }

    // Validate parent role exists
    if (parent_role_id) {
      const parentCheck = await queryWithTenant(
        req.tenantId!,
        `SELECT role_id FROM roles WHERE role_id = $1`,
        [parent_role_id]
      );

      if (parentCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Parent role not found'
        });
      }
    }

    const roleId = uuidv4();

    const result = await queryWithTenant(
      req.tenantId!,
      `INSERT INTO roles
       (role_id, tenant_id, role_name, parent_role_id, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [roleId, req.tenantId, role_name, parent_role_id || null, description || null]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Role created successfully'
    });
  })
);

// Update role
router.put('/:roleId',
  authenticate,
  [
    param('roleId').isUUID(),
    body('role_name').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('parent_role_id').optional().isUUID(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const { role_name, description, parent_role_id } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (role_name !== undefined) {
      updates.push(`role_name = $${paramCount++}`);
      values.push(role_name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (parent_role_id !== undefined) {
      // Check for circular reference
      if (parent_role_id === req.params.roleId) {
        return res.status(400).json({
          success: false,
          message: 'A role cannot be its own parent'
        });
      }
      updates.push(`parent_role_id = $${paramCount++}`);
      values.push(parent_role_id);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(req.params.roleId);

    const result = await queryWithTenant(
      req.tenantId!,
      `UPDATE roles
       SET ${updates.join(', ')}
       WHERE role_id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Role updated successfully'
    });
  })
);

// Delete role
router.delete('/:roleId',
  authenticate,
  param('roleId').isUUID(),
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    // Check if role has users
    const userCheck = await queryWithTenant(
      req.tenantId!,
      `SELECT COUNT(*) as count FROM users WHERE role_id = $1`,
      [req.params.roleId]
    );

    if (parseInt(userCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete role with assigned users. Reassign users first.'
      });
    }

    // Check if role has child roles
    const childCheck = await queryWithTenant(
      req.tenantId!,
      `SELECT COUNT(*) as count FROM roles WHERE parent_role_id = $1`,
      [req.params.roleId]
    );

    if (parseInt(childCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete role with child roles. Remove child roles first.'
      });
    }

    await queryWithTenant(
      req.tenantId!,
      `DELETE FROM roles WHERE role_id = $1`,
      [req.params.roleId]
    );

    res.json({
      success: true,
      message: 'Role deleted successfully'
    });
  })
);

export default router;
