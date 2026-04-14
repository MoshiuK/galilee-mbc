const router = require('express').Router();
const { body } = require('express-validator');
const prisma = require('../utils/prisma');
const validate = require('../middleware/validate');
const { authenticate, requireTenantAccess } = require('../middleware/auth');

router.use(authenticate, requireTenantAccess);

// GET /api/contacts
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';

    const where = { tenantId: req.auth.tenantId };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { firstName: 'asc' },
      }),
      prisma.contact.count({ where }),
    ]);

    res.json({ contacts, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

// POST /api/contacts
router.post(
  '/',
  [
    body('firstName').notEmpty().trim(),
    body('phone').notEmpty().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const contact = await prisma.contact.create({
        data: {
          tenantId: req.auth.tenantId,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          company: req.body.company,
          phone: req.body.phone,
          phoneAlt: req.body.phoneAlt,
          email: req.body.email,
          notes: req.body.notes,
        },
      });
      res.status(201).json(contact);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/contacts/:id
router.put('/:id', async (req, res, next) => {
  try {
    const data = { ...req.body };
    delete data.tenantId;
    delete data.id;

    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data,
    });
    res.json(contact);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.contact.delete({ where: { id: req.params.id } });
    res.json({ message: 'Contact deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
