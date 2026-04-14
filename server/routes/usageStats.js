const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireTenantAccess } = require('../middleware/auth');

router.use(authenticate, requireTenantAccess);

// GET /api/usage-stats — Usage stats with date range
router.get('/', async (req, res, next) => {
  try {
    const { startDate, endDate, days } = req.query;
    const where = { tenantId: req.auth.tenantId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    } else if (days) {
      const d = new Date();
      d.setDate(d.getDate() - parseInt(days));
      where.date = { gte: d };
    } else {
      // Default: last 30 days
      const d = new Date();
      d.setDate(d.getDate() - 30);
      where.date = { gte: d };
    }

    const stats = await prisma.usageStat.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    // Totals
    const totals = stats.reduce(
      (acc, s) => ({
        totalCalls: acc.totalCalls + s.totalCalls,
        inboundCalls: acc.inboundCalls + s.inboundCalls,
        outboundCalls: acc.outboundCalls + s.outboundCalls,
        answeredCalls: acc.answeredCalls + s.answeredCalls,
        missedCalls: acc.missedCalls + s.missedCalls,
        totalMinutes: acc.totalMinutes + s.totalMinutes,
        voicemailCount: acc.voicemailCount + s.voicemailCount,
      }),
      { totalCalls: 0, inboundCalls: 0, outboundCalls: 0, answeredCalls: 0, missedCalls: 0, totalMinutes: 0, voicemailCount: 0 }
    );

    totals.answerRate = totals.totalCalls > 0
      ? Math.round((totals.answeredCalls / totals.totalCalls) * 100)
      : 0;

    res.json({ daily: stats, totals });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
