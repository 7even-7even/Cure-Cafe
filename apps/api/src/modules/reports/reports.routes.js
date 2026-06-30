const express = require('express');
const { z } = require('zod');
const { prisma } = require('../../config/prisma');
const { requireAuth, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const { asyncHandler } = require('../../utils/asyncHandler');
const { startOfDay, endOfDay, parseDateOrToday } = require('../../utils/date');
const { ROLES, MEAL_TYPES } = require('../../constants');

const router = express.Router();
router.use(requireAuth, authorize(ROLES.ADMIN, ROLES.DIETICIAN, ROLES.KITCHEN_STAFF));

const dateSchema = z.object({ query: z.object({ date: z.string().optional() }) });

router.get('/daily-meals', validate(dateSchema), asyncHandler(async (req, res) => {
  const date = parseDateOrToday(req.validated.query.date);
  const orders = await prisma.mealOrder.findMany({
    where: { serviceDate: { gte: startOfDay(date), lte: endOfDay(date) } },
    include: { dietPlan: true },
    orderBy: { mealType: 'asc' }
  });
  const report = { total: orders.length, served: 0, byMealType: {}, byDietType: {}, byStatus: {}, byWard: {} };
  for (const order of orders) {
    const dietType = order.dietPlan?.dietType || 'NORMAL';
    if (order.status === 'DELIVERED') report.served += 1;
    report.byMealType[order.mealType] = (report.byMealType[order.mealType] || 0) + 1;
    report.byDietType[dietType] = (report.byDietType[dietType] || 0) + 1;
    report.byStatus[order.status] = (report.byStatus[order.status] || 0) + 1;
    report.byWard[order.ward] = (report.byWard[order.ward] || 0) + 1;
  }
  res.json({ success: true, data: { date: date.toISOString().slice(0, 10), report } });
}));

router.get('/diet-distribution', asyncHandler(async (_req, res) => {
  const patients = await prisma.patient.findMany({ where: { status: 'ADMITTED' }, include: { currentDietPlan: true } });
  const distribution = patients.reduce((acc, patient) => {
    const dietType = patient.currentDietPlan?.dietType || 'NORMAL';
    acc[dietType] = (acc[dietType] || 0) + 1;
    return acc;
  }, {});
  res.json({ success: true, data: { totalAdmittedPatients: patients.length, distribution } });
}));

const rangeSchema = z.object({
  query: z.object({
    from: z.string().optional(),
    to: z.string().optional()
  })
});

router.get('/food-wastage', validate(rangeSchema), asyncHandler(async (req, res) => {
  const from = req.validated.query.from ? startOfDay(req.validated.query.from) : startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const to = req.validated.query.to ? endOfDay(req.validated.query.to) : endOfDay(new Date());
  const items = await prisma.foodWastage.findMany({
    where: { date: { gte: from, lte: to } },
    include: { item: true },
    orderBy: { date: 'desc' }
  });
  const summary = items.reduce((acc, row) => {
    acc.totalQuantity += row.quantity;
    acc.totalCost += row.costEstimate;
    const key = row.mealType || row.item?.name || 'Uncategorized';
    acc.byCategory[key] = (acc.byCategory[key] || 0) + row.quantity;
    return acc;
  }, { totalQuantity: 0, totalCost: 0, byCategory: {} });
  res.json({ success: true, data: { items, summary } });
}));

const wastageCreateSchema = z.object({
  body: z.object({
    itemId: z.string().optional().nullable(),
    mealType: z.enum(MEAL_TYPES).optional().nullable(),
    quantity: z.number().positive(),
    unit: z.string().min(1),
    reason: z.string().optional().nullable(),
    costEstimate: z.number().nonnegative().default(0),
    date: z.coerce.date().optional()
  })
});

router.post('/food-wastage', validate(wastageCreateSchema), asyncHandler(async (req, res) => {
  const row = await prisma.foodWastage.create({ data: { ...req.validated.body, createdById: req.user.id } });
  res.status(201).json({ success: true, data: { wastage: row } });
}));

router.get('/inventory-consumption', validate(rangeSchema), asyncHandler(async (req, res) => {
  const from = req.validated.query.from ? startOfDay(req.validated.query.from) : startOfDay(new Date());
  const to = req.validated.query.to ? endOfDay(req.validated.query.to) : endOfDay(new Date());
  const txns = await prisma.inventoryTxn.findMany({
    where: { type: { in: ['CONSUMPTION', 'WASTAGE'] }, createdAt: { gte: from, lte: to } },
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
  res.json({ success: true, data: { from, to, items: [...rows.values()], totalCost: [...rows.values()].reduce((sum, row) => sum + row.cost, 0) } });
}));

const monthSchema = z.object({ query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }) });

router.get('/monthly-expenditure', validate(monthSchema), asyncHandler(async (req, res) => {
  const month = req.validated.query.month || new Date().toISOString().slice(0, 7);
  const [year, zeroMonth] = month.split('-').map(Number);
  const from = new Date(year, zeroMonth - 1, 1);
  const to = endOfDay(new Date(year, zeroMonth, 0));

  const [purchases, mealCharges, wastage] = await Promise.all([
    prisma.inventoryTxn.findMany({ where: { type: 'PURCHASE', createdAt: { gte: from, lte: to } }, include: { item: true } }),
    prisma.billingCharge.findMany({ where: { chargeDate: { gte: from, lte: to } } }),
    prisma.foodWastage.findMany({ where: { date: { gte: from, lte: to } } })
  ]);

  const inventoryPurchaseCost = purchases.reduce((sum, txn) => sum + txn.quantity * txn.item.costPerUnit, 0);
  const billedMealRevenue = mealCharges.reduce((sum, charge) => sum + charge.amount, 0);
  const wastageCost = wastage.reduce((sum, row) => sum + row.costEstimate, 0);

  res.json({
    success: true,
    data: {
      month,
      inventoryPurchaseCost,
      billedMealRevenue,
      wastageCost,
      netFoodCostEstimate: inventoryPurchaseCost + wastageCost - billedMealRevenue,
      purchaseTransactions: purchases.length,
      billedMeals: mealCharges.length
    }
  });
}));

module.exports = router;
