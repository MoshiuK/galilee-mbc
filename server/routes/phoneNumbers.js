const router = require('express').Router();
const { body } = require('express-validator');
const prisma = require('../utils/prisma');
const validate = require('../middleware/validate');
const { authenticate, requireTenantAccess, requireTenantAdmin } = require('../middleware/auth');
const { getClientForTenant } = require('../services/signalwire');

router.use(authenticate, requireTenantAccess);

// ============================================================================
// GET /api/phone-numbers — List tenant's phone numbers
// ============================================================================
router.get('/', async (req, res, next) => {
  try {
    const numbers = await prisma.phoneNumber.findMany({
      where: { tenantId: req.auth.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(numbers);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET /api/phone-numbers/available — Search available numbers to purchase
// ============================================================================
router.get('/available', requireTenantAdmin, async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.auth.tenantId } });
    const sw = getClientForTenant(tenant);

    const { areaCode, country } = req.query;
    const result = await sw.listAvailableNumbers({ areaCode, country });

    res.json(result.available_phone_numbers || []);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /api/phone-numbers/purchase — Purchase and assign a number
// ============================================================================
router.post(
  '/purchase',
  requireTenantAdmin,
  [
    body('phoneNumber').notEmpty().trim(),
    body('friendlyName').optional().trim(),
    body('routeType').optional().isIn(['ivr', 'extension', 'ring_group', 'queue', 'external', 'time_condition']),
    body('routeDestination').optional().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      // Check limit
      const tenant = await prisma.tenant.findUnique({ where: { id: req.auth.tenantId } });
      const count = await prisma.phoneNumber.count({ where: { tenantId: req.auth.tenantId } });
      if (count >= tenant.maxPhoneNumbers) {
        return res.status(400).json({ error: `Phone number limit reached (${tenant.maxPhoneNumbers})` });
      }

      const sw = getClientForTenant(tenant);
      const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/inbound-call`;

      // Purchase from SignalWire
      const purchased = await sw.purchaseNumber(req.body.phoneNumber);

      // Configure webhook
      await sw.configureNumber(purchased.sid, {
        voiceUrl: webhookUrl,
        statusCallback: `${process.env.WEBHOOK_BASE_URL}/call-status`,
      });

      // Save to database
      const phoneNumber = await prisma.phoneNumber.create({
        data: {
          tenantId: req.auth.tenantId,
          number: req.body.phoneNumber,
          friendlyName: req.body.friendlyName || req.body.phoneNumber,
          swPhoneNumberId: purchased.sid,
          routeType: req.body.routeType || 'ivr',
          routeDestination: req.body.routeDestination,
        },
      });

      res.status(201).json(phoneNumber);
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// PUT /api/phone-numbers/:id — Update phone number routing
// ============================================================================
router.put(
  '/:id',
  requireTenantAdmin,
  [
    body('routeType').optional().isIn(['ivr', 'extension', 'ring_group', 'queue', 'external', 'time_condition']),
    body('routeDestination').optional(),
    body('friendlyName').optional().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = {};
      if (req.body.routeType) data.routeType = req.body.routeType;
      if (req.body.routeDestination !== undefined) data.routeDestination = req.body.routeDestination;
      if (req.body.friendlyName) data.friendlyName = req.body.friendlyName;
      if (req.body.callerIdName) data.callerIdName = req.body.callerIdName;
      if (req.body.active !== undefined) data.active = req.body.active;

      const number = await prisma.phoneNumber.update({
        where: { id: req.params.id },
        data,
      });
      res.json(number);
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// DELETE /api/phone-numbers/:id — Release a phone number
// ============================================================================
router.delete('/:id', requireTenantAdmin, async (req, res, next) => {
  try {
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: req.params.id, tenantId: req.auth.tenantId },
    });
    if (!pn) return res.status(404).json({ error: 'Phone number not found' });

    // Release from SignalWire
    if (pn.swPhoneNumberId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.auth.tenantId } });
      const sw = getClientForTenant(tenant);
      await sw.releaseNumber(pn.swPhoneNumberId).catch(() => {});
    }

    await prisma.phoneNumber.delete({ where: { id: pn.id } });
    res.json({ message: 'Phone number released' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
