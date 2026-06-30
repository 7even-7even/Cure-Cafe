const express = require('express');
const { z } = require('zod');
const { prisma } = require('../../config/prisma');
const { requireAuth, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { asyncHandler } = require('../../utils/asyncHandler');
const { ApiError } = require('../../utils/apiError');
const { ROLES, BILLING_STATUSES } = require('../../constants');

const router = express.Router();
router.use(requireAuth);

async function ownPatientId(req) {
  const profile = await prisma.patient.findUnique({ where: { userId: req.user.id }, select: { id: true } });
  return profile?.id || '__none__';
}

async function assertBillingAccess(req, patientId) {
  if (req.user.role === ROLES.PATIENT && patientId !== await ownPatientId(req)) {
    throw new ApiError(403, 'Patient can access only own billing records');
  }
  if (![ROLES.ADMIN, ROLES.DIETICIAN, ROLES.PATIENT].includes(req.user.role)) {
    throw new ApiError(403, 'Forbidden');
  }
}

const listSchema = z.object({
  query: z.object({
    patientId: z.string().optional(),
    status: z.enum(BILLING_STATUSES).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50)
  })
});

router.get('/charges', validate(listSchema), asyncHandler(async (req, res) => {
  const { patientId, status, page, limit } = req.validated.query;
  let where = { ...(patientId ? { patientId } : {}), ...(status ? { status } : {}) };
  if (req.user.role === ROLES.PATIENT) where = { ...where, patientId: await ownPatientId(req) };
  if (![ROLES.ADMIN, ROLES.DIETICIAN, ROLES.PATIENT].includes(req.user.role)) throw new ApiError(403, 'Forbidden');

  const [items, total] = await Promise.all([
    prisma.billingCharge.findMany({
      where,
      include: { patient: true, mealOrder: true, foodOrder: true },
      orderBy: { chargeDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.billingCharge.count({ where })
  ]);
  res.json({ success: true, data: { items, total, page, limit } });
}));

const createSchema = z.object({
  body: z.object({
    patientId: z.string().min(1),
    mealOrderId: z.string().optional().nullable(),
    description: z.string().min(2).max(250),
    amount: z.number().nonnegative(),
    status: z.enum(BILLING_STATUSES).default('PENDING'),
    chargeDate: z.coerce.date().optional()
  })
});

router.post('/charges', authorize(ROLES.ADMIN, ROLES.DIETICIAN), validate(createSchema), asyncHandler(async (req, res) => {
  const body = req.validated.body;
  const patient = await prisma.patient.findUnique({ where: { id: body.patientId } });
  if (!patient) throw new ApiError(404, 'Patient not found');
  const charge = await prisma.billingCharge.create({ data: body });
  res.status(201).json({ success: true, data: { charge } });
}));

const statusSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ status: z.enum(BILLING_STATUSES) })
});

router.patch('/charges/:id/status', authorize(ROLES.ADMIN), validate(statusSchema), asyncHandler(async (req, res) => {
  const charge = await prisma.billingCharge.update({ where: { id: req.validated.params.id }, data: { status: req.validated.body.status } });
  res.json({ success: true, data: { charge } });
}));

router.get('/patient/:patientId/summary', asyncHandler(async (req, res) => {
  await assertBillingAccess(req, req.params.patientId);
  const charges = await prisma.billingCharge.findMany({ where: { patientId: req.params.patientId }, orderBy: { chargeDate: 'desc' } });
  const summary = charges.reduce((acc, charge) => {
    acc.total += charge.amount;
    acc.byStatus[charge.status] = (acc.byStatus[charge.status] || 0) + charge.amount;
    return acc;
  }, { total: 0, byStatus: {} });
  res.json({ success: true, data: { charges, summary } });
}));

module.exports = router;
