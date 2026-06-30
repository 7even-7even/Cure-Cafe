const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { prisma } = require('../../config/prisma');
const { env } = require('../../config/env');
const { validate } = require('../../middleware/validate');
const { requireAuth, signAccessToken, signRefreshToken, hashToken } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/asyncHandler');
const { ApiError } = require('../../utils/apiError');
const { ROLES } = require('../../constants');
const { hydratePatient } = require('../../utils/json');

const router = express.Router();

function sanitizeUser(user) {
  if (!user) return user;
  const { passwordHash, refreshTokenHash, patientProfile, ...safe } = user;
  return { ...safe, patientProfile: hydratePatient(patientProfile) };
}

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email().transform((v) => v.toLowerCase()),
    phone: z.string().optional(),
    password: z.string().min(8).max(128),
    role: z.literal(ROLES.PATIENT).optional().default(ROLES.PATIENT)
  })
});

router.post('/register', validate(registerSchema), asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.validated.body;
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, phone, passwordHash, role: ROLES.PATIENT }
  });

  res.status(201).json({ success: true, data: { user: sanitizeUser(user) } });
}));

const loginSchema = z.object({
  body: z.object({
    email: z.string().email().transform((v) => v.toLowerCase()),
    password: z.string().min(1)
  })
});

router.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.validated.body;
  const user = await prisma.user.findUnique({
    where: { email },
    include: { patientProfile: { include: { currentDietPlan: true } } }
  });

  if (!user || !user.isActive) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new ApiError(401, 'Invalid email or password');

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: hashToken(refreshToken) } });

  res.json({ success: true, data: { accessToken, refreshToken, user: sanitizeUser(user) } });
}));

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(20)
  })
});

router.post('/refresh', validate(refreshSchema), asyncHandler(async (req, res) => {
  const { refreshToken } = req.validated.body;
  let payload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw new ApiError(401, 'Invalid refresh token');
  }

  if (payload.tokenType !== 'refresh') throw new ApiError(401, 'Invalid refresh token');

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { patientProfile: { include: { currentDietPlan: true } } }
  });
  if (!user || !user.isActive || user.refreshTokenHash !== hashToken(refreshToken)) {
    throw new ApiError(401, 'Refresh token revoked');
  }

  const newAccessToken = signAccessToken(user);
  const newRefreshToken = signRefreshToken(user);
  await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: hashToken(newRefreshToken) } });

  res.json({ success: true, data: { accessToken: newAccessToken, refreshToken: newRefreshToken, user: sanitizeUser(user) } });
}));

router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  await prisma.user.update({ where: { id: req.user.id }, data: { refreshTokenHash: null } });
  res.json({ success: true, message: 'Logged out successfully' });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { patientProfile: { include: { currentDietPlan: true } } }
  });
  res.json({ success: true, data: { user: sanitizeUser(user) } });
}));

module.exports = router;
