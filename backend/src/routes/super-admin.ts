import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { query } from '../config/database';
import { hashPassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
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

// Middleware to check super admin access
const requireSuperAdmin = (req: Request, res: Response, next: Function) => {
  // Check if user has super admin flag or specific email
  // For now, we'll check if user's email is in an allowed list or has is_super_admin flag
  if (!req.userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // In a real system, you'd check a super_admins table or flag
  // For now, we'll just proceed - in production, add proper super admin check
  next();
};

// ============================================================================
// TENANT MANAGEMENT
// ============================================================================

// Get all tenants
router.get('/tenants', authenticate, requireSuperAdmin, asyncHandler(async (req: Request, res: Response) => {
  const result = await query(`
    SELECT t.tenant_id, t.tenant_name, t.domain, t.is_active, t.created_date,
           (SELECT COUNT(*) FROM users WHERE tenant_id = t.tenant_id) as user_count,
           (SELECT COUNT(*) FROM objects_meta WHERE tenant_id = t.tenant_id AND is_custom = true) as custom_object_count
    FROM tenants t
    ORDER BY t.created_date DESC
  `);

  res.json({ success: true, data: result.rows });
}));

// Get single tenant with details
router.get('/tenants/:tenantId',
  authenticate,
  requireSuperAdmin,
  param('tenantId').isUUID(),
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const tenantResult = await query(`
      SELECT * FROM tenants WHERE tenant_id = $1
    `, [req.params.tenantId]);

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    // Get tenant statistics
    const stats = await query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE tenant_id = $1) as user_count,
        (SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND is_active = true) as active_user_count,
        (SELECT COUNT(*) FROM objects_meta WHERE tenant_id = $1) as total_objects,
        (SELECT COUNT(*) FROM objects_meta WHERE tenant_id = $1 AND is_custom = true) as custom_objects,
        (SELECT COUNT(*) FROM fields_meta WHERE tenant_id = $1) as total_fields,
        (SELECT COUNT(*) FROM roles WHERE tenant_id = $1) as role_count,
        (SELECT COUNT(*) FROM permission_sets WHERE tenant_id = $1) as permission_set_count
    `, [req.params.tenantId]);

    // Get recent users
    const recentUsers = await query(`
      SELECT user_id, email, first_name, last_name, is_active, created_date, last_login
      FROM users
      WHERE tenant_id = $1
      ORDER BY created_date DESC
      LIMIT 10
    `, [req.params.tenantId]);

    res.json({
      success: true,
      data: {
        tenant: tenantResult.rows[0],
        statistics: stats.rows[0],
        recentUsers: recentUsers.rows
      }
    });
  })
);

// Create new tenant
router.post('/tenants',
  authenticate,
  requireSuperAdmin,
  [
    body('tenant_name').trim().notEmpty(),
    body('domain').trim().notEmpty().matches(/^[a-z0-9-]+$/),
    body('admin_email').isEmail().normalizeEmail(),
    body('admin_first_name').trim().notEmpty(),
    body('admin_last_name').trim().notEmpty(),
    body('admin_password').isLength({ min: 8 }),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const { tenant_name, domain, admin_email, admin_first_name, admin_last_name, admin_password } = req.body;

    // Check if domain already exists
    const domainCheck = await query(`
      SELECT tenant_id FROM tenants WHERE domain = $1
    `, [domain]);

    if (domainCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Domain already exists'
      });
    }

    // Check if admin email already exists
    const emailCheck = await query(`
      SELECT user_id FROM users WHERE email = $1
    `, [admin_email]);

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Admin email already exists'
      });
    }

    const tenantId = uuidv4();
    const userId = uuidv4();
    const hashedPassword = await hashPassword(admin_password);

    // Create tenant
    await query(`
      INSERT INTO tenants (tenant_id, tenant_name, domain, is_active)
      VALUES ($1, $2, $3, true)
    `, [tenantId, tenant_name, domain]);

    // Create admin user
    await query(`
      INSERT INTO users (user_id, tenant_id, email, password_hash, first_name, last_name, profile, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, 'System Administrator', true)
    `, [userId, tenantId, admin_email, hashedPassword, admin_first_name, admin_last_name]);

    res.status(201).json({
      success: true,
      data: {
        tenant_id: tenantId,
        tenant_name,
        domain,
        admin_user_id: userId
      },
      message: 'Tenant created successfully'
    });
  })
);

// Update tenant
router.put('/tenants/:tenantId',
  authenticate,
  requireSuperAdmin,
  [
    param('tenantId').isUUID(),
    body('tenant_name').optional().trim().notEmpty(),
    body('is_active').optional().isBoolean(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const { tenant_name, is_active } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (tenant_name !== undefined) {
      updates.push(`tenant_name = $${paramCount++}`);
      values.push(tenant_name);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(req.params.tenantId);

    const result = await query(`
      UPDATE tenants
      SET ${updates.join(', ')}
      WHERE tenant_id = $${paramCount}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Tenant updated successfully'
    });
  })
);

// ============================================================================
// IMPERSONATION / LOGIN AS TENANT
// ============================================================================

// Impersonate tenant (login as first admin user of tenant)
router.post('/tenants/:tenantId/impersonate',
  authenticate,
  requireSuperAdmin,
  param('tenantId').isUUID(),
  asyncHandler(async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    // Get first admin user of the tenant
    const userResult = await query(`
      SELECT user_id, email, first_name, last_name, tenant_id
      FROM users
      WHERE tenant_id = $1 AND profile = 'System Administrator' AND is_active = true
      ORDER BY created_date ASC
      LIMIT 1
    `, [req.params.tenantId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active admin user found for this tenant'
      });
    }

    const user = userResult.rows[0];

    // Get tenant info
    const tenantResult = await query(`
      SELECT tenant_id, tenant_name, domain FROM tenants WHERE tenant_id = $1
    `, [req.params.tenantId]);

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const tenant = tenantResult.rows[0];

    // Generate token for impersonation
    const token = generateToken({
      userId: user.user_id,
      email: user.email,
      tenantId: tenant.tenant_id,
      impersonatedBy: req.userId, // Track who is impersonating
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          user_id: user.user_id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
        },
        tenant: {
          tenant_id: tenant.tenant_id,
          tenant_name: tenant.tenant_name,
          domain: tenant.domain,
        },
        impersonatedBy: req.userId,
      },
      message: 'Impersonation token generated successfully'
    });
  })
);

// ============================================================================
// SYSTEM OVERVIEW
// ============================================================================

// Get system-wide statistics
router.get('/system/stats', authenticate, requireSuperAdmin, asyncHandler(async (req: Request, res: Response) => {
  const stats = await query(`
    SELECT
      (SELECT COUNT(*) FROM tenants) as total_tenants,
      (SELECT COUNT(*) FROM tenants WHERE is_active = true) as active_tenants,
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
      (SELECT COUNT(DISTINCT tenant_id) FROM users WHERE last_login > NOW() - INTERVAL '7 days') as tenants_active_week,
      (SELECT COUNT(*) FROM users WHERE last_login > NOW() - INTERVAL '7 days') as users_active_week,
      (SELECT COUNT(*) FROM objects_meta WHERE is_custom = true) as total_custom_objects,
      (SELECT COUNT(*) FROM fields_meta) as total_fields
  `);

  // Get tenant growth over last 12 months
  const growth = await query(`
    SELECT
      DATE_TRUNC('month', created_date) as month,
      COUNT(*) as count
    FROM tenants
    WHERE created_date > NOW() - INTERVAL '12 months'
    GROUP BY DATE_TRUNC('month', created_date)
    ORDER BY month ASC
  `);

  // Get recent activity
  const recentTenants = await query(`
    SELECT tenant_id, tenant_name, domain, is_active, created_date
    FROM tenants
    ORDER BY created_date DESC
    LIMIT 10
  `);

  res.json({
    success: true,
    data: {
      statistics: stats.rows[0],
      growth: growth.rows,
      recentTenants: recentTenants.rows
    }
  });
}));

// Get module usage statistics
router.get('/system/modules', authenticate, requireSuperAdmin, asyncHandler(async (req: Request, res: Response) => {
  // Get usage by counting records in object_data table grouped by object
  const moduleUsage = await query(`
    SELECT
      o.object_name,
      o.label,
      COUNT(DISTINCT od.tenant_id) as tenant_count,
      COUNT(od.record_id) as record_count
    FROM objects_meta o
    LEFT JOIN object_data od ON o.object_id = od.object_id
    WHERE o.is_custom = false
    GROUP BY o.object_id, o.object_name, o.label
    ORDER BY tenant_count DESC, record_count DESC
  `);

  res.json({
    success: true,
    data: moduleUsage.rows
  });
}));

export default router;
