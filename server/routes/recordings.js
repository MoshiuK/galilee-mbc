const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireTenantAccess } = require('../middleware/auth');

router.use(authenticate, requireTenantAccess);

// GET /api/recordings
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const where = { tenantId: req.auth.tenantId };

    const [recordings, total] = await Promise.all([
      prisma.recording.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.recording.count({ where }),
    ]);

    res.json({ recordings, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/recordings/:id
router.get('/:id', async (req, res, next) => {
  try {
    const rec = await prisma.recording.findFirst({
      where: { id: req.params.id, tenantId: req.auth.tenantId },
    });
    if (!rec) return res.status(404).json({ error: 'Recording not found' });
    res.json(rec);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/recordings/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const rec = await prisma.recording.findFirst({
      where: { id: req.params.id, tenantId: req.auth.tenantId },
    });
    if (!rec) return res.status(404).json({ error: 'Recording not found' });

    // Delete from SignalWire if we have a SID
    if (rec.swRecordingId) {
      const { getClientForTenant } = require('../services/signalwire');
      const tenant = await prisma.tenant.findUnique({ where: { id: req.auth.tenantId } });
      const sw = getClientForTenant(tenant);
      await sw.deleteRecording(rec.swRecordingId).catch(() => {});
    }

    await prisma.recording.delete({ where: { id: rec.id } });
    res.json({ message: 'Recording deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
