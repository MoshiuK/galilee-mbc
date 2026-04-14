const router = require('express').Router();
const { body } = require('express-validator');
const prisma = require('../utils/prisma');
const validate = require('../middleware/validate');
const { authenticate, requireTenantAccess, requireTenantAdmin } = require('../middleware/auth');

router.use(authenticate, requireTenantAccess);

// GET /api/call-queues
router.get('/', async (req, res, next) => {
  try {
    const queues = await prisma.callQueue.findMany({
      where: { tenantId: req.auth.tenantId },
      include: {
        members: {
          include: { extension: { select: { id: true, number: true, name: true } } },
          orderBy: { priority: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(queues);
  } catch (err) {
    next(err);
  }
});

// GET /api/call-queues/:id
router.get('/:id', async (req, res, next) => {
  try {
    const queue = await prisma.callQueue.findFirst({
      where: { id: req.params.id, tenantId: req.auth.tenantId },
      include: {
        members: {
          include: { extension: { select: { id: true, number: true, name: true } } },
          orderBy: { priority: 'asc' },
        },
      },
    });
    if (!queue) return res.status(404).json({ error: 'Call queue not found' });
    res.json(queue);
  } catch (err) {
    next(err);
  }
});

// POST /api/call-queues
router.post(
  '/',
  requireTenantAdmin,
  [
    body('name').notEmpty().trim(),
    body('strategy').optional().isIn(['round_robin', 'longest_idle', 'ring_all']),
    body('memberExtensionIds').optional().isArray(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { memberExtensionIds, ...data } = req.body;

      const queue = await prisma.callQueue.create({
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

      res.status(201).json(queue);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/call-queues/:id
router.put('/:id', requireTenantAdmin, async (req, res, next) => {
  try {
    const { memberExtensionIds, ...data } = req.body;
    delete data.tenantId;
    delete data.id;

    await prisma.callQueue.update({ where: { id: req.params.id }, data });

    if (memberExtensionIds && Array.isArray(memberExtensionIds)) {
      await prisma.callQueueMember.deleteMany({ where: { callQueueId: req.params.id } });
      await prisma.callQueueMember.createMany({
        data: memberExtensionIds.map((extId, idx) => ({
          callQueueId: req.params.id,
          extensionId: extId,
          priority: idx + 1,
        })),
      });
    }

    const updated = await prisma.callQueue.findUnique({
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

// DELETE /api/call-queues/:id
router.delete('/:id', requireTenantAdmin, async (req, res, next) => {
  try {
    await prisma.callQueue.delete({ where: { id: req.params.id } });
    res.json({ message: 'Call queue deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
