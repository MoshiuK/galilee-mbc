const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

/**
 * Verify JWT and attach user/admin to request.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.auth = decoded; // { id, role, tenantId? }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Require platform-level admin.
 */
function requirePlatformAdmin(req, res, next) {
  if (!req.auth || req.auth.scope !== 'platform') {
    return res.status(403).json({ error: 'Platform admin access required' });
  }
  next();
}

/**
 * Require tenant-level admin.
 */
function requireTenantAdmin(req, res, next) {
  if (!req.auth || !req.auth.tenantId) {
    return res.status(403).json({ error: 'Tenant access required' });
  }
  if (!['admin', 'manager'].includes(req.auth.role)) {
    return res.status(403).json({ error: 'Admin or manager role required' });
  }
  next();
}

/**
 * Require the user belongs to the tenant referenced in the route.
 */
function requireTenantAccess(req, res, next) {
  if (!req.auth || !req.auth.tenantId) {
    return res.status(403).json({ error: 'Tenant access required' });
  }
  // Platform admins can access any tenant
  if (req.auth.scope === 'platform') return next();

  // Tenant users can only access their own tenant
  const tenantId = req.params.tenantId || req.body.tenantId || req.auth.tenantId;
  if (req.auth.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Access denied to this tenant' });
  }
  next();
}

/**
 * Generate JWT token.
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });
}

/**
 * Generate refresh token.
 */
function generateRefreshToken(payload) {
  return jwt.sign({ ...payload, type: 'refresh' }, JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
}

module.exports = {
  authenticate,
  requirePlatformAdmin,
  requireTenantAdmin,
  requireTenantAccess,
  generateToken,
  generateRefreshToken,
};
