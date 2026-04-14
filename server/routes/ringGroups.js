const router = require('express').Router();
const { body } = require('express-validator');
const prisma = require('../utils/prisma');
const validate = require('../middleware/validate');
const { authenticate, requireTenantAccess, requireTenantAdmin } = require('../middleware/auth');

router.use(authenticate, requireTenantAccess);

// GET /api/ring-groups
router.get('/', async (req, res, next) => {
  try {
    const groups = await prisma.ringGroup.findMany({
      where: { tenantId: req.auth.tenantId },
      include: {
        members: {
          include: { extension: { select: { id: true, number: true, name: true } } },
          orderBy: { priority: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(groups);
  } catch (err) {
    next(err);
  }
});

// GET /api/ring-groups/:id
router.get('/:id', async (req, res, next) => {
  try {
    const group = await prisma.ringGroup.findFirst({
      where: { id: req.params.id, tenantId: req.auth.tenantId },
      include: {
        members: {
          include: { extension: { select: { id: true, number: true, name: true } } },
          orderBy: { priority: 'asc' },
        },
      },
    });
    if (!group) return res.status(404).json({ error: 'Ring group not found' });
    res.json(group);
  } catch (err) {
    next(err);
  }
});

// POST /api/ring-groups
router.post(
  '/',
  requireTenantAdmin,
  [
    body('name').notEmpty().trim(),
    body('strategy').optional().isIn(['simultaneous', 'sequential', 'random']),
    body('memberExtensionIds').optional().isArray(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { memberExtensionIds, ...data } = req.body;

      const group = await prisma.ringGroup.create({
        data: {
          tenantId: req.auth.tenantId,
          ...data,
          members: memberExtensionIds
            ? {
                create: memberExtensionIds.map((extId, idx) => ({
                  extensionId: extId,
                  priority: idx + 1,
                })),
              }
            : undefined,
        },
        include: {
          members: { include: { extension: { select: { id: true, number: true, name: true } } } },
        },
      });

      res.status(201).json(group);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/ring-groups/:id
router.put('/:id', requireTenantAdmin, async (req, res, next) => {
  try {
    const { memberExtensionIds, ...data } = req.body;
    delete data.tenantId;
    delete data.id;

    await prisma.ringGroup.update({ where: { id: req.params.id }, data });

    if (memberExtensionIds && Array.isArray(memberExtensionIds)) {
      await prisma.ringGroupMember.deleteMany({ where: { ringGroupId: req.params.id } });
      await prisma.ringGroupMember.createMany({
        data: memberExtensionIds.map((extId, idx) => ({
          ringGroupId: req.params.id,
          extensionId: extId,
          priority: idx + 1,
        })),
      });
    }

    const updated = await prisma.ringGroup.findUnique({
      where: { id: req.params.id },
      include: {
        members: { include: { extension: { select: { id: true, number: true, name: true } } } },
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/ring-groups/:id
router.delete('/:id', requireTenantAdmin, async (req, res, next) => {
  try {
    await prisma.ringGroup.delete({ where: { id: req.params.id } });
    res.json({ message: 'Ring group deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
