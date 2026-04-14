/**
 * Platform Admin Routes — ONE-STOP-SHOP
 *
 * Platform admin can manage EVERYTHING for any tenant:
 * - Purchase/port phone numbers
 * - Create extensions, IVR menus, ring groups
 * - Enable/configure AI features (IVR, SWAIG, call summaries)
 * - View all call logs, voicemails, recordings
 * - Manage tenant branding
 *
 * All routes scoped to /api/platform
 */

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../utils/prisma');
const validate = require('../middleware/validate');
const { authenticate, requirePlatformAdmin } = require('../middleware/auth');
const { getClientForTenant } = require('../services/signalwire');
const logger = require('../utils/logger');

router.use(authenticate, requirePlatformAdmin);

// ============================================================================
// DASHBOARD
// ============================================================================
router.get('/dashboard', async (req, res, next) => {
  try {
    const [tenantCount, totalUsers, totalExtensions, totalCalls, totalNumbers] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.extension.count(),
      prisma.callLog.count(),
      prisma.phoneNumber.count(),
    ]);

    const recentTenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        _count: { select: { users: true, extensions: true, phoneNumbers: true, callLogs: true } },
      },
    });

    const recentCalls = await prisma.callLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
      include: {
        tenant: { select: { name: true, slug: true } },
        phoneNumber: { select: { number: true, friendlyName: true } },
      },
    });

    res.json({
      stats: { tenantCount, totalUsers, totalExtensions, totalCalls, totalNumbers },
      recentTenants,
      recentCalls,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// MANAGE ANY TENANT'S EXTENSIONS
// ============================================================================
router.get('/tenants/:tenantId/extensions', async (req, res, next) => {
  try {
    const extensions = await prisma.extension.findMany({
      where: { tenantId: req.params.tenantId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      orderBy: { number: 'asc' },
    });
    res.json(extensions);
  } catch (err) { next(err); }
});

router.post('/tenants/:tenantId/extensions', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.tenantId } });
    const sipUsername = `${tenant.slug}_ext${req.body.number}`;
    const sipPassword = uuidv4().replace(/-/g, '').slice(0, 16);

    const ext = await prisma.extension.create({
      data: {
        tenantId: req.params.tenantId,
        number: req.body.number,
        name: req.body.name,
        type: req.body.type || 'sip',
        sipUsername,
        sipPassword,
        callerIdName: req.body.callerIdName || req.body.name,
        voicemailEnabled: req.body.voicemailEnabled !== false,
        voicemailPin: req.body.voicemailPin || '1234',
        voicemailEmail: req.body.voicemailEmail,
        forwardEnabled: req.body.forwardEnabled || false,
        forwardNumber: req.body.forwardNumber,
        forwardAfter: req.body.forwardAfter || 25,
      },
    });
    res.status(201).json(ext);
  } catch (err) { next(err); }
});

router.put('/tenants/:tenantId/extensions/:id', async (req, res, next) => {
  try {
    const data = { ...req.body };
    delete data.tenantId;
    delete data.id;
    delete data.sipUsername;
    const ext = await prisma.extension.update({ where: { id: req.params.id }, data });
    res.json(ext);
  } catch (err) { next(err); }
});

router.delete('/tenants/:tenantId/extensions/:id', async (req, res, next) => {
  try {
    await prisma.extension.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

// ============================================================================
// MANAGE ANY TENANT'S PHONE NUMBERS — Purchase, Port, Route
// ============================================================================

// List tenant's numbers
router.get('/tenants/:tenantId/phone-numbers', async (req, res, next) => {
  try {
    const numbers = await prisma.phoneNumber.findMany({
      where: { tenantId: req.params.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(numbers);
  } catch (err) { next(err); }
});

// Search available numbers to purchase
router.get('/tenants/:tenantId/phone-numbers/available', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.tenantId } });
    const sw = getClientForTenant(tenant);
    const { areaCode, country, contains } = req.query;

    const params = { areaCode, country };
    if (contains) params.Contains = contains;

    const result = await sw.listAvailableNumbers(params);
    res.json(result.available_phone_numbers || []);
  } catch (err) { next(err); }
});

// Purchase a number for a tenant
router.post('/tenants/:tenantId/phone-numbers/purchase', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.tenantId } });
    const sw = getClientForTenant(tenant);
    const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/inbound-call`;

    const purchased = await sw.purchaseNumber(req.body.phoneNumber);

    await sw.configureNumber(purchased.sid, {
      voiceUrl: webhookUrl,
      statusCallback: `${process.env.WEBHOOK_BASE_URL}/call-status`,
    });

    const phoneNumber = await prisma.phoneNumber.create({
      data: {
        tenantId: req.params.tenantId,
        number: req.body.phoneNumber,
        friendlyName: req.body.friendlyName || req.body.phoneNumber,
        swPhoneNumberId: purchased.sid,
        routeType: req.body.routeType || 'ivr',
        routeDestination: req.body.routeDestination,
      },
    });

    res.status(201).json(phoneNumber);
  } catch (err) { next(err); }
});

// Port in an existing number — submits directly to SignalWire
router.post('/tenants/:tenantId/phone-numbers/port', async (req, res, next) => {
  try {
    const {
      phoneNumbers,       // array of numbers to port, e.g. ["+12145551234"]
      carrierName,        // current carrier
      accountNumber,      // account number with current carrier
      accountPin,         // account PIN
      contactName,        // authorized contact
      contactPhone,       // contact phone
      contactEmail,       // contact email
      billingAddress,     // billing address object { street, city, state, zip }
      friendlyName,       // label for the number
    } = req.body;

    const numbersToPort = phoneNumbers || [req.body.phoneNumber];
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.tenantId } });
    const sw = getClientForTenant(tenant);

    // Submit port order to SignalWire
    let portOrder = null;
    let swError = null;
    try {
      portOrder = await sw.createPortOrder({
        numbers: numbersToPort,
        name: `${tenant.name} - Port ${numbersToPort[0]}`,
        carrierName,
        accountNumber,
        accountPin,
        contactName,
        contactPhone,
        contactEmail,
        billingAddress: billingAddress || {
          street: '',
          city: '',
          state: '',
          zip: '',
          country: 'US',
        },
      });
      logger.info(`Port order created on SignalWire: ${JSON.stringify(portOrder)}`);
    } catch (err) {
      swError = err;
      logger.error('SignalWire port order failed, saving locally', err);
    }

    // Save numbers as pending in our DB
    const created = [];
    for (const number of numbersToPort) {
      const pn = await prisma.phoneNumber.create({
        data: {
          tenantId: req.params.tenantId,
          number: number,
          friendlyName: friendlyName || `Porting: ${number}`,
          active: false, // not active until port completes
          routeType: 'ivr',
          callerIdName: portOrder ? 'PORT SUBMITTED' : 'PORT PENDING',
        },
      });
      created.push(pn);
    }

    // Create notification
    await prisma.notification.create({
      data: {
        tenantId: req.params.tenantId,
        type: 'system',
        title: portOrder
          ? 'Port Request Submitted to SignalWire'
          : 'Port Request Saved (Manual Action Needed)',
        message: portOrder
          ? `Port-in order submitted for ${numbersToPort.join(', ')} from ${carrierName}. ` +
            `SignalWire Order ID: ${portOrder.id || 'pending'}. ` +
            `Estimated completion: 7-14 business days.`
          : `Port request saved for ${numbersToPort.join(', ')} from ${carrierName}. ` +
            `Auto-submission failed: ${swError?.message || 'unknown error'}. ` +
            `Please submit manually at SignalWire dashboard.`,
        data: JSON.stringify({
          phoneNumbers: numbersToPort,
          carrierName, accountNumber, contactName, contactPhone, contactEmail,
          portOrderId: portOrder?.id || null,
          status: portOrder ? 'submitted' : 'pending_manual',
          submittedAt: new Date().toISOString(),
        }),
      },
    });

    if (portOrder) {
      res.status(201).json({
        message: 'Port request submitted to SignalWire!',
        portOrderId: portOrder.id,
        status: 'submitted',
        numbers: created,
        estimatedCompletion: '7-14 business days',
      });
    } else {
      // Fallback — API didn't work, give manual instructions
      res.status(201).json({
        message: 'Port request saved. Auto-submission to SignalWire failed — submit manually.',
        numbers: created,
        manualUrl: `https://${process.env.SIGNALWIRE_SPACE_URL}/phone_numbers/port`,
        error: swError?.message,
        nextSteps: [
          `Go to https://${process.env.SIGNALWIRE_SPACE_URL}/phone_numbers/port`,
          `Enter numbers: ${numbersToPort.join(', ')}`,
          `Carrier: ${carrierName}, Account: ${accountNumber}`,
          `Upload LOA and recent bill`,
        ],
      });
    }
  } catch (err) { next(err); }
});

// Check port order status
router.get('/tenants/:tenantId/phone-numbers/port-status', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.tenantId } });
    const sw = getClientForTenant(tenant);
    const orders = await sw.listPortOrders();
    res.json(orders);
  } catch (err) { next(err); }
});

// Update number routing
router.put('/tenants/:tenantId/phone-numbers/:id', async (req, res, next) => {
  try {
    const data = {};
    if (req.body.routeType) data.routeType = req.body.routeType;
    if (req.body.routeDestination !== undefined) data.routeDestination = req.body.routeDestination;
    if (req.body.friendlyName) data.friendlyName = req.body.friendlyName;
    if (req.body.active !== undefined) data.active = req.body.active;
    const number = await prisma.phoneNumber.update({ where: { id: req.params.id }, data });
    res.json(number);
  } catch (err) { next(err); }
});

// Release a number
router.delete('/tenants/:tenantId/phone-numbers/:id', async (req, res, next) => {
  try {
    const pn = await prisma.phoneNumber.findFirst({ where: { id: req.params.id, tenantId: req.params.tenantId } });
    if (!pn) return res.status(404).json({ error: 'Not found' });
    if (pn.swPhoneNumberId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.params.tenantId } });
      const sw = getClientForTenant(tenant);
      await sw.releaseNumber(pn.swPhoneNumberId).catch(() => {});
    }
    await prisma.phoneNumber.delete({ where: { id: pn.id } });
    res.json({ message: 'Released' });
  } catch (err) { next(err); }
});

// ============================================================================
// MANAGE ANY TENANT'S IVR MENUS
// ============================================================================
router.get('/tenants/:tenantId/ivr', async (req, res, next) => {
  try {
    const menus = await prisma.ivrMenu.findMany({
      where: { tenantId: req.params.tenantId },
      include: { options: { orderBy: { digit: 'asc' } } },
    });
    res.json(menus);
  } catch (err) { next(err); }
});

router.post('/tenants/:tenantId/ivr', async (req, res, next) => {
  try {
    const { options, ...menuData } = req.body;
    const menu = await prisma.ivrMenu.create({
      data: {
        tenantId: req.params.tenantId,
        ...menuData,
        options: options ? { create: options } : undefined,
      },
      include: { options: true },
    });
    res.status(201).json(menu);
  } catch (err) { next(err); }
});

router.put('/tenants/:tenantId/ivr/:id', async (req, res, next) => {
  try {
    const { options, ...menuData } = req.body;
    delete menuData.tenantId;
    delete menuData.id;
    await prisma.ivrMenu.update({ where: { id: req.params.id }, data: menuData });
    if (options && Array.isArray(options)) {
      await prisma.ivrOption.deleteMany({ where: { ivrMenuId: req.params.id } });
      await prisma.ivrOption.createMany({
        data: options.map((o) => ({ ivrMenuId: req.params.id, ...o })),
      });
    }
    const updated = await prisma.ivrMenu.findUnique({ where: { id: req.params.id }, include: { options: true } });
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete('/tenants/:tenantId/ivr/:id', async (req, res, next) => {
  try {
    await prisma.ivrMenu.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

// ============================================================================
// MANAGE ANY TENANT'S RING GROUPS
// ============================================================================
router.get('/tenants/:tenantId/ring-groups', async (req, res, next) => {
  try {
    const groups = await prisma.ringGroup.findMany({
      where: { tenantId: req.params.tenantId },
      include: { members: { include: { extension: { select: { id: true, number: true, name: true } } } } },
    });
    res.json(groups);
  } catch (err) { next(err); }
});

router.post('/tenants/:tenantId/ring-groups', async (req, res, next) => {
  try {
    const { memberExtensionIds, ...data } = req.body;
    const group = await prisma.ringGroup.create({
      data: {
        tenantId: req.params.tenantId,
        ...data,
        members: memberExtensionIds ? { create: memberExtensionIds.map((id, i) => ({ extensionId: id, priority: i + 1 })) } : undefined,
      },
      include: { members: { include: { extension: true } } },
    });
    res.status(201).json(group);
  } catch (err) { next(err); }
});

// ============================================================================
// AI / SWAIG SETTINGS — Per tenant, all from the admin panel
// ============================================================================

// Get AI settings for a tenant
router.get('/tenants/:tenantId/ai-settings', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.tenantId },
      select: {
        id: true, name: true,
        aiIvrEnabled: true, aiIvrPrompt: true,
        aiSummaryEnabled: true, smsSummaryEnabled: true,
        notificationPhone: true,
        swProjectId: true, swSpaceUrl: true,
      },
    });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // Build SWAIG webhook URLs for this tenant
    const webhookBase = process.env.WEBHOOK_BASE_URL || 'http://localhost:3000/api/webhooks/signalwire';
    const swaigConfig = {
      transferUrl: `${webhookBase}/swaig-transfer?tenantId=${tenant.id}`,
      checkHoursUrl: `${webhookBase}/swaig-check-hours?tenantId=${tenant.id}`,
      takeMessageUrl: `${webhookBase}/swaig-take-message?tenantId=${tenant.id}`,
      functionsUrl: `${webhookBase}/swaig-functions?tenantId=${tenant.id}`,
      inboundCallUrl: `${webhookBase}/inbound-call`,
      aiGatherUrl: `${webhookBase}/ai-gather?tenantId=${tenant.id}`,
    };

    res.json({ ...tenant, swaigConfig });
  } catch (err) { next(err); }
});

// Update AI settings for a tenant
router.put('/tenants/:tenantId/ai-settings', async (req, res, next) => {
  try {
    const data = {};
    const fields = ['aiIvrEnabled', 'aiIvrPrompt', 'aiSummaryEnabled', 'smsSummaryEnabled', 'notificationPhone'];
    for (const f of fields) {
      if (req.body[f] !== undefined) data[f] = req.body[f];
    }

    const tenant = await prisma.tenant.update({
      where: { id: req.params.tenantId },
      data,
      select: {
        id: true, name: true,
        aiIvrEnabled: true, aiIvrPrompt: true,
        aiSummaryEnabled: true, smsSummaryEnabled: true,
        notificationPhone: true,
      },
    });

    res.json(tenant);
  } catch (err) { next(err); }
});

// ============================================================================
// VIEW ANY TENANT'S CALL LOGS
// ============================================================================
router.get('/tenants/:tenantId/call-logs', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const where = { tenantId: req.params.tenantId };

    const [logs, total] = await Promise.all([
      prisma.callLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startedAt: 'desc' },
        include: {
          phoneNumber: { select: { number: true, friendlyName: true } },
          inboundExt: { select: { number: true, name: true } },
        },
      }),
      prisma.callLog.count({ where }),
    ]);
    res.json({ logs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// ============================================================================
// VIEW ANY TENANT'S VOICEMAILS
// ============================================================================
router.get('/tenants/:tenantId/voicemails', async (req, res, next) => {
  try {
    const vms = await prisma.voicemail.findMany({
      where: { tenantId: req.params.tenantId },
      orderBy: { createdAt: 'desc' },
      include: { extension: { select: { number: true, name: true } } },
    });
    res.json(vms);
  } catch (err) { next(err); }
});

// ============================================================================
// PLATFORM ADMIN MANAGEMENT
// ============================================================================
router.get('/admins', async (req, res, next) => {
  try {
    const admins = await prisma.platformAdmin.findMany({
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    });
    res.json(admins);
  } catch (err) { next(err); }
});

router.post(
  '/admins',
  [body('email').isEmail(), body('password').isLength({ min: 8 }), body('name').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const hashed = await bcrypt.hash(req.body.password, 12);
      const admin = await prisma.platformAdmin.create({
        data: { email: req.body.email, password: hashed, name: req.body.name, role: req.body.role || 'support' },
        select: { id: true, email: true, name: true, role: true },
      });
      res.status(201).json(admin);
    } catch (err) { next(err); }
  }
);

module.exports = router;
