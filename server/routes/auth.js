const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const prisma = require('../utils/prisma');
const validate = require('../middleware/validate');
const { authenticate, generateToken, generateRefreshToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// ============================================================================
// POST /api/auth/login — Tenant user login
// ============================================================================
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
    body('tenantSlug').notEmpty().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, password, tenantSlug } = req.body;

      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (!tenant || !tenant.active) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = await prisma.user.findUnique({
        where: { tenantId_email: { tenantId: tenant.id, email } },
      });
      if (!user || !user.active) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const payload = {
        id: user.id,
        scope: 'tenant',
        tenantId: tenant.id,
        role: user.role,
        email: user.email,
      };

      res.json({
        token: generateToken(payload),
        refreshToken: generateRefreshToken(payload),
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: tenant.id,
          tenantName: tenant.name,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// POST /api/auth/platform-login — Platform admin login
// ============================================================================
router.post(
  '/platform-login',
  authLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const admin = await prisma.platformAdmin.findUnique({ where: { email } });
      if (!admin || !admin.active) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, admin.password);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const payload = {
        id: admin.id,
        scope: 'platform',
        role: admin.role,
        email: admin.email,
      };

      res.json({
        token: generateToken(payload),
        refreshToken: generateRefreshToken(payload),
        user: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
          scope: 'platform',
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// GET /api/auth/me — Get current user profile
// ============================================================================
router.get('/me', authenticate, async (req, res, next) => {
  try {
    if (req.auth.scope === 'platform') {
      const admin = await prisma.platformAdmin.findUnique({
        where: { id: req.auth.id },
        select: { id: true, email: true, name: true, role: true },
      });
      return res.json({ ...admin, scope: 'platform' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.auth.id },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true, tenantId: true,
        tenant: { select: { id: true, name: true, slug: true, brandName: true, brandLogo: true, brandPrimaryColor: true } },
      },
    });
    res.json({ ...user, scope: 'tenant' });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /api/auth/change-password
// ============================================================================
router.post(
  '/change-password',
  authenticate,
  [body('currentPassword').notEmpty(), body('newPassword').isLength({ min: 8 })],
  validate,
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;

      let record;
      if (req.auth.scope === 'platform') {
        record = await prisma.platformAdmin.findUnique({ where: { id: req.auth.id } });
      } else {
        record = await prisma.user.findUnique({ where: { id: req.auth.id } });
      }

      const valid = await bcrypt.compare(currentPassword, record.password);
      if (!valid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      const hashed = await bcrypt.hash(newPassword, 12);
      if (req.auth.scope === 'platform') {
        await prisma.platformAdmin.update({ where: { id: req.auth.id }, data: { password: hashed } });
      } else {
        await prisma.user.update({ where: { id: req.auth.id }, data: { password: hashed } });
      }

      res.json({ message: 'Password changed successfully' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
