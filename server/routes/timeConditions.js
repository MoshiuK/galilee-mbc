const router = require('express').Router();
const { body } = require('express-validator');
const prisma = require('../utils/prisma');
const validate = require('../middleware/validate');
const { authenticate, requireTenantAccess, requireTenantAdmin } = require('../middleware/auth');

router.use(authenticate, requireTenantAccess);

// GET /api/time-conditions
router.get('/', async (req, res, next) => {
  try {
    const tcs = await prisma.timeCondition.findMany({
      where: { tenantId: req.auth.tenantId },
      include: { schedules: { orderBy: { dayOfWeek: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    res.json(tcs);
  } catch (err) {
    next(err);
  }
});

// GET /api/time-conditions/:id
router.get('/:id', async (req, res, next) => {
  try {
    const tc = await prisma.timeCondition.findFirst({
      where: { id: req.params.id, tenantId: req.auth.tenantId },
      include: { schedules: { orderBy: { dayOfWeek: 'asc' } } },
    });
    if (!tc) return res.status(404).json({ error: 'Time condition not found' });
    res.json(tc);
  } catch (err) {
    next(err);
  }
});

// POST /api/time-conditions
router.post(
  '/',
  requireTenantAdmin,
  [
    body('name').notEmpty().trim(),
    body('matchType').notEmpty(),
    body('noMatchType').notEmpty(),
    body('schedules').optional().isArray(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { schedules, ...data } = req.body;

      const tc = await prisma.timeCondition.create({
        data: {
          tenantId: req.auth.tenantId,
          ...data,
          schedules: schedules
            ? { create: schedules.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })) }
            : undefined,
        },
        include: { schedules: true },
      });

      res.status(201).json(tc);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/time-conditions/:id
router.put('/:id', requireTenantAdmin, async (req, res, next) => {
  try {
    const { schedules, ...data } = req.body;
    delete data.tenantId;
    delete data.id;

    await prisma.timeCondition.update({ where: { id: req.params.id }, data });

    if (schedules && Array.isArray(schedules)) {
      await prisma.timeSchedule.deleteMany({ where: { timeConditionId: req.params.id } });
      await prisma.timeSchedule.createMany({
        data: schedules.map((s) => ({
          timeConditionId: req.params.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      });
    }

    const updated = await prisma.timeCondition.findUnique({
      where: { id: req.params.id },
      include: { schedules: { orderBy: { dayOfWeek: 'asc' } } },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/time-conditions/:id
router.delete('/:id', requireTenantAdmin, async (req, res, next) => {
  try {
    await prisma.timeCondition.delete({ where: { id: req.params.id } });
    res.json({ message: 'Time condition deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
