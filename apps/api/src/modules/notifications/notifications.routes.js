const express = require('express');
const { z } = require('zod');
const { prisma } = require('../../config/prisma');
const { requireAuth, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { asyncHandler } = require('../../utils/asyncHandler');
const { ApiError } = require('../../utils/apiError');
const { hydrateNotification, jsonObject } = require('../../utils/json');
const { ROLES, ROLE_VALUES, NOTIFICATION_TYPES, NOTIFICATION_CHANNELS } = require('../../constants');
const { createNotification } = require('../../services/notification.service');

const router = express.Router();
router.use(requireAuth);

const listSchema = z.object({
  query: z.object({
    unreadOnly: z.enum(['true', 'false']).default('false'),
    all: z.enum(['true', 'false']).default('false'),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50)
  })
});

router.get('/', validate(listSchema), asyncHandler(async (req, res) => {
  const { unreadOnly, all, page, limit } = req.validated.query;
  const canSeeAll = req.user.role === ROLES.ADMIN && all === 'true';
  const where = {
    ...(unreadOnly === 'true' ? { readAt: null } : {}),
    ...(canSeeAll ? {} : { OR: [{ userId: req.user.id }, { roleTarget: req.user.role }] })
  };
  const [items, total] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.notification.count({ where })
  ]);
  res.json({ success: true, data: { items: items.map(hydrateNotification), total, page, limit } });
}));

const createSchema = z.object({
  body: z.object({
    userId: z.string().optional().nullable(),
    roleTarget: z.enum(ROLE_VALUES).optional().nullable(),
    title: z.string().min(2).max(150),
    message: z.string().min(2).max(1000),
    type: z.enum(NOTIFICATION_TYPES).default('GENERAL'),
    channel: z.enum(NOTIFICATION_CHANNELS).default('IN_APP'),
    metadata: z.record(z.string(), z.any()).optional().default({})
  }).refine((body) => body.userId || body.roleTarget, 'Either userId or roleTarget is required')
});

router.post('/', authorize(ROLES.ADMIN), validate(createSchema), asyncHandler(async (req, res) => {
  const notification = await createNotification(req.validated.body);
  res.status(201).json({ success: true, data: { notification: hydrateNotification(notification) } });
}));

router.patch('/:id/read', asyncHandler(async (req, res) => {
  const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!notification) throw new ApiError(404, 'Notification not found');
  if (req.user.role !== ROLES.ADMIN && notification.userId !== req.user.id && notification.roleTarget !== req.user.role) {
    throw new ApiError(403, 'Forbidden');
  }
  const updated = await prisma.notification.update({ where: { id: req.params.id }, data: { readAt: new Date() } });
  res.json({ success: true, data: { notification: hydrateNotification(updated) } });
}));

router.delete('/:id', authorize(ROLES.ADMIN), asyncHandler(async (req, res) => {
  await prisma.notification.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Notification deleted' });
}));

module.exports = router;
