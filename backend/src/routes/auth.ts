import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryWithTenant } from '../config/database';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import {
  User,
  Tenant,
  Profile,
  LoginRequest,
  RegisterRequest,
  LoginResponse,
  ApiResponse,
} from '../types';

const router = Router();

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    body('subdomain').optional().isString(),
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

    const { email, password, subdomain } = req.body as LoginRequest;

    // Get tenant by subdomain if provided
    let tenantId: string | undefined;
    if (subdomain) {
      const tenants = await query(
        'SELECT * FROM tenants WHERE subdomain = $1 AND is_active = true',
        [subdomain]
      );

      if (tenants.length === 0) {
        res.status(401).json({
          success: false,
          error: 'Invalid subdomain',
        });
        return;
      }
      tenantId = tenants[0].tenant_id;
    }

    // Find user by email (and tenant if subdomain provided)
    let users: User[];
    if (tenantId) {
      users = await query(
        'SELECT * FROM users WHERE email = $1 AND tenant_id = $2 AND is_active = true',
        [email, tenantId]
      );
    } else {
      users = await query(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        [email]
      );
    }

    if (users.length === 0) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
      return;
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
      return;
    }

    // Get tenant
    const tenants = await query(
      'SELECT * FROM tenants WHERE tenant_id = $1',
      [user.tenant_id]
    );

    // Update last login
    await query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
      [user.user_id]
    );

    // Generate JWT token
    const token = generateToken({
      user_id: user.user_id,
      tenant_id: user.tenant_id,
      email: user.email,
      profile_id: user.profile_id,
    });

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        token,
        user: {
          user_id: user.user_id,
          email: user.email,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
          tenant_id: user.tenant_id,
        },
        tenant: {
          tenant_id: tenants[0].tenant_id,
          tenant_name: tenants[0].tenant_name,
          subdomain: tenants[0].subdomain,
        },
      },
    };

    res.json(response);
  })
);

// POST /api/auth/register
router.post(
  '/register',
  [
    body('tenant_name').notEmpty().withMessage('Tenant name is required'),
    body('subdomain')
      .notEmpty()
      .matches(/^[a-z0-9-]+$/)
      .withMessage('Subdomain must contain only lowercase letters, numbers, and hyphens'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('first_name').notEmpty().withMessage('First name is required'),
    body('last_name').notEmpty().withMessage('Last name is required'),
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
      email,
      password,
      first_name,
      last_name,
    } = req.body as RegisterRequest;

    // Check if subdomain already exists
    const existingTenants = await query(
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

    // Hash password
    const password_hash = await hashPassword(password);

    // Create tenant, profile, and user in transaction
    const client = await query('SELECT 1'); // Get a client
    const pool = require('../config/database').pool;
    const transactionClient = await pool.connect();

    try {
      await transactionClient.query('BEGIN');

      // Create tenant
      const tenantResult = await transactionClient.query(
        `INSERT INTO tenants (tenant_name, subdomain, subscription_tier, enabled_modules)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [tenant_name, subdomain, 'free', JSON.stringify([])]
      );
      const tenant = tenantResult.rows[0];

      // Create admin profile
      const profileResult = await transactionClient.query(
        `INSERT INTO profiles (tenant_id, profile_name, is_system)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [tenant.tenant_id, 'System Administrator', true]
      );
      const profile = profileResult.rows[0];

      // Create admin user
      const userResult = await transactionClient.query(
        `INSERT INTO users (tenant_id, username, email, password_hash, first_name, last_name, profile_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          tenant.tenant_id,
          email.split('@')[0],
          email,
          password_hash,
          first_name,
          last_name,
          profile.profile_id,
          true,
        ]
      );
      const user = userResult.rows[0];

      await transactionClient.query('COMMIT');

      // Generate JWT token
      const token = generateToken({
        user_id: user.user_id,
        tenant_id: user.tenant_id,
        email: user.email,
        profile_id: user.profile_id,
      });

      const response: ApiResponse<LoginResponse> = {
        success: true,
        message: 'Registration successful',
        data: {
          token,
          user: {
            user_id: user.user_id,
            email: user.email,
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            tenant_id: user.tenant_id,
          },
          tenant: {
            tenant_id: tenant.tenant_id,
            tenant_name: tenant.tenant_name,
            subdomain: tenant.subdomain,
          },
        },
      };

      res.status(201).json(response);
    } catch (error) {
      await transactionClient.query('ROLLBACK');
      throw error;
    } finally {
      transactionClient.release();
    }
  })
);

// GET /api/auth/me
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user || !req.tenant) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        user: {
          user_id: req.user.user_id,
          email: req.user.email,
          username: req.user.username,
          first_name: req.user.first_name,
          last_name: req.user.last_name,
          tenant_id: req.user.tenant_id,
          profile_id: req.user.profile_id,
          role_id: req.user.role_id,
        },
        tenant: {
          tenant_id: req.tenant.tenant_id,
          tenant_name: req.tenant.tenant_name,
          subdomain: req.tenant.subdomain,
          subscription_tier: req.tenant.subscription_tier,
        },
      },
    });
  })
);

export default router;
