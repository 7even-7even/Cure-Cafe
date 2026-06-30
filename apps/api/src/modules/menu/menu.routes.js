const express = require('express');
const { z } = require('zod');
const { prisma } = require('../../config/prisma');
const { requireAuth, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { asyncHandler } = require('../../utils/asyncHandler');
const { ApiError } = require('../../utils/apiError');
const { jsonArray, safeJsonParse } = require('../../utils/json');
const { ROLES, MENU_ITEM_TYPES, FOOD_ORDER_STATUSES, RESTRICTIONS } = require('../../constants');
const { notifyRole, notifyUser } = require('../../services/notification.service');

const router = express.Router();
router.use(requireAuth);

function hydrateMenuItem(item) {
  if (!item) return item;
  return {
    ...item,
    ingredients: safeJsonParse(item.ingredients, []),
    allergens: safeJsonParse(item.allergens, []),
    restrictions: safeJsonParse(item.restrictions, []),
    customizableOptions: safeJsonParse(item.customizableOptions, [])
  };
}

function hydrateFoodOrder(order) {
  if (!order) return order;
  return {
    ...order,
    items: order.items?.map((item) => ({ ...item, menuItem: hydrateMenuItem(item.menuItem) })) || [],
    patient: order.patient ? { ...order.patient, user: order.patient.user } : order.patient
  };
}

function foodOrderInclude() {
  return {
    patient: { include: { user: { select: { id: true, name: true, email: true } } } },
    items: { include: { menuItem: true }, orderBy: { createdAt: 'asc' } },
    statusHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
    billingCharge: true
  };
}

async function ownPatient(req) {
  const patient = await prisma.patient.findUnique({
    where: { userId: req.user.id },
    include: { user: { select: { id: true, name: true, email: true } } }
  });
  if (!patient) throw new ApiError(400, 'Only admitted patients with a linked patient profile can place food orders');
  if (patient.status !== 'ADMITTED') throw new ApiError(400, 'Only admitted patients can place food orders');
  return patient;
}

async function getPatientForOrder(req, patientId) {
  if (req.user.role === ROLES.PATIENT) return ownPatient(req);
  if (!patientId) throw new ApiError(400, 'patientId is required');
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: { user: { select: { id: true, name: true, email: true } } }
  });
  if (!patient) throw new ApiError(404, 'Patient not found');
  if (patient.status !== 'ADMITTED') throw new ApiError(400, 'Only admitted patients can receive food orders');
  return patient;
}

async function assertOrderAccess(req, order) {
  if (req.user.role === ROLES.ADMIN || req.user.role === ROLES.KITCHEN_STAFF || req.user.role === ROLES.DELIVERY_STAFF || req.user.role === ROLES.DIETICIAN) return;
  if (req.user.role === ROLES.PATIENT) {
    const profile = await prisma.patient.findUnique({ where: { userId: req.user.id }, select: { id: true } });
    if (!profile || profile.id !== order.patientId) throw new ApiError(403, 'Patients can access only their own orders');
    return;
  }
  throw new ApiError(403, 'Forbidden');
}

async function generateOrderNumber(tx) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  for (let i = 0; i < 5; i += 1) {
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const orderNumber = `CC-${date}-${suffix}`;
    const exists = await tx.foodOrder.findUnique({ where: { orderNumber }, select: { id: true } });
    if (!exists) return orderNumber;
  }
  throw new ApiError(500, 'Could not generate order number');
}

const listMenuSchema = z.object({
  query: z.object({
    active: z.enum(['true', 'false']).optional().default('true'),
    itemType: z.enum(MENU_ITEM_TYPES).optional(),
    category: z.string().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50)
  })
});

router.get('/items', validate(listMenuSchema), asyncHandler(async (req, res) => {
  const { active, itemType, category, search, page, limit } = req.validated.query;
  const where = {
    ...(active ? { isActive: active === 'true' } : {}),
    ...(itemType ? { itemType } : {}),
    ...(category ? { category } : {}),
    ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] } : {})
  };

  const [items, total] = await Promise.all([
    prisma.menuItem.findMany({ where, orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * limit, take: limit }),
    prisma.menuItem.count({ where })
  ]);

  res.json({ success: true, data: { items: items.map(hydrateMenuItem), total, page, limit } });
}));

router.get('/types', (_req, res) => {
  res.json({ success: true, data: { itemTypes: MENU_ITEM_TYPES, orderStatuses: FOOD_ORDER_STATUSES } });
});

const menuItemBody = z.object({
  name: z.string().min(2).max(140),
  description: z.string().max(1000).optional().nullable(),
  itemType: z.enum(MENU_ITEM_TYPES),
  category: z.string().max(80).optional().nullable(),
  price: z.number().nonnegative(),
  calories: z.number().nonnegative().default(0),
  carbsGrams: z.number().nonnegative().default(0),
  proteinGrams: z.number().nonnegative().default(0),
  fatGrams: z.number().nonnegative().default(0),
  vitaminsGrams: z.number().nonnegative().default(0),
  fiberGrams: z.number().nonnegative().default(0),
  sodiumMg: z.number().nonnegative().default(0),
  ingredients: z.array(z.string()).default([]),
  allergens: z.array(z.string()).default([]),
  restrictions: z.array(z.enum(RESTRICTIONS)).default([]),
  customizableOptions: z.array(z.string()).default([]),
  imageUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().default(true)
});

router.post('/items', authorize(ROLES.ADMIN, ROLES.KITCHEN_STAFF), validate(z.object({ body: menuItemBody })), asyncHandler(async (req, res) => {
  const body = req.validated.body;
  const item = await prisma.menuItem.create({
    data: {
      ...body,
      ingredients: jsonArray(body.ingredients),
      allergens: jsonArray(body.allergens),
      restrictions: jsonArray(body.restrictions),
      customizableOptions: jsonArray(body.customizableOptions),
      createdById: req.user.id
    }
  });

  await notifyRole(ROLES.PATIENT, {
    title: 'New Cure Cafe menu item available',
    message: `${item.name} is now available on the patient menu.`,
    type: 'GENERAL',
    metadata: { menuItemId: item.id }
  });

  res.status(201).json({ success: true, data: { item: hydrateMenuItem(item) } });
}));

const updateMenuItemSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: menuItemBody.partial().refine((value) => Object.keys(value).length > 0, 'At least one field is required')
});

router.patch('/items/:id', authorize(ROLES.ADMIN, ROLES.KITCHEN_STAFF), validate(updateMenuItemSchema), asyncHandler(async (req, res) => {
  const body = req.validated.body;
  const data = { ...body };
  if (body.ingredients) data.ingredients = jsonArray(body.ingredients);
  if (body.allergens) data.allergens = jsonArray(body.allergens);
  if (body.restrictions) data.restrictions = jsonArray(body.restrictions);
  if (body.customizableOptions) data.customizableOptions = jsonArray(body.customizableOptions);
  const item = await prisma.menuItem.update({ where: { id: req.validated.params.id }, data });
  res.json({ success: true, data: { item: hydrateMenuItem(item) } });
}));

router.delete('/items/:id', authorize(ROLES.ADMIN, ROLES.KITCHEN_STAFF), asyncHandler(async (req, res) => {
  const item = await prisma.menuItem.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ success: true, data: { item: hydrateMenuItem(item) }, message: 'Menu item deactivated' });
}));

const placeOrderSchema = z.object({
  body: z.object({
    patientId: z.string().optional(),
    specialInstructions: z.string().max(1000).optional().nullable(),
    items: z.array(z.object({
      menuItemId: z.string().min(1),
      quantity: z.number().int().positive().max(20),
      customizationNotes: z.string().max(500).optional().nullable()
    })).min(1).max(20)
  })
});

router.post('/orders', authorize(ROLES.ADMIN, ROLES.PATIENT), validate(placeOrderSchema), asyncHandler(async (req, res) => {
  const patient = await getPatientForOrder(req, req.validated.body.patientId);
  const requestedItems = req.validated.body.items;
  const ids = [...new Set(requestedItems.map((item) => item.menuItemId))];
  const menuItems = await prisma.menuItem.findMany({ where: { id: { in: ids }, isActive: true } });
  const itemMap = new Map(menuItems.map((item) => [item.id, item]));

  for (const requested of requestedItems) {
    if (!itemMap.has(requested.menuItemId)) throw new ApiError(400, `Menu item is not available: ${requested.menuItemId}`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const orderNumber = await generateOrderNumber(tx);
    const lines = requestedItems.map((requested) => {
      const item = itemMap.get(requested.menuItemId);
      const lineTotal = Number((item.price * requested.quantity).toFixed(2));
      return {
        menuItemId: item.id,
        nameSnapshot: item.name,
        itemTypeSnapshot: item.itemType,
        priceSnapshot: item.price,
        quantity: requested.quantity,
        lineTotal,
        calories: item.calories,
        carbsGrams: item.carbsGrams,
        proteinGrams: item.proteinGrams,
        fatGrams: item.fatGrams,
        vitaminsGrams: item.vitaminsGrams,
        customizationNotes: requested.customizationNotes
      };
    });
    const totalAmount = Number(lines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2));

    const order = await tx.foodOrder.create({
      data: {
        orderNumber,
        patientId: patient.id,
        orderedById: req.user.id,
        ward: patient.ward,
        roomNumber: patient.roomNumber,
        bedNumber: patient.bedNumber,
        totalAmount,
        specialInstructions: req.validated.body.specialInstructions,
        items: { create: lines }
      },
      include: foodOrderInclude()
    });

    await tx.foodOrderStatusHistory.create({ data: { foodOrderId: order.id, status: 'PLACED', changedById: req.user.id, note: 'Order placed by patient' } });
    const charge = await tx.billingCharge.create({
      data: {
        patientId: patient.id,
        foodOrderId: order.id,
        description: `Cure Cafe order ${order.orderNumber}`,
        amount: totalAmount,
        status: 'PENDING'
      }
    });

    return { order: { ...order, billingCharge: charge } };
  });

  await notifyRole(ROLES.KITCHEN_STAFF, {
    title: 'New patient food order',
    message: `${patient.name} placed order ${result.order.orderNumber} for ₹${result.order.totalAmount}.`,
    type: 'GENERAL',
    metadata: { foodOrderId: result.order.id, orderNumber: result.order.orderNumber }
  });
  if (patient.userId) {
    await notifyUser(patient.userId, {
      title: 'Food order placed',
      message: `Your Cure Cafe order ${result.order.orderNumber} has been placed and sent to the kitchen.`,
      type: 'GENERAL',
      metadata: { foodOrderId: result.order.id, orderNumber: result.order.orderNumber }
    });
  }

  res.status(201).json({ success: true, data: { order: hydrateFoodOrder(result.order) } });
}));

const listOrdersSchema = z.object({
  query: z.object({
    status: z.enum(FOOD_ORDER_STATUSES).optional(),
    patientId: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50)
  })
});

router.get('/orders', validate(listOrdersSchema), asyncHandler(async (req, res) => {
  const { status, patientId, page, limit } = req.validated.query;
  let where = { ...(status ? { status } : {}), ...(patientId ? { patientId } : {}) };

  if (req.user.role === ROLES.PATIENT) {
    const profile = await prisma.patient.findUnique({ where: { userId: req.user.id }, select: { id: true } });
    where = { ...where, patientId: profile?.id || '__none__' };
  } else if (req.user.role === ROLES.DELIVERY_STAFF) {
    const deliveryStatuses = ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    where = status && !deliveryStatuses.includes(status) ? { id: '__none__' } : { ...where, ...(status ? {} : { status: { in: deliveryStatuses } }) };
  } else if (![ROLES.ADMIN, ROLES.KITCHEN_STAFF, ROLES.DELIVERY_STAFF, ROLES.DIETICIAN].includes(req.user.role)) {
    throw new ApiError(403, 'Forbidden');
  }

  const [items, total] = await Promise.all([
    prisma.foodOrder.findMany({ where, include: foodOrderInclude(), orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.foodOrder.count({ where })
  ]);

  res.json({ success: true, data: { items: items.map(hydrateFoodOrder), total, page, limit } });
}));

router.get('/orders/:id', asyncHandler(async (req, res) => {
  const order = await prisma.foodOrder.findUnique({ where: { id: req.params.id }, include: foodOrderInclude() });
  if (!order) throw new ApiError(404, 'Food order not found');
  await assertOrderAccess(req, order);
  res.json({ success: true, data: { order: hydrateFoodOrder(order) } });
}));

const statusSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    status: z.enum(FOOD_ORDER_STATUSES),
    note: z.string().max(500).optional(),
    paymentReceived: z.boolean().optional().default(false)
  })
});

function assertFoodOrderTransition(user, currentStatus, nextStatus, paymentReceived) {
  if (currentStatus === 'DELIVERED' || currentStatus === 'CANCELLED') throw new ApiError(409, `Order is already ${currentStatus}`);
  if (user.role === ROLES.ADMIN) return;

  if (user.role === ROLES.KITCHEN_STAFF) {
    const allowed = {
      PLACED: ['ACCEPTED', 'PREPARING', 'CANCELLED'],
      ACCEPTED: ['PREPARING', 'READY_FOR_PICKUP', 'CANCELLED'],
      PREPARING: ['READY_FOR_PICKUP', 'CANCELLED']
    };
    if (!allowed[currentStatus]?.includes(nextStatus)) throw new ApiError(403, `Kitchen staff cannot change order from ${currentStatus} to ${nextStatus}`);
    return;
  }

  if (user.role === ROLES.DELIVERY_STAFF) {
    const allowed = { READY_FOR_PICKUP: ['OUT_FOR_DELIVERY'], OUT_FOR_DELIVERY: ['DELIVERED'] };
    if (!allowed[currentStatus]?.includes(nextStatus)) throw new ApiError(403, `Delivery staff cannot change order from ${currentStatus} to ${nextStatus}`);
    if (nextStatus === 'DELIVERED' && !paymentReceived) throw new ApiError(400, 'Payment confirmation is required before marking this order delivered');
    return;
  }

  throw new ApiError(403, 'Forbidden');
}

router.patch('/orders/:id/status', validate(statusSchema), asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { status, note, paymentReceived } = req.validated.body;

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.foodOrder.findUnique({ where: { id }, include: { patient: true, billingCharge: true } });
    if (!existing) throw new ApiError(404, 'Food order not found');
    if (existing.status === status) return existing;
    assertFoodOrderTransition(req.user, existing.status, status, paymentReceived);

    const data = { status };
    if (status === 'ACCEPTED') data.acceptedAt = new Date();
    if (status === 'PREPARING') data.preparingAt = new Date();
    if (status === 'READY_FOR_PICKUP') data.readyAt = new Date();
    if (status === 'OUT_FOR_DELIVERY') {
      data.dispatchedAt = new Date();
      data.deliveredById = req.user.id;
    }
    if (status === 'DELIVERED') {
      data.deliveredAt = new Date();
      data.deliveredById = req.user.id;
      data.paymentReceivedAt = paymentReceived ? new Date() : null;
    }

    const updated = await tx.foodOrder.update({ where: { id }, data, include: foodOrderInclude() });
    await tx.foodOrderStatusHistory.create({ data: { foodOrderId: id, status, changedById: req.user.id, note } });

    if (status === 'DELIVERED' && existing.billingCharge) {
      await tx.billingCharge.update({ where: { id: existing.billingCharge.id }, data: { status: 'PAID' } });
    }
    if (status === 'CANCELLED' && existing.billingCharge && existing.billingCharge.status !== 'PAID') {
      await tx.billingCharge.update({ where: { id: existing.billingCharge.id }, data: { status: 'WAIVED' } });
    }

    return updated;
  });

  const patientUserId = result.patient?.userId;
  if (status === 'READY_FOR_PICKUP') {
    await notifyRole(ROLES.DELIVERY_STAFF, {
      title: 'Cure Cafe order ready for pickup',
      message: `Order ${result.orderNumber} is ready for delivery to ${result.ward}/${result.roomNumber}-${result.bedNumber}.`,
      type: 'PENDING_DELIVERY',
      metadata: { foodOrderId: result.id, orderNumber: result.orderNumber }
    });
  }
  if (patientUserId) {
    const patientMessages = {
      ACCEPTED: 'Your Cure Cafe order has been accepted by the kitchen.',
      PREPARING: 'Your Cure Cafe order is being prepared.',
      READY_FOR_PICKUP: 'Your Cure Cafe order is ready and waiting for delivery pickup.',
      OUT_FOR_DELIVERY: 'Your Cure Cafe order is out for delivery.',
      DELIVERED: 'Your Cure Cafe order has been delivered and payment was received.',
      CANCELLED: 'Your Cure Cafe order was cancelled.'
    };
    await notifyUser(patientUserId, {
      title: `Order ${result.orderNumber}: ${status.replaceAll('_', ' ').toLowerCase()}`,
      message: patientMessages[status] || `Order status updated to ${status}`,
      type: status === 'OUT_FOR_DELIVERY' || status === 'READY_FOR_PICKUP' ? 'PENDING_DELIVERY' : 'GENERAL',
      metadata: { foodOrderId: result.id, orderNumber: result.orderNumber }
    });
  }

  const fresh = await prisma.foodOrder.findUnique({ where: { id: result.id }, include: foodOrderInclude() });
  res.json({ success: true, data: { order: hydrateFoodOrder(fresh) } });
}));

module.exports = router;
