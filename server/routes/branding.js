const router = require('express').Router();
const { body } = require('express-validator');
const multer = require('multer');
const path = require('path');
const prisma = require('../utils/prisma');
const validate = require('../middleware/validate');
const { authenticate, requireTenantAccess, requireTenantAdmin } = require('../middleware/auth');

router.use(authenticate, requireTenantAccess);

// File upload for logos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../storage/branding'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.auth.tenantId}-logo${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Invalid file type. Allowed: PNG, JPG, SVG, WebP'));
  },
});

// ============================================================================
// GET /api/branding — Get tenant branding
// ============================================================================
router.get('/', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.auth.tenantId },
      select: {
        id: true, name: true, brandName: true, brandLogo: true,
        brandPrimaryColor: true, brandSecondaryColor: true,
        brandFavicon: true, customCss: true, domain: true,
      },
    });
    res.json(tenant);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// PUT /api/branding — Update branding
// ============================================================================
router.put(
  '/',
  requireTenantAdmin,
  [
    body('brandName').optional().trim(),
    body('brandPrimaryColor').optional().matches(/^#[0-9a-fA-F]{6}$/),
    body('brandSecondaryColor').optional().matches(/^#[0-9a-fA-F]{6}$/),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = {};
      const allowedFields = ['brandName', 'brandPrimaryColor', 'brandSecondaryColor', 'brandFavicon', 'customCss'];
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) data[field] = req.body[field];
      }

      const tenant = await prisma.tenant.update({
        where: { id: req.auth.tenantId },
        data,
        select: {
          id: true, name: true, brandName: true, brandLogo: true,
          brandPrimaryColor: true, brandSecondaryColor: true,
          brandFavicon: true, customCss: true,
        },
      });
      res.json(tenant);
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// POST /api/branding/logo — Upload logo
// ============================================================================
router.post('/logo', requireTenantAdmin, upload.single('logo'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const logoPath = `/storage/branding/${req.file.filename}`;
    const tenant = await prisma.tenant.update({
      where: { id: req.auth.tenantId },
      data: { brandLogo: logoPath },
      select: { id: true, brandLogo: true },
    });

    res.json(tenant);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET /api/branding/public/:slug — Public branding endpoint (no auth)
// ============================================================================
// This is mounted separately to allow login pages to fetch branding
router.get('/public/:slug', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug },
      select: {
        brandName: true, brandLogo: true, brandPrimaryColor: true,
        brandSecondaryColor: true, brandFavicon: true,
      },
    });
    if (!tenant) return res.status(404).json({ error: 'Not found' });
    res.json(tenant);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
