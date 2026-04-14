const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireTenantAccess } = require('../middleware/auth');

router.use(authenticate, requireTenantAccess);

// ============================================================================
// GET /api/voicemail — List voicemails
// ============================================================================
router.get('/', async (req, res, next) => {
  try {
    const where = { tenantId: req.auth.tenantId };
    const { extensionId, isRead } = req.query;

    if (extensionId) where.extensionId = extensionId;
    if (isRead !== undefined) where.isRead = isRead === 'true';

    // Regular users only see their own extension's voicemail
    if (req.auth.role === 'user' && req.auth.extensionId) {
      where.extensionId = req.auth.extensionId;
    }

    const voicemails = await prisma.voicemail.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        extension: { select: { number: true, name: true } },
      },
    });

    res.json(voicemails);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET /api/voicemail/unread-count — Count unread voicemails
// ============================================================================
router.get('/unread-count', async (req, res, next) => {
  try {
    const where = { tenantId: req.auth.tenantId, isRead: false };

    if (req.auth.role === 'user' && req.auth.extensionId) {
      where.extensionId = req.auth.extensionId;
    }

    const count = await prisma.voicemail.count({ where });
    res.json({ unreadCount: count });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET /api/voicemail/:id — Get voicemail detail
// ============================================================================
router.get('/:id', async (req, res, next) => {
  try {
    const vm = await prisma.voicemail.findFirst({
      where: { id: req.params.id, tenantId: req.auth.tenantId },
      include: {
        extension: { select: { number: true, name: true } },
      },
    });
    if (!vm) return res.status(404).json({ error: 'Voicemail not found' });
    res.json(vm);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// PUT /api/voicemail/:id/read — Mark as read
// ============================================================================
router.put('/:id/read', async (req, res, next) => {
  try {
    const vm = await prisma.voicemail.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });
    res.json(vm);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// DELETE /api/voicemail/:id — Delete voicemail
// ============================================================================
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.voicemail.delete({ where: { id: req.params.id } });
    res.json({ message: 'Voicemail deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
