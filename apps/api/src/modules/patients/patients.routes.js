const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { prisma } = require('../../config/prisma');
const { requireAuth, authorize, isRole } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { asyncHandler } = require('../../utils/asyncHandler');
const { ApiError } = require('../../utils/apiError');
const { jsonArray, hydratePatient } = require('../../utils/json');
const { ROLES, RESTRICTIONS } = require('../../constants');
const { patientUpload } = require('../files/upload');

const router = express.Router();
router.use(requireAuth);

async function getPatientIdForUser(userId) {
  const profile = await prisma.patient.findUnique({ where: { userId }, select: { id: true } });
  return profile?.id || null;
}

async function ensurePatientAccess(req, patientId) {
  if (req.user.role !== ROLES.PATIENT) return;
  const ownPatientId = await getPatientIdForUser(req.user.id);
  if (!ownPatientId || ownPatientId !== patientId) throw new ApiError(403, 'Patient can access only their own record');
}

const listSchema = z.object({
  query: z.object({
    status: z.enum(['ADMITTED', 'DISCHARGED']).optional(),
    ward: z.string().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50)
  })
});

router.get('/', validate(listSchema), asyncHandler(async (req, res) => {
  const { status, ward, search, page, limit } = req.validated.query;
  let where = {
    ...(status ? { status } : {}),
    ...(ward ? { ward } : {}),
    ...(search ? { OR: [{ name: { contains: search } }, { mrn: { contains: search } }, { phone: { contains: search } }] } : {})
  };

  if (req.user.role === ROLES.PATIENT) {
    const ownPatientId = await getPatientIdForUser(req.user.id);
    where = ownPatientId ? { id: ownPatientId } : { id: '__none__' };
  }

  const [items, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      include: { currentDietPlan: true, user: { select: { id: true, email: true, name: true } } },
      orderBy: [{ status: 'asc' }, { ward: 'asc' }, { roomNumber: 'asc' }],
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.patient.count({ where })
  ]);

  res.json({ success: true, data: { items: items.map(hydratePatient), total, page, limit } });
}));

const createPatientSchema = z.object({
  body: z.object({
    userId: z.string().optional().nullable(),
    createUser: z.object({
      email: z.string().email().transform((v) => v.toLowerCase()),
      password: z.string().min(8).max(128)
    }).optional(),
    mrn: z.string().min(2).max(60),
    name: z.string().min(2).max(120),
    age: z.number().int().min(0).max(130).optional().nullable(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().nullable(),
    phone: z.string().optional().nullable(),
    roomNumber: z.string().min(1).max(30),
    ward: z.string().min(1).max(80),
    bedNumber: z.string().min(1).max(30),
    admissionDate: z.coerce.date().default(() => new Date()),
    dischargeDate: z.coerce.date().optional().nullable(),
    preferences: z.array(z.string()).default([]),
    restrictions: z.array(z.enum(RESTRICTIONS)).default([]),
    allergies: z.array(z.string()).default([]),
    notes: z.string().optional().nullable()
  }).refine((body) => !(body.userId && body.createUser), 'Use either userId or createUser, not both')
});

router.post('/', authorize(ROLES.ADMIN, ROLES.DIETICIAN), validate(createPatientSchema), asyncHandler(async (req, res) => {
  const body = req.validated.body;
  const patient = await prisma.$transaction(async (tx) => {
    let userId = body.userId || null;
    if (body.createUser) {
      const passwordHash = await bcrypt.hash(body.createUser.password, 12);
      const user = await tx.user.create({
        data: {
          name: body.name,
          email: body.createUser.email,
          phone: body.phone,
          passwordHash,
          role: ROLES.PATIENT
        }
      });
      userId = user.id;
    }

    return tx.patient.create({
      data: {
        userId,
        mrn: body.mrn,
        name: body.name,
        age: body.age,
        gender: body.gender,
        phone: body.phone,
        roomNumber: body.roomNumber,
        ward: body.ward,
        bedNumber: body.bedNumber,
        admissionDate: body.admissionDate,
        dischargeDate: body.dischargeDate,
        preferences: jsonArray(body.preferences),
        restrictions: jsonArray(body.restrictions),
        allergies: jsonArray(body.allergies),
        notes: body.notes
      },
      include: { currentDietPlan: true, user: { select: { id: true, email: true, name: true } } }
    });
  });

  res.status(201).json({ success: true, data: { patient: hydratePatient(patient) } });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  await ensurePatientAccess(req, req.params.id);
  const patient = await prisma.patient.findUnique({
    where: { id: req.params.id },
    include: {
      currentDietPlan: true,
      dietPlans: { orderBy: { createdAt: 'desc' } },
      prescriptions: { orderBy: { createdAt: 'desc' }, include: { doctor: { select: { id: true, name: true } }, dietician: { select: { id: true, name: true } } } },
      mealOrders: { orderBy: { plannedFor: 'desc' }, take: 20 },
      user: { select: { id: true, email: true, name: true } }
    }
  });
  if (!patient) throw new ApiError(404, 'Patient not found');
  res.json({ success: true, data: { patient: hydratePatient(patient) } });
}));

const updatePatientSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    name: z.string().min(2).max(120).optional(),
    age: z.number().int().min(0).max(130).optional().nullable(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().nullable(),
    phone: z.string().optional().nullable(),
    roomNumber: z.string().min(1).max(30).optional(),
    ward: z.string().min(1).max(80).optional(),
    bedNumber: z.string().min(1).max(30).optional(),
    admissionDate: z.coerce.date().optional(),
    dischargeDate: z.coerce.date().optional().nullable(),
    status: z.enum(['ADMITTED', 'DISCHARGED']).optional(),
    preferences: z.array(z.string()).optional(),
    restrictions: z.array(z.enum(RESTRICTIONS)).optional(),
    allergies: z.array(z.string()).optional(),
    notes: z.string().optional().nullable()
  }).refine((value) => Object.keys(value).length > 0, 'At least one field is required')
});

router.patch('/:id', authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.DIETICIAN), validate(updatePatientSchema), asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const body = req.validated.body;
  const data = { ...body };
  if (body.preferences) data.preferences = jsonArray(body.preferences);
  if (body.restrictions) data.restrictions = jsonArray(body.restrictions);
  if (body.allergies) data.allergies = jsonArray(body.allergies);

  const patient = await prisma.patient.update({
    where: { id },
    data,
    include: { currentDietPlan: true, user: { select: { id: true, email: true, name: true } } }
  });

  res.json({ success: true, data: { patient: hydratePatient(patient) } });
}));

const dischargeSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ dischargeDate: z.coerce.date().default(() => new Date()) }).default({})
});

router.post('/:id/discharge', authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.DIETICIAN), validate(dischargeSchema), asyncHandler(async (req, res) => {
  const patient = await prisma.patient.update({
    where: { id: req.validated.params.id },
    data: { status: 'DISCHARGED', dischargeDate: req.validated.body.dischargeDate },
    include: { currentDietPlan: true }
  });
  res.json({ success: true, data: { patient: hydratePatient(patient) } });
}));

router.get('/:id/files', asyncHandler(async (req, res) => {
  await ensurePatientAccess(req, req.params.id);
  const files = await prisma.fileAsset.findMany({ where: { patientId: req.params.id }, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: { items: files } });
}));

router.post('/:id/files', patientUpload.single('file'), asyncHandler(async (req, res) => {
  await ensurePatientAccess(req, req.params.id);
  if (req.user.role === ROLES.PATIENT && !isRole(req.user, [ROLES.PATIENT])) throw new ApiError(403, 'Forbidden');
  if (!req.file) throw new ApiError(400, 'File is required');
  const kind = req.body.kind || 'OTHER';
  const file = await prisma.fileAsset.create({
    data: {
      patientId: req.params.id,
      kind,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      storagePath: req.file.path,
      createdById: req.user.id
    }
  });
  res.status(201).json({ success: true, data: { file } });
}));

module.exports = router;
