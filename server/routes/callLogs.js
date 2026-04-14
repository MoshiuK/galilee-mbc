const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireTenantAccess } = require('../middleware/auth');

router.use(authenticate, requireTenantAccess);

// ============================================================================
// GET /api/call-logs — List call logs with filters
// ============================================================================
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const { direction, status, from, to, extensionNumber, startDate, endDate } = req.query;

    const where = { tenantId: req.auth.tenantId };

    // Tenant users can only see their own extension's calls
    if (req.auth.role === 'user' && req.auth.extensionId) {
      where.OR = [
        { inboundExtId: req.auth.extensionId },
        { outboundExtId: req.auth.extensionId },
      ];
    }

    if (direction) where.direction = direction;
    if (status) where.status = status;
    if (from) where.callerNumber = { contains: from };
    if (to) where.calledNumber = { contains: to };

    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) where.startedAt.gte = new Date(startDate);
      if (endDate) where.startedAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.callLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startedAt: 'desc' },
        include: {
          phoneNumber: { select: { number: true, friendlyName: true } },
          inboundExt: { select: { number: true, name: true } },
          outboundExt: { select: { number: true, name: true } },
        },
      }),
      prisma.callLog.count({ where }),
    ]);

    res.json({ logs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET /api/call-logs/stats — Aggregated call statistics
// ============================================================================
router.get('/stats', async (req, res, next) => {
  try {
    const tenantId = req.auth.tenantId;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [today, thisWeek, thisMonth, total, byDirection, avgDuration] = await Promise.all([
      prisma.callLog.count({ where: { tenantId, startedAt: { gte: todayStart } } }),
      prisma.callLog.count({ where: { tenantId, startedAt: { gte: weekStart } } }),
      prisma.callLog.count({ where: { tenantId, startedAt: { gte: monthStart } } }),
      prisma.callLog.count({ where: { tenantId } }),
      prisma.callLog.groupBy({
        by: ['direction'],
        where: { tenantId },
        _count: true,
      }),
      prisma.callLog.aggregate({
        where: { tenantId, duration: { gt: 0 } },
        _avg: { duration: true },
      }),
    ]);

    res.json({
      today,
      thisWeek,
      thisMonth,
      total,
      byDirection: byDirection.reduce((acc, d) => ({ ...acc, [d.direction]: d._count }), {}),
      averageDuration: Math.round(avgDuration._avg.duration || 0),
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET /api/call-logs/:id — Single call log detail
// ============================================================================
router.get('/:id', async (req, res, next) => {
  try {
    const log = await prisma.callLog.findFirst({
      where: { id: req.params.id, tenantId: req.auth.tenantId },
      include: {
        phoneNumber: { select: { number: true, friendlyName: true } },
        inboundExt: { select: { number: true, name: true } },
        outboundExt: { select: { number: true, name: true } },
      },
    });
    if (!log) return res.status(404).json({ error: 'Call log not found' });
    res.json(log);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
