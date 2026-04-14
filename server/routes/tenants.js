const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { body, param, query } = require('express-validator');
const prisma = require('../utils/prisma');
const validate = require('../middleware/validate');
const { authenticate, requirePlatformAdmin, requireTenantAccess } = require('../middleware/auth');

router.use(authenticate);

// ============================================================================
// GET /api/tenants — List all tenants (platform admin)
// ============================================================================
router.get('/', requirePlatformAdmin, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const search = req.query.search || '';

    const where = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { slug: { contains: search, mode: 'insensitive' } }] }
      : {};

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { users: true, extensions: true, phoneNumbers: true } },
        },
      }),
      prisma.tenant.count({ where }),
    ]);

    res.json({ tenants, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /api/tenants — Create a new tenant (platform admin)
// ============================================================================
router.post(
  '/',
  requirePlatformAdmin,
  [
    body('name').notEmpty().trim(),
    body('slug').notEmpty().trim().isSlug(),
    body('plan').optional().isIn(['basic', 'professional', 'enterprise']),
    body('maxExtensions').optional().isInt({ min: 1 }),
    body('maxPhoneNumbers').optional().isInt({ min: 1 }),
    body('adminEmail').isEmail().normalizeEmail(),
    body('adminPassword').isLength({ min: 8 }),
    body('adminFirstName').notEmpty().trim(),
    body('adminLastName').notEmpty().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const {
        name, slug, plan, maxExtensions, maxPhoneNumbers, domain,
        adminEmail, adminPassword, adminFirstName, adminLastName,
        swProjectId, swApiToken, swSpaceUrl,
        brandName, brandPrimaryColor, brandSecondaryColor,
      } = req.body;

      const hashedPassword = await bcrypt.hash(adminPassword, 12);

      const tenant = await prisma.tenant.create({
        data: {
          name,
          slug,
          domain,
          plan: plan || 'basic',
          maxExtensions: maxExtensions || 50,
          maxPhoneNumbers: maxPhoneNumbers || 10,
          swProjectId,
          swApiToken,
          swSpaceUrl,
          brandName: brandName || name,
          brandPrimaryColor,
          brandSecondaryColor,
          users: {
            create: {
              email: adminEmail,
              password: hashedPassword,
              firstName: adminFirstName,
              lastName: adminLastName,
              role: 'admin',
            },
          },
        },
        include: {
          users: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        },
      });

      res.status(201).json(tenant);
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// GET /api/tenants/:tenantId — Get tenant details
// ============================================================================
router.get('/:tenantId', async (req, res, next) => {
  try {
    // Platform admin can see any; tenant user can only see their own
    if (req.auth.scope !== 'platform' && req.auth.tenantId !== req.params.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.tenantId },
      include: {
        _count: {
          select: { users: true, extensions: true, phoneNumbers: true, callLogs: true, voicemails: true },
        },
      },
    });

    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // Hide sensitive SignalWire creds for non-platform users
    if (req.auth.scope !== 'platform') {
      tenant.swApiToken = tenant.swApiToken ? '••••••••' : null;
    }

    res.json(tenant);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// PUT /api/tenants/:tenantId — Update tenant
// ============================================================================
router.put(
  '/:tenantId',
  [
    body('name').optional().notEmpty().trim(),
    body('plan').optional().isIn(['basic', 'professional', 'enterprise']),
    body('active').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      if (req.auth.scope !== 'platform' && req.auth.tenantId !== req.params.tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Only platform admins can change these fields
      const platformOnly = ['plan', 'maxExtensions', 'maxPhoneNumbers', 'active', 'swProjectId', 'swApiToken', 'swSpaceUrl'];
      if (req.auth.scope !== 'platform') {
        for (const field of platformOnly) {
          delete req.body[field];
        }
      }

      // Remove non-updatable fields
      delete req.body.slug;
      delete req.body.id;

      const tenant = await prisma.tenant.update({
        where: { id: req.params.tenantId },
        data: req.body,
      });

      res.json(tenant);
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// DELETE /api/tenants/:tenantId — Delete tenant (platform admin)
// ============================================================================
router.delete('/:tenantId', requirePlatformAdmin, async (req, res, next) => {
  try {
    await prisma.tenant.delete({ where: { id: req.params.tenantId } });
    res.json({ message: 'Tenant deleted' });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Tenant Users CRUD
// ============================================================================

router.get('/:tenantId/users', requireTenantAccess, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { tenantId: req.params.tenantId },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, active: true, createdAt: true,
        extension: { select: { id: true, number: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/:tenantId/users',
  requireTenantAccess,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('firstName').notEmpty().trim(),
    body('lastName').notEmpty().trim(),
    body('role').optional().isIn(['admin', 'manager', 'user']),
  ],
  validate,
  async (req, res, next) => {
    try {
      // Check admin role for creating other admins
      if (req.body.role === 'admin' && req.auth.role !== 'admin' && req.auth.scope !== 'platform') {
        return res.status(403).json({ error: 'Only admins can create other admins' });
      }

      const hashed = await bcrypt.hash(req.body.password, 12);
      const user = await prisma.user.create({
        data: {
          tenantId: req.params.tenantId,
          email: req.body.email,
          password: hashed,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          role: req.body.role || 'user',
        },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
      });
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  }
);

router.put('/:tenantId/users/:userId', requireTenantAccess, async (req, res, next) => {
  try {
    const data = { ...req.body };
    delete data.password;
    delete data.tenantId;
    delete data.id;

    if (data.newPassword) {
      data.password = await bcrypt.hash(data.newPassword, 12);
      delete data.newPassword;
    }

    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data,
      select: { id: true, email: true, firstName: true, lastName: true, role: true, active: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.delete('/:tenantId/users/:userId', requireTenantAccess, async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.params.userId } });
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
