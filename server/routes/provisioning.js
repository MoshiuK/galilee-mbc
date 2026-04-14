/**
 * Phone Auto-Provisioning Routes
 *
 * Provides:
 * 1. API endpoints for admin to generate/download provisioning configs
 * 2. HTTP provisioning endpoint that phones call to fetch their config
 *    (pointed via DHCP Option 66 or manual phone setup)
 */

const router = require('express').Router();
const { body } = require('express-validator');
const prisma = require('../utils/prisma');
const validate = require('../middleware/validate');
const { authenticate, requireTenantAccess, requireTenantAdmin } = require('../middleware/auth');
const { generateConfig, getSupportedPhones } = require('../services/provisioning');

// ============================================================================
// PUBLIC: Phone provisioning endpoint (no auth — phones call this)
// GET /api/provisioning/:macAddress/:filename
// ============================================================================
router.get('/:macAddress/:filename', async (req, res, next) => {
  try {
    const { macAddress } = req.params;
    const mac = macAddress.replace(/[^a-fA-F0-9]/g, '').toLowerCase();

    // Look up phone by MAC address
    const ext = await prisma.extension.findFirst({
      where: { provisionMac: mac },
      include: { tenant: true },
    });

    if (!ext) {
      return res.status(404).send('Phone not registered for provisioning');
    }

    const config = await generateConfig(ext, ext.tenant, ext.provisionModel);
    res.set('Content-Type', config.contentType);
    res.send(config.content);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// ADMIN: Get supported phone models
// GET /api/provisioning/phones/models
// ============================================================================
router.get('/phones/models', authenticate, (req, res) => {
  res.json(getSupportedPhones());
});

// ============================================================================
// ADMIN: Generate provisioning config for an extension (download/preview)
// POST /api/provisioning/generate
// ============================================================================
router.post(
  '/generate',
  authenticate,
  requireTenantAccess,
  requireTenantAdmin,
  [
    body('extensionId').notEmpty(),
    body('phoneModel').notEmpty(),
    body('macAddress').optional().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const ext = await prisma.extension.findFirst({
        where: { id: req.body.extensionId, tenantId: req.auth.tenantId },
        include: { tenant: true },
      });

      if (!ext) return res.status(404).json({ error: 'Extension not found' });

      // Save MAC address and model to extension for auto-provisioning
      if (req.body.macAddress) {
        const mac = req.body.macAddress.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
        await prisma.extension.update({
          where: { id: ext.id },
          data: { provisionMac: mac, provisionModel: req.body.phoneModel },
        });
      }

      const config = await generateConfig(ext, ext.tenant, req.body.phoneModel);

      res.json({
        filename: config.filename,
        contentType: config.contentType,
        content: config.content,
        provisioningUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/api/provisioning/${req.body.macAddress || 'MACADDRESS'}/${config.filename}`,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// ADMIN: Download provisioning file directly
// GET /api/provisioning/download/:extensionId
// ============================================================================
router.get(
  '/download/:extensionId',
  authenticate,
  requireTenantAccess,
  async (req, res, next) => {
    try {
      const ext = await prisma.extension.findFirst({
        where: { id: req.params.extensionId, tenantId: req.auth.tenantId },
        include: { tenant: true },
      });

      if (!ext) return res.status(404).json({ error: 'Extension not found' });

      const config = await generateConfig(ext, ext.tenant, ext.provisionModel || 'generic');

      res.set('Content-Type', config.contentType);
      res.set('Content-Disposition', `attachment; filename="${config.filename}"`);
      res.send(config.content);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
