import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { queryWithTenant } from '../config/database';
import { hashPassword } from '../utils/password';
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
// USER MANAGEMENT
// ============================================================================

// Get all users
router.get('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const result = await queryWithTenant(
    req.tenantId!,
    `SELECT u.user_id, u.email, u.first_name, u.last_name, u.is_active,
            u.profile, u.created_date, u.last_login,
            r.role_name, r.role_id
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.role_id
     WHERE u.tenant_id = $1
     ORDER BY u.created_date DESC`,
    [req.tenantId]
  );

  res.json({ success: true, data: result.rows });
}));

// Get single user
router.get('/:userId',
  authenticate,
  param('userId').isUUID(),
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const userResult = await queryWithTenant(
      req.tenantId!,
      `SELECT u.user_id, u.email, u.first_name, u.last_name, u.is_active,
              u.profile, u.role_id, u.created_date, u.last_login, u.phone, u.title,
              r.role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.role_id
       WHERE u.user_id = $1`,
      [req.params.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get user's permission sets
    const permSetsResult = await queryWithTenant(
      req.tenantId!,
      `SELECT ps.permission_set_id, ps.permission_set_name, ps.label, ps.description
       FROM permission_set_assignments psa
       JOIN permission_sets ps ON psa.permission_set_id = ps.permission_set_id
       WHERE psa.user_id = $1`,
      [req.params.userId]
    );

    res.json({
      success: true,
      data: {
        user: userResult.rows[0],
        permissionSets: permSetsResult.rows
      }
    });
  })
);

// Create user
router.post('/',
  authenticate,
  [
    body('email').isEmail().normalizeEmail(),
    body('first_name').trim().notEmpty(),
    body('last_name').trim().notEmpty(),
    body('password').isLength({ min: 8 }),
    body('profile').optional().trim(),
    body('role_id').optional().isUUID(),
    body('phone').optional().trim(),
    body('title').optional().trim(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const { email, first_name, last_name, password, profile, role_id, phone, title } = req.body;

    // Check if user already exists
    const existingUser = await queryWithTenant(
      req.tenantId!,
      `SELECT user_id FROM users WHERE email = $1`,
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);
    const userId = uuidv4();

    const result = await queryWithTenant(
      req.tenantId!,
      `INSERT INTO users
       (user_id, tenant_id, email, password_hash, first_name, last_name,
        profile, role_id, phone, title, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
       RETURNING user_id, email, first_name, last_name, profile, role_id, phone, title, is_active, created_date`,
      [userId, req.tenantId, email, hashedPassword, first_name, last_name,
       profile || 'Standard User', role_id || null, phone || null, title || null]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'User created successfully'
    });
  })
);

// Update user
router.put('/:userId',
  authenticate,
  [
    param('userId').isUUID(),
    body('first_name').optional().trim().notEmpty(),
    body('last_name').optional().trim().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
    body('profile').optional().trim(),
    body('role_id').optional().isUUID(),
    body('is_active').optional().isBoolean(),
    body('phone').optional().trim(),
    body('title').optional().trim(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const { first_name, last_name, email, profile, role_id, is_active, phone, title } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (first_name !== undefined) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(first_name);
    }
    if (last_name !== undefined) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(last_name);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }
    if (profile !== undefined) {
      updates.push(`profile = $${paramCount++}`);
      values.push(profile);
    }
    if (role_id !== undefined) {
      updates.push(`role_id = $${paramCount++}`);
      values.push(role_id);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      values.push(phone);
    }
    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(req.params.userId);

    const result = await queryWithTenant(
      req.tenantId!,
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE user_id = $${paramCount}
       RETURNING user_id, email, first_name, last_name, profile, role_id, is_active, phone, title`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'User updated successfully'
    });
  })
);

// Delete user (deactivate)
router.delete('/:userId',
  authenticate,
  param('userId').isUUID(),
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const result = await queryWithTenant(
      req.tenantId!,
      `UPDATE users SET is_active = false WHERE user_id = $1 RETURNING user_id`,
      [req.params.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  })
);

// Reset user password
router.post('/:userId/reset-password',
  authenticate,
  [
    param('userId').isUUID(),
    body('new_password').isLength({ min: 8 }),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const hashedPassword = await hashPassword(req.body.new_password);

    const result = await queryWithTenant(
      req.tenantId!,
      `UPDATE users SET password_hash = $1 WHERE user_id = $2 RETURNING user_id`,
      [hashedPassword, req.params.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  })
);

// Assign permission set to user
router.post('/:userId/permission-sets/:permissionSetId',
  authenticate,
  [
    param('userId').isUUID(),
    param('permissionSetId').isUUID(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    // Check if already assigned
    const existing = await queryWithTenant(
      req.tenantId!,
      `SELECT * FROM permission_set_assignments
       WHERE user_id = $1 AND permission_set_id = $2`,
      [req.params.userId, req.params.permissionSetId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Permission set already assigned to user'
      });
    }

    const assignmentId = uuidv4();
    await queryWithTenant(
      req.tenantId!,
      `INSERT INTO permission_set_assignments
       (assignment_id, tenant_id, user_id, permission_set_id, assigned_by, assigned_date)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [assignmentId, req.tenantId, req.params.userId, req.params.permissionSetId, req.userId]
    );

    res.json({
      success: true,
      message: 'Permission set assigned successfully'
    });
  })
);

// Remove permission set from user
router.delete('/:userId/permission-sets/:permissionSetId',
  authenticate,
  [
    param('userId').isUUID(),
    param('permissionSetId').isUUID(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const result = await queryWithTenant(
      req.tenantId!,
      `DELETE FROM permission_set_assignments
       WHERE user_id = $1 AND permission_set_id = $2`,
      [req.params.userId, req.params.permissionSetId]
    );

    res.json({
      success: true,
      message: 'Permission set removed successfully'
    });
  })
);

export default router;
