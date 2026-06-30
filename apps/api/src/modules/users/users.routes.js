const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { prisma } = require('../../config/prisma');
const { requireAuth, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { asyncHandler } = require('../../utils/asyncHandler');
const { ApiError } = require('../../utils/apiError');
const { ROLE_VALUES, ROLES } = require('../../constants');
const { hydratePatient } = require('../../utils/json');

const router = express.Router();
router.use(requireAuth, authorize(ROLES.ADMIN));

function sanitizeUser(user) {
  if (!user) return user;
  const { passwordHash, refreshTokenHash, patientProfile, ...safe } = user;
  return { ...safe, patientProfile: hydratePatient(patientProfile) };
}

const listSchema = z.object({
  query: z.object({
    role: z.enum(ROLE_VALUES).optional(),
    search: z.string().optional(),
    active: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50)
  })
});

router.get('/', validate(listSchema), asyncHandler(async (req, res) => {
  const { role, search, active, page, limit } = req.validated.query;
  const where = {
    ...(role ? { role } : {}),
    ...(active ? { isActive: active === 'true' } : {}),
    ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {})
  };
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { patientProfile: { include: { currentDietPlan: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.user.count({ where })
  ]);

  res.json({ success: true, data: { items: items.map(sanitizeUser), total, page, limit } });
}));

const createSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email().transform((v) => v.toLowerCase()),
    phone: z.string().optional(),
    password: z.string().min(8).max(128),
    role: z.enum(ROLE_VALUES)
  })
});

router.post('/', validate(createSchema), asyncHandler(async (req, res) => {
  const { password, ...data } = req.validated.body;
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { ...data, passwordHash } });
  res.status(201).json({ success: true, data: { user: sanitizeUser(user) } });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { patientProfile: { include: { currentDietPlan: true } } }
  });
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ success: true, data: { user: sanitizeUser(user) } });
}));

const updateSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    name: z.string().min(2).max(120).optional(),
    email: z.string().email().transform((v) => v.toLowerCase()).optional(),
    phone: z.string().optional().nullable(),
    password: z.string().min(8).max(128).optional(),
    role: z.enum(ROLE_VALUES).optional(),
    isActive: z.boolean().optional()
  }).refine((value) => Object.keys(value).length > 0, 'At least one field is required')
});

router.patch('/:id', validate(updateSchema), asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { password, ...body } = req.validated.body;
  const data = { ...body };
  if (password) data.passwordHash = await bcrypt.hash(password, 12);
  if (body.isActive === false) data.refreshTokenHash = null;
  const user = await prisma.user.update({ where: { id }, data });
  res.json({ success: true, data: { user: sanitizeUser(user) } });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) throw new ApiError(400, 'Admin cannot deactivate their own account');
  await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false, refreshTokenHash: null } });
  res.json({ success: true, message: 'User deactivated' });
}));

module.exports = router;
