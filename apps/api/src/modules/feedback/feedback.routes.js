const express = require('express');
const { z } = require('zod');
const { prisma } = require('../../config/prisma');
const { requireAuth } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { asyncHandler } = require('../../utils/asyncHandler');
const { ApiError } = require('../../utils/apiError');
const { ROLES } = require('../../constants');

const router = express.Router();
router.use(requireAuth);

async function ownPatientId(req) {
  const profile = await prisma.patient.findUnique({ where: { userId: req.user.id }, select: { id: true } });
  return profile?.id || '__none__';
}

const listSchema = z.object({
  query: z.object({
    patientId: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50)
  })
});

router.get('/', validate(listSchema), asyncHandler(async (req, res) => {
  const allowed = [ROLES.ADMIN, ROLES.DIETICIAN, ROLES.KITCHEN_STAFF, ROLES.DOCTOR, ROLES.PATIENT];
  if (!allowed.includes(req.user.role)) throw new ApiError(403, 'Forbidden');
  const { patientId, page, limit } = req.validated.query;
  let where = { ...(patientId ? { patientId } : {}) };
  if (req.user.role === ROLES.PATIENT) where = { patientId: await ownPatientId(req) };
  const [items, total] = await Promise.all([
    prisma.feedback.findMany({
      where,
      include: { patient: true, mealOrder: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.feedback.count({ where })
  ]);
  res.json({ success: true, data: { items, total, page, limit } });
}));

const createSchema = z.object({
  body: z.object({
    patientId: z.string().optional(),
    mealOrderId: z.string().optional().nullable(),
    taste: z.number().int().min(1).max(5),
    quality: z.number().int().min(1).max(5),
    quantity: z.number().int().min(1).max(5),
    timing: z.number().int().min(1).max(5),
    comments: z.string().optional().nullable()
  })
});

router.post('/', validate(createSchema), asyncHandler(async (req, res) => {
  let { patientId } = req.validated.body;
  if (req.user.role === ROLES.PATIENT) patientId = await ownPatientId(req);
  if (!patientId) throw new ApiError(400, 'patientId is required');
  if (![ROLES.ADMIN, ROLES.DIETICIAN, ROLES.PATIENT].includes(req.user.role)) throw new ApiError(403, 'Forbidden');

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new ApiError(404, 'Patient not found');

  if (req.validated.body.mealOrderId) {
    const order = await prisma.mealOrder.findUnique({ where: { id: req.validated.body.mealOrderId } });
    if (!order || order.patientId !== patientId) throw new ApiError(400, 'mealOrderId does not belong to patient');
  }

  const feedback = await prisma.feedback.create({
    data: {
      patientId,
      mealOrderId: req.validated.body.mealOrderId,
      taste: req.validated.body.taste,
      quality: req.validated.body.quality,
      quantity: req.validated.body.quantity,
      timing: req.validated.body.timing,
      comments: req.validated.body.comments
    }
  });
  res.status(201).json({ success: true, data: { feedback } });
}));

router.get('/summary/ratings', asyncHandler(async (_req, res) => {
  const items = await prisma.feedback.findMany();
  const summary = items.reduce((acc, row) => {
    acc.count += 1;
    acc.taste += row.taste;
    acc.quality += row.quality;
    acc.quantity += row.quantity;
    acc.timing += row.timing;
    return acc;
  }, { count: 0, taste: 0, quality: 0, quantity: 0, timing: 0 });
  const avg = summary.count ? {
    taste: summary.taste / summary.count,
    quality: summary.quality / summary.count,
    quantity: summary.quantity / summary.count,
    timing: summary.timing / summary.count
  } : { taste: 0, quality: 0, quantity: 0, timing: 0 };
  res.json({ success: true, data: { count: summary.count, averages: avg } });
}));

module.exports = router;
