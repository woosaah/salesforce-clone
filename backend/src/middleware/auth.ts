import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { query } from '../config/database';
import { User, Tenant } from '../types';

// Extend Express Request type
export interface AuthRequest extends Request {
  user?: User;
  tenant?: Tenant;
  tenantId?: string;
  userId?: string;
}

// Authentication middleware - verifies JWT token
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No token provided',
      });
      return;
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = verifyToken(token);

    // Get user from database
    const users = await query<User>(
      `SELECT * FROM users WHERE user_id = $1 AND is_active = true`,
      [decoded.user_id]
    );

    if (users.length === 0) {
      res.status(401).json({
        success: false,
        error: 'User not found or inactive',
      });
      return;
    }

    const user = users[0];

    // Get tenant
    const tenants = await query<Tenant>(
      `SELECT * FROM tenants WHERE tenant_id = $1 AND is_active = true`,
      [user.tenant_id]
    );

    if (tenants.length === 0) {
      res.status(401).json({
        success: false,
        error: 'Tenant not found or inactive',
      });
      return;
    }

    // Attach user and tenant to request
    req.user = user;
    req.tenant = tenants[0];
    req.tenantId = user.tenant_id;
    req.userId = user.user_id;

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
}

// Optional authentication - doesn't fail if no token
export async function optionalAuthenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      await authenticate(req, res, next);
    } else {
      next();
    }
  } catch (error) {
    next();
  }
}
