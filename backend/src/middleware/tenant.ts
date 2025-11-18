import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

// Tenant context middleware - sets current tenant for RLS
// Must be used after authenticate middleware
export function setTenantContext(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.tenantId) {
    res.status(400).json({
      success: false,
      error: 'Tenant context not available',
    });
    return;
  }

  // Tenant ID is already set in req.tenantId by authenticate middleware
  // The actual RLS context is set per-query in database helpers
  next();
}

// Extract tenant from subdomain (for login without token)
export function extractTenantFromSubdomain(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const host = req.headers.host || '';
  const subdomain = host.split('.')[0];

  // Store subdomain in request for use in auth routes
  req.headers['x-tenant-subdomain'] = subdomain;

  next();
}
