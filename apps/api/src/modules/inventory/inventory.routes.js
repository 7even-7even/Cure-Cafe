const express = require('express');
const { z } = require('zod');
const { prisma } = require('../../config/prisma');
const { requireAuth, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { asyncHandler } = require('../../utils/asyncHandler');
const { ApiError } = require('../../utils/apiError');
const { startOfDay, endOfDay, addDays, parseDateOrToday } = require('../../utils/date');
const { ROLES, INVENTORY_TXN_TYPES } = require('../../constants');
const { notifyLowStock } = require('../../services/notification.service');

const router = express.Router();
router.use(requireAuth, authorize(ROLES.ADMIN, ROLES.KITCHEN_STAFF, ROLES.DIETICIAN));

const listSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    active: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50)
  })
});

router.get('/items', validate(listSchema), asyncHandler(async (req, res) => {
  const { search, active, page, limit } = req.validated.query;
  const where = {
    ...(search ? { name: { contains: search } } : {}),
    ...(active ? { isActive: active === 'true' } : {})
  };
  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({ where, orderBy: { name: 'asc' }, skip: (page - 1) * limit, take: limit }),
    prisma.inventoryItem.count({ where })
  ]);
  res.json({ success: true, data: { items, total, page, limit } });
}));

const itemSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(120),
    unit: z.string().min(1).max(30),
    currentStock: z.number().nonnegative().default(0),
    lowStockThreshold: z.number().nonnegative().default(0),
    expiryDate: z.coerce.date().optional().nullable(),
    batchNumber: z.string().optional().nullable(),
    costPerUnit: z.number().nonnegative().default(0),
    isActive: z.boolean().default(true)
  })
});

router.post('/items', authorize(ROLES.ADMIN, ROLES.KITCHEN_STAFF), validate(itemSchema), asyncHandler(async (req, res) => {
  const item = await prisma.inventoryItem.create({ data: req.validated.body });
  if (item.currentStock <= item.lowStockThreshold) await notifyLowStock(item);
  res.status(201).json({ success: true, data: { item } });
}));

const updateItemSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: itemSchema.shape.body.partial().refine((value) => Object.keys(value).length > 0, 'At least one field is required')
});

router.patch('/items/:id', authorize(ROLES.ADMIN, ROLES.KITCHEN_STAFF), validate(updateItemSchema), asyncHandler(async (req, res) => {
  const item = await prisma.inventoryItem.update({ where: { id: req.validated.params.id }, data: req.validated.body });
  if (item.currentStock <= item.lowStockThreshold) await notifyLowStock(item);
  res.json({ success: true, data: { item } });
}));

router.get('/items/:id/transactions', asyncHandler(async (req, res) => {
  const txns = await prisma.inventoryTxn.findMany({ where: { itemId: req.params.id }, orderBy: { createdAt: 'desc' }, take: 100 });
  res.json({ success: true, data: { items: txns } });
}));

const transactionSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    type: z.enum(INVENTORY_TXN_TYPES),
    quantity: z.number().positive(),
    reason: z.string().optional(),
    mealOrderId: z.string().optional()
  })
});

router.post('/items/:id/transactions', authorize(ROLES.ADMIN, ROLES.KITCHEN_STAFF), validate(transactionSchema), asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { type, quantity, reason, mealOrderId } = req.validated.body;

  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({ where: { id } });
    if (!item) throw new ApiError(404, 'Inventory item not found');

    let newStock = item.currentStock;
    if (type === 'PURCHASE' || type === 'ADJUSTMENT') newStock += quantity;
    if (type === 'CONSUMPTION' || type === 'WASTAGE') newStock -= quantity;
    if (newStock < 0) throw new ApiError(400, `Insufficient stock. Available: ${item.currentStock} ${item.unit}`);

    const txn = await tx.inventoryTxn.create({
      data: { itemId: id, type, quantity, reason, mealOrderId, createdById: req.user.id }
    });
    const updatedItem = await tx.inventoryItem.update({ where: { id }, data: { currentStock: newStock } });

    if (type === 'WASTAGE') {
      await tx.foodWastage.create({
        data: {
          itemId: id,
          quantity,
          unit: item.unit,
          reason: reason || 'Inventory wastage',
          costEstimate: quantity * item.costPerUnit,
          createdById: req.user.id
        }
      });
    }

    return { txn, item: updatedItem };
  });

  if (result.item.currentStock <= result.item.lowStockThreshold) await notifyLowStock(result.item);
  res.status(201).json({ success: true, data: result });
}));

router.get('/low-stock', asyncHandler(async (_req, res) => {
  const items = await prisma.inventoryItem.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  res.json({ success: true, data: { items: items.filter((item) => item.currentStock <= item.lowStockThreshold) } });
}));

const expiringSchema = z.object({ query: z.object({ days: z.coerce.number().int().positive().max(365).default(7) }) });

router.get('/expiring', validate(expiringSchema), asyncHandler(async (req, res) => {
  const now = new Date();
  const until = addDays(now, req.validated.query.days);
  const items = await prisma.inventoryItem.findMany({
    where: { isActive: true, expiryDate: { gte: now, lte: until } },
    orderBy: { expiryDate: 'asc' }
  });
  res.json({ success: true, data: { items } });
}));

const dailySchema = z.object({ query: z.object({ date: z.string().optional() }) });

router.get('/reports/daily-consumption', validate(dailySchema), asyncHandler(async (req, res) => {
  const date = parseDateOrToday(req.validated.query.date);
  const txns = await prisma.inventoryTxn.findMany({
    where: { type: { in: ['CONSUMPTION', 'WASTAGE'] }, createdAt: { gte: startOfDay(date), lte: endOfDay(date) } },
    include: { item: true },
    orderBy: { createdAt: 'asc' }
  });
  const rows = new Map();
  for (const txn of txns) {
    const row = rows.get(txn.itemId) || { itemId: txn.itemId, itemName: txn.item.name, unit: txn.item.unit, quantity: 0, cost: 0 };
    row.quantity += txn.quantity;
    row.cost += txn.quantity * txn.item.costPerUnit;
    rows.set(txn.itemId, row);
  }
  res.json({ success: true, data: { date: date.toISOString().slice(0, 10), items: [...rows.values()], totalCost: [...rows.values()].reduce((sum, row) => sum + row.cost, 0) } });
}));

module.exports = router;
