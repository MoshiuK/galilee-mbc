const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { body, param } = require('express-validator');
const prisma = require('../utils/prisma');
const validate = require('../middleware/validate');
const { authenticate, requirePlatformAdmin } = require('../middleware/auth');

router.use(authenticate, requirePlatformAdmin);

// ============================================================================
// GET /api/platform/dashboard — Platform overview stats
// ============================================================================
router.get('/dashboard', async (req, res, next) => {
  try {
    const [tenantCount, totalUsers, totalExtensions, totalCalls] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.extension.count(),
      prisma.callLog.count(),
    ]);

    const recentTenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, slug: true, plan: true, active: true, createdAt: true },
    });

    res.json({
      stats: { tenantCount, totalUsers, totalExtensions, totalCalls },
      recentTenants,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Platform Admin Management
// ============================================================================

router.get('/admins', async (req, res, next) => {
  try {
    const admins = await prisma.platformAdmin.findMany({
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(admins);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/admins',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').notEmpty().trim(),
    body('role').optional().isIn(['super_admin', 'support']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, password, name, role } = req.body;
      const hashed = await bcrypt.hash(password, 12);
      const admin = await prisma.platformAdmin.create({
        data: { email, password: hashed, name, role: role || 'support' },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      });
      res.status(201).json(admin);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
