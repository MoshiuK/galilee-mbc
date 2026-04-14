const router = require('express').Router();
const { body } = require('express-validator');
const prisma = require('../utils/prisma');
const validate = require('../middleware/validate');
const { authenticate, requireTenantAccess, requireTenantAdmin } = require('../middleware/auth');

router.use(authenticate, requireTenantAccess);

// ============================================================================
// GET /api/ivr — List IVR menus
// ============================================================================
router.get('/', async (req, res, next) => {
  try {
    const menus = await prisma.ivrMenu.findMany({
      where: { tenantId: req.auth.tenantId },
      include: { options: { orderBy: { digit: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    res.json(menus);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET /api/ivr/:id — Get IVR menu detail
// ============================================================================
router.get('/:id', async (req, res, next) => {
  try {
    const menu = await prisma.ivrMenu.findFirst({
      where: { id: req.params.id, tenantId: req.auth.tenantId },
      include: { options: { orderBy: { digit: 'asc' } } },
    });
    if (!menu) return res.status(404).json({ error: 'IVR menu not found' });
    res.json(menu);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /api/ivr — Create IVR menu
// ============================================================================
router.post(
  '/',
  requireTenantAdmin,
  [
    body('name').notEmpty().trim(),
    body('greetingType').optional().isIn(['tts', 'recording']),
    body('greetingText').optional().trim(),
    body('options').optional().isArray(),
    body('options.*.digit').optional().matches(/^[0-9*#]$/),
    body('options.*.label').optional().notEmpty(),
    body('options.*.actionType').optional().isIn([
      'extension', 'ring_group', 'queue', 'ivr_menu', 'external', 'voicemail', 'hangup', 'repeat',
    ]),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { options, ...menuData } = req.body;

      const menu = await prisma.ivrMenu.create({
        data: {
          tenantId: req.auth.tenantId,
          ...menuData,
          options: options
            ? { create: options.map((o) => ({ digit: o.digit, label: o.label, actionType: o.actionType, actionTarget: o.actionTarget })) }
            : undefined,
        },
        include: { options: true },
      });

      res.status(201).json(menu);
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// PUT /api/ivr/:id — Update IVR menu
// ============================================================================
router.put('/:id', requireTenantAdmin, async (req, res, next) => {
  try {
    const { options, ...menuData } = req.body;
    delete menuData.tenantId;
    delete menuData.id;

    // Update menu fields
    const menu = await prisma.ivrMenu.update({
      where: { id: req.params.id },
      data: menuData,
    });

    // Replace options if provided
    if (options && Array.isArray(options)) {
      await prisma.ivrOption.deleteMany({ where: { ivrMenuId: req.params.id } });
      await prisma.ivrOption.createMany({
        data: options.map((o) => ({
          ivrMenuId: req.params.id,
          digit: o.digit,
          label: o.label,
          actionType: o.actionType,
          actionTarget: o.actionTarget,
        })),
      });
    }

    const updated = await prisma.ivrMenu.findUnique({
      where: { id: req.params.id },
      include: { options: { orderBy: { digit: 'asc' } } },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// DELETE /api/ivr/:id — Delete IVR menu
// ============================================================================
router.delete('/:id', requireTenantAdmin, async (req, res, next) => {
  try {
    await prisma.ivrMenu.delete({ where: { id: req.params.id } });
    res.json({ message: 'IVR menu deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
