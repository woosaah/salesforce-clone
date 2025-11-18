import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { Tenant, Profile, CreateTenantRequest, ApiResponse } from '../types';

const router = Router();

// Middleware to check if user is super admin
// For now, we'll consider users with email containing 'superadmin' as super admins
// In production, this should be a proper role check
function requireSuperAdmin(
  req: AuthRequest,
  res: Response,
  next: Function
): void {
  // TODO: Implement proper super admin check
  // For now, allow all authenticated users for demo purposes
  if (!req.user) {
    res.status(403).json({
      success: false,
      error: 'Forbidden: Super admin access required',
    });
    return;
  }
  next();
}

// GET /api/tenants - List all tenants
router.get(
  '/',
  authenticate,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const tenants = await query<Tenant>('SELECT * FROM tenants ORDER BY created_date DESC');

    res.json({
      success: true,
      data: tenants,
    });
  })
);

// GET /api/tenants/:id - Get single tenant
router.get(
  '/:id',
  authenticate,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const tenants = await query<Tenant>(
      'SELECT * FROM tenants WHERE tenant_id = $1',
      [id]
    );

    if (tenants.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Tenant not found',
      });
      return;
    }

    res.json({
      success: true,
      data: tenants[0],
    });
  })
);

// POST /api/tenants - Create new tenant
router.post(
  '/',
  authenticate,
  requireSuperAdmin,
  [
    body('tenant_name').notEmpty().withMessage('Tenant name is required'),
    body('subdomain')
      .notEmpty()
      .matches(/^[a-z0-9-]+$/)
      .withMessage('Subdomain must contain only lowercase letters, numbers, and hyphens'),
    body('subscription_tier').optional().isString(),
    body('enabled_modules').optional().isArray(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: errors.array(),
      });
      return;
    }

    const {
      tenant_name,
      subdomain,
      subscription_tier = 'free',
      enabled_modules = [],
    } = req.body as CreateTenantRequest;

    // Check if subdomain already exists
    const existingTenants = await query<Tenant>(
      'SELECT * FROM tenants WHERE subdomain = $1',
      [subdomain]
    );

    if (existingTenants.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Subdomain already exists',
      });
      return;
    }

    // Create tenant
    const tenantResult = await query<Tenant>(
      `INSERT INTO tenants (tenant_name, subdomain, subscription_tier, enabled_modules)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tenant_name, subdomain, subscription_tier, JSON.stringify(enabled_modules)]
    );

    const tenant = tenantResult[0];

    // Create default System Administrator profile for the tenant
    await query<Profile>(
      `INSERT INTO profiles (tenant_id, profile_name, is_system)
       VALUES ($1, $2, $3)`,
      [tenant.tenant_id, 'System Administrator', true]
    );

    const response: ApiResponse<Tenant> = {
      success: true,
      message: 'Tenant created successfully',
      data: tenant,
    };

    res.status(201).json(response);
  })
);

// PATCH /api/tenants/:id - Update tenant
router.patch(
  '/:id',
  authenticate,
  requireSuperAdmin,
  [
    body('tenant_name').optional().notEmpty(),
    body('subscription_tier').optional().isString(),
    body('enabled_modules').optional().isArray(),
    body('is_active').optional().isBoolean(),
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: errors.array(),
      });
      return;
    }

    const { id } = req.params;
    const updates = req.body;

    // Build dynamic update query
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.tenant_name) {
      fields.push(`tenant_name = $${paramCount++}`);
      values.push(updates.tenant_name);
    }
    if (updates.subscription_tier) {
      fields.push(`subscription_tier = $${paramCount++}`);
      values.push(updates.subscription_tier);
    }
    if (updates.enabled_modules) {
      fields.push(`enabled_modules = $${paramCount++}`);
      values.push(JSON.stringify(updates.enabled_modules));
    }
    if (typeof updates.is_active === 'boolean') {
      fields.push(`is_active = $${paramCount++}`);
      values.push(updates.is_active);
    }

    if (fields.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No valid fields to update',
      });
      return;
    }

    values.push(id);

    const updateQuery = `
      UPDATE tenants
      SET ${fields.join(', ')}
      WHERE tenant_id = $${paramCount}
      RETURNING *
    `;

    const result = await query<Tenant>(updateQuery, values);

    if (result.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Tenant not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Tenant updated successfully',
      data: result[0],
    });
  })
);

export default router;
