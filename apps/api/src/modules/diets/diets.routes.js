const express = require('express');
const { z } = require('zod');
const { prisma } = require('../../config/prisma');
const { requireAuth, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { asyncHandler } = require('../../utils/asyncHandler');
const { ApiError } = require('../../utils/apiError');
const { jsonArray, safeJsonParse, hydrateDietPlan, hydratePrescription } = require('../../utils/json');
const { ROLES, DIET_TYPES, RESTRICTIONS, PRESCRIPTION_STATUSES } = require('../../constants');
const { notifyRole, notifyUser } = require('../../services/notification.service');

const router = express.Router();
router.use(requireAuth);

async function getOwnPatientId(req) {
  if (req.user.role !== ROLES.PATIENT) return null;
  const profile = await prisma.patient.findUnique({ where: { userId: req.user.id }, select: { id: true } });
  return profile?.id || '__none__';
}

router.get('/types', (_req, res) => {
  res.json({ success: true, data: { dietTypes: DIET_TYPES, restrictions: RESTRICTIONS } });
});

const listPrescriptionSchema = z.object({
  query: z.object({
    patientId: z.string().optional(),
    status: z.enum(PRESCRIPTION_STATUSES).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50)
  })
});

router.get('/prescriptions', validate(listPrescriptionSchema), asyncHandler(async (req, res) => {
  const { patientId, status, page, limit } = req.validated.query;
  const ownPatientId = await getOwnPatientId(req);
  const where = {
    ...(status ? { status } : {}),
    ...(patientId ? { patientId } : {}),
    ...(ownPatientId ? { patientId: ownPatientId } : {})
  };

  const [items, total] = await Promise.all([
    prisma.dietPrescription.findMany({
      where,
      include: {
        patient: { include: { currentDietPlan: true } },
        doctor: { select: { id: true, name: true, email: true } },
        dietician: { select: { id: true, name: true, email: true } },
        dietPlan: true
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.dietPrescription.count({ where })
  ]);

  res.json({ success: true, data: { items: items.map(hydratePrescription), total, page, limit } });
}));

const createPrescriptionSchema = z.object({
  body: z.object({
    patientId: z.string().min(1),
    doctorId: z.string().optional(),
    dietType: z.enum(DIET_TYPES),
    restrictions: z.array(z.enum(RESTRICTIONS)).default([]),
    allergies: z.array(z.string()).default([]),
    instructions: z.string().optional().nullable()
  })
});

router.post('/prescriptions', authorize(ROLES.ADMIN, ROLES.DOCTOR), validate(createPrescriptionSchema), asyncHandler(async (req, res) => {
  const body = req.validated.body;
  const doctorId = req.user.role === ROLES.DOCTOR ? req.user.id : body.doctorId;
  if (!doctorId) throw new ApiError(400, 'doctorId is required when admin creates a prescription');

  const [patient, doctor] = await Promise.all([
    prisma.patient.findUnique({ where: { id: body.patientId } }),
    prisma.user.findUnique({ where: { id: doctorId } })
  ]);
  if (!patient) throw new ApiError(404, 'Patient not found');
  if (!doctor || doctor.role !== ROLES.DOCTOR) throw new ApiError(400, 'doctorId must belong to a doctor');

  const prescription = await prisma.dietPrescription.create({
    data: {
      patientId: body.patientId,
      doctorId,
      dietType: body.dietType,
      restrictions: jsonArray(body.restrictions),
      allergies: jsonArray(body.allergies),
      instructions: body.instructions
    },
    include: { patient: { include: { currentDietPlan: true } }, doctor: { select: { id: true, name: true } } }
  });

  await notifyRole(ROLES.DIETICIAN, {
    title: 'New diet prescription pending approval',
    message: `${doctor.name} prescribed ${body.dietType} for ${patient.name}.`,
    type: 'DIET_CHANGED',
    metadata: { prescriptionId: prescription.id, patientId: patient.id }
  });

  res.status(201).json({ success: true, data: { prescription: hydratePrescription(prescription) } });
}));

const approveSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    dietType: z.enum(DIET_TYPES).optional(),
    restrictions: z.array(z.enum(RESTRICTIONS)).optional(),
    allergies: z.array(z.string()).optional(),
    calories: z.number().int().positive().optional().nullable(),
    proteinGrams: z.number().int().nonnegative().optional().nullable(),
    carbsGrams: z.number().int().nonnegative().optional().nullable(),
    fatGrams: z.number().int().nonnegative().optional().nullable(),
    notes: z.string().optional().nullable(),
    startDate: z.coerce.date().optional()
  }).default({})
});

router.patch('/prescriptions/:id/approve', authorize(ROLES.ADMIN, ROLES.DIETICIAN), validate(approveSchema), asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const body = req.validated.body || {};

  const result = await prisma.$transaction(async (tx) => {
    const prescription = await tx.dietPrescription.findUnique({
      where: { id },
      include: { patient: true, doctor: { select: { id: true, name: true } } }
    });
    if (!prescription) throw new ApiError(404, 'Prescription not found');
    if (prescription.status !== 'PENDING') throw new ApiError(409, 'Only pending prescriptions can be approved');

    await tx.dietPlan.updateMany({
      where: { patientId: prescription.patientId, status: 'APPROVED', endDate: null },
      data: { status: 'SUPERSEDED', endDate: new Date() }
    });

    const plan = await tx.dietPlan.create({
      data: {
        patientId: prescription.patientId,
        dietType: body.dietType || prescription.dietType,
        restrictions: jsonArray(body.restrictions ?? safeJsonParse(prescription.restrictions, [])),
        allergies: jsonArray(body.allergies ?? safeJsonParse(prescription.allergies, [])),
        calories: body.calories,
        proteinGrams: body.proteinGrams,
        carbsGrams: body.carbsGrams,
        fatGrams: body.fatGrams,
        notes: body.notes ?? prescription.instructions,
        approvedById: req.user.id,
        startDate: body.startDate || new Date(),
        status: 'APPROVED'
      }
    });

    const updatedPrescription = await tx.dietPrescription.update({
      where: { id },
      data: { status: 'APPROVED', dieticianId: req.user.id, dietPlanId: plan.id, approvedAt: new Date() },
      include: {
        patient: { include: { currentDietPlan: true, user: { select: { id: true } } } },
        doctor: { select: { id: true, name: true } },
        dietician: { select: { id: true, name: true } },
        dietPlan: true
      }
    });

    await tx.patient.update({ where: { id: prescription.patientId }, data: { currentDietPlanId: plan.id } });

    return { prescription: updatedPrescription, plan, patient: prescription.patient };
  });

  await notifyRole(ROLES.KITCHEN_STAFF, {
    title: 'Patient diet changed',
    message: `${result.patient.name} is now assigned ${result.plan.dietType}. Update upcoming meals.`,
    type: 'DIET_CHANGED',
    metadata: { patientId: result.patient.id, dietPlanId: result.plan.id }
  });
  const patientWithUser = await prisma.patient.findUnique({ where: { id: result.patient.id }, select: { userId: true } });
  if (patientWithUser?.userId) {
    await notifyUser(patientWithUser.userId, {
      title: 'Diet plan updated',
      message: `Your diet plan has been updated to ${result.plan.dietType}.`,
      type: 'DIET_CHANGED',
      metadata: { patientId: result.patient.id, dietPlanId: result.plan.id }
    });
  }

  res.json({ success: true, data: { prescription: hydratePrescription(result.prescription), plan: hydrateDietPlan(result.plan) } });
}));

const rejectSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ reason: z.string().optional() }).default({})
});

router.patch('/prescriptions/:id/reject', authorize(ROLES.ADMIN, ROLES.DIETICIAN), validate(rejectSchema), asyncHandler(async (req, res) => {
  const prescription = await prisma.dietPrescription.update({
    where: { id: req.validated.params.id },
    data: { status: 'REJECTED', dieticianId: req.user.id, instructions: req.validated.body.reason || undefined },
    include: { patient: { include: { currentDietPlan: true } }, doctor: { select: { id: true, name: true } }, dietician: { select: { id: true, name: true } } }
  });
  res.json({ success: true, data: { prescription: hydratePrescription(prescription) } });
}));

const listPlansSchema = z.object({
  query: z.object({
    patientId: z.string().optional(),
    status: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50)
  })
});

router.get('/plans', validate(listPlansSchema), asyncHandler(async (req, res) => {
  const { patientId, status, page, limit } = req.validated.query;
  const ownPatientId = await getOwnPatientId(req);
  const where = {
    ...(patientId ? { patientId } : {}),
    ...(status ? { status } : {}),
    ...(ownPatientId ? { patientId: ownPatientId } : {})
  };
  const [items, total] = await Promise.all([
    prisma.dietPlan.findMany({
      where,
      include: { patient: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.dietPlan.count({ where })
  ]);
  res.json({ success: true, data: { items: items.map(hydrateDietPlan), total, page, limit } });
}));

const createPlanSchema = z.object({
  body: z.object({
    patientId: z.string().min(1),
    dietType: z.enum(DIET_TYPES),
    restrictions: z.array(z.enum(RESTRICTIONS)).default([]),
    allergies: z.array(z.string()).default([]),
    calories: z.number().int().positive().optional().nullable(),
    proteinGrams: z.number().int().nonnegative().optional().nullable(),
    carbsGrams: z.number().int().nonnegative().optional().nullable(),
    fatGrams: z.number().int().nonnegative().optional().nullable(),
    notes: z.string().optional().nullable(),
    makeCurrent: z.boolean().default(true)
  })
});

router.post('/plans', authorize(ROLES.ADMIN, ROLES.DIETICIAN), validate(createPlanSchema), asyncHandler(async (req, res) => {
  const body = req.validated.body;
  const patient = await prisma.patient.findUnique({ where: { id: body.patientId } });
  if (!patient) throw new ApiError(404, 'Patient not found');

  const plan = await prisma.$transaction(async (tx) => {
    if (body.makeCurrent) {
      await tx.dietPlan.updateMany({ where: { patientId: body.patientId, status: 'APPROVED', endDate: null }, data: { status: 'SUPERSEDED', endDate: new Date() } });
    }
    const created = await tx.dietPlan.create({
      data: {
        patientId: body.patientId,
        dietType: body.dietType,
        restrictions: jsonArray(body.restrictions),
        allergies: jsonArray(body.allergies),
        calories: body.calories,
        proteinGrams: body.proteinGrams,
        carbsGrams: body.carbsGrams,
        fatGrams: body.fatGrams,
        notes: body.notes,
        approvedById: req.user.id,
        status: 'APPROVED'
      }
    });
    if (body.makeCurrent) await tx.patient.update({ where: { id: body.patientId }, data: { currentDietPlanId: created.id } });
    return created;
  });

  await notifyRole(ROLES.KITCHEN_STAFF, {
    title: 'Diet plan assigned',
    message: `${patient.name} is assigned ${plan.dietType}.`,
    type: 'DIET_CHANGED',
    metadata: { patientId: patient.id, dietPlanId: plan.id }
  });

  res.status(201).json({ success: true, data: { plan: hydrateDietPlan(plan) } });
}));

const updatePlanSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    dietType: z.enum(DIET_TYPES).optional(),
    restrictions: z.array(z.enum(RESTRICTIONS)).optional(),
    allergies: z.array(z.string()).optional(),
    calories: z.number().int().positive().optional().nullable(),
    proteinGrams: z.number().int().nonnegative().optional().nullable(),
    carbsGrams: z.number().int().nonnegative().optional().nullable(),
    fatGrams: z.number().int().nonnegative().optional().nullable(),
    notes: z.string().optional().nullable(),
    status: z.string().optional(),
    endDate: z.coerce.date().optional().nullable(),
    makeCurrent: z.boolean().optional()
  }).refine((value) => Object.keys(value).length > 0, 'At least one field is required')
});

router.patch('/plans/:id', authorize(ROLES.ADMIN, ROLES.DIETICIAN), validate(updatePlanSchema), asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const body = req.validated.body;
  const data = { ...body };
  delete data.makeCurrent;
  if (body.restrictions) data.restrictions = jsonArray(body.restrictions);
  if (body.allergies) data.allergies = jsonArray(body.allergies);

  const plan = await prisma.$transaction(async (tx) => {
    const existing = await tx.dietPlan.findUnique({ where: { id }, include: { patient: true } });
    if (!existing) throw new ApiError(404, 'Diet plan not found');
    const updated = await tx.dietPlan.update({ where: { id }, data });
    if (body.makeCurrent) {
      await tx.patient.update({ where: { id: existing.patientId }, data: { currentDietPlanId: id } });
    }
    return { ...updated, patient: existing.patient };
  });

  await notifyRole(ROLES.KITCHEN_STAFF, {
    title: 'Diet plan customized',
    message: `${plan.patient.name}'s diet plan was updated.`,
    type: 'DIET_CHANGED',
    metadata: { patientId: plan.patientId, dietPlanId: plan.id }
  });

  res.json({ success: true, data: { plan: hydrateDietPlan(plan) } });
}));

module.exports = router;
