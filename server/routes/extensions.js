const router = require('express').Router();
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../utils/prisma');
const validate = require('../middleware/validate');
const { authenticate, requireTenantAccess, requireTenantAdmin } = require('../middleware/auth');

router.use(authenticate, requireTenantAccess);

// ============================================================================
// GET /api/extensions — List extensions for current tenant
// ============================================================================
router.get('/', async (req, res, next) => {
  try {
    const extensions = await prisma.extension.findMany({
      where: { tenantId: req.auth.tenantId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { number: 'asc' },
    });
    res.json(extensions);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET /api/extensions/:id — Get extension details
// ============================================================================
router.get('/:id', async (req, res, next) => {
  try {
    const ext = await prisma.extension.findFirst({
      where: { id: req.params.id, tenantId: req.auth.tenantId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        voicemails: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!ext) return res.status(404).json({ error: 'Extension not found' });
    res.json(ext);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /api/extensions — Create extension
// ============================================================================
router.post(
  '/',
  requireTenantAdmin,
  [
    body('number').notEmpty().trim().matches(/^\d{2,6}$/),
    body('name').notEmpty().trim(),
    body('type').optional().isIn(['sip', 'webrtc', 'external']),
    body('userId').optional().isUUID(),
  ],
  validate,
  async (req, res, next) => {
    try {
      // Check extension limit
      const tenant = await prisma.tenant.findUnique({ where: { id: req.auth.tenantId } });
      const count = await prisma.extension.count({ where: { tenantId: req.auth.tenantId } });
      if (count >= tenant.maxExtensions) {
        return res.status(400).json({ error: `Extension limit reached (${tenant.maxExtensions})` });
      }

      // Generate SIP credentials
      const sipUsername = `${tenant.slug}_ext${req.body.number}`;
      const sipPassword = uuidv4().replace(/-/g, '').slice(0, 16);

      const ext = await prisma.extension.create({
        data: {
          tenantId: req.auth.tenantId,
          number: req.body.number,
          name: req.body.name,
          type: req.body.type || 'sip',
          userId: req.body.userId || null,
          sipUsername,
          sipPassword,
          callerIdName: req.body.callerIdName || req.body.name,
          callerIdNumber: req.body.callerIdNumber,
          voicemailEnabled: req.body.voicemailEnabled !== false,
          voicemailEmail: req.body.voicemailEmail,
          voicemailPin: req.body.voicemailPin || '1234',
          forwardEnabled: req.body.forwardEnabled || false,
          forwardNumber: req.body.forwardNumber,
          forwardAfter: req.body.forwardAfter || 25,
        },
      });

      res.status(201).json(ext);
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// PUT /api/extensions/:id — Update extension
// ============================================================================
router.put('/:id', requireTenantAdmin, async (req, res, next) => {
  try {
    const data = { ...req.body };
    delete data.tenantId;
    delete data.id;
    delete data.sipUsername; // don't allow changing SIP username

    const ext = await prisma.extension.update({
      where: { id: req.params.id },
      data,
    });
    res.json(ext);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// DELETE /api/extensions/:id — Delete extension
// ============================================================================
router.delete('/:id', requireTenantAdmin, async (req, res, next) => {
  try {
    await prisma.extension.delete({ where: { id: req.params.id } });
    res.json({ message: 'Extension deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
