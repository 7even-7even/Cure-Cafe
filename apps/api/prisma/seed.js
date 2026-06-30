const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { DIET_COST } = require('../src/constants');
const { jsonArray, jsonObject } = require('../src/utils/json');
const { startOfDay, combineDateAndTime, addDays } = require('../src/utils/date');

const prisma = new PrismaClient();

const MEAL_COST_FACTOR = { BREAKFAST: 0.25, LUNCH: 0.35, EVENING_SNACKS: 0.15, DINNER: 0.35 };

async function reset() {
  await prisma.patient.updateMany({ data: { currentDietPlanId: null } });
  await prisma.fileAsset.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.billingCharge.deleteMany();
  await prisma.mealStatusHistory.deleteMany();
  await prisma.mealOrder.deleteMany();
  await prisma.dietPrescription.deleteMany();
  await prisma.dietPlan.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.inventoryTxn.deleteMany();
  await prisma.foodWastage.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.mealSchedule.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await reset();

  const passwordHash = await bcrypt.hash('Admin@1234', 12);
  const users = {};
  for (const user of [
    { key: 'admin', name: 'Developer Seven', email: 'devloper7even@gmail.com', role: 'ADMIN', phone: '+919000000001' },
    { key: 'doctor', name: 'Dr. Meera Rao', email: 'doctor@hfms.test', role: 'DOCTOR', phone: '+919000000002' },
    { key: 'dietician', name: 'Anika Dietician', email: 'dietician@hfms.test', role: 'DIETICIAN', phone: '+919000000003' },
    { key: 'kitchen', name: 'Kabir Kitchen', email: 'kitchen@hfms.test', role: 'KITCHEN_STAFF', phone: '+919000000004' },
    { key: 'delivery', name: 'Rohan Delivery', email: 'delivery@hfms.test', role: 'DELIVERY_STAFF', phone: '+919000000005' },
    { key: 'patientUser', name: 'Priya Patient', email: 'patient@hfms.test', role: 'PATIENT', phone: '+919000000006' }
  ]) {
    users[user.key] = await prisma.user.create({ data: { name: user.name, email: user.email, role: user.role, phone: user.phone, passwordHash } });
  }

  const schedules = [];
  for (const schedule of [
    { mealType: 'BREAKFAST', displayName: 'Breakfast', serveTime: '08:00', preparationLeadMinutes: 120 },
    { mealType: 'LUNCH', displayName: 'Lunch', serveTime: '13:00', preparationLeadMinutes: 180 },
    { mealType: 'EVENING_SNACKS', displayName: 'Evening Snacks', serveTime: '17:00', preparationLeadMinutes: 90 },
    { mealType: 'DINNER', displayName: 'Dinner', serveTime: '20:00', preparationLeadMinutes: 180 }
  ]) {
    schedules.push(await prisma.mealSchedule.create({ data: schedule }));
  }

  const patientSeeds = [
    {
      key: 'priya', userId: users.patientUser.id, mrn: 'MRN-1001', name: 'Priya Sharma', age: 42, gender: 'FEMALE', phone: '+919100000001', ward: 'Ward A', roomNumber: 'A-101', bedNumber: '1', dietType: 'DIABETIC', restrictions: ['VEGETARIAN'], allergies: ['Peanut'], preferences: ['Less oil', 'Warm water']
    },
    {
      key: 'amit', mrn: 'MRN-1002', name: 'Amit Verma', age: 65, gender: 'MALE', phone: '+919100000002', ward: 'Ward A', roomNumber: 'A-102', bedNumber: '2', dietType: 'LOW_SODIUM', restrictions: ['LACTOSE_INTOLERANCE'], allergies: [], preferences: ['Soft chapati']
    },
    {
      key: 'fatima', mrn: 'MRN-1003', name: 'Fatima Khan', age: 31, gender: 'FEMALE', phone: '+919100000003', ward: 'Ward B', roomNumber: 'B-201', bedNumber: '1', dietType: 'HIGH_PROTEIN', restrictions: ['GLUTEN_FREE'], allergies: [], preferences: ['Extra dal']
    },
    {
      key: 'george', mrn: 'MRN-1004', name: 'George Mathew', age: 58, gender: 'MALE', phone: '+919100000004', ward: 'ICU', roomNumber: 'ICU-03', bedNumber: '3', dietType: 'LIQUID', restrictions: [], allergies: ['Shellfish'], preferences: ['No spice']
    },
    {
      key: 'neha', mrn: 'MRN-1005', name: 'Neha Jain', age: 27, gender: 'FEMALE', phone: '+919100000005', ward: 'Ward B', roomNumber: 'B-202', bedNumber: '2', dietType: 'NORMAL', restrictions: ['JAIN'], allergies: [], preferences: ['No onion garlic']
    }
  ];

  const patients = {};
  const plans = {};
  for (const seed of patientSeeds) {
    const patient = await prisma.patient.create({
      data: {
        userId: seed.userId,
        mrn: seed.mrn,
        name: seed.name,
        age: seed.age,
        gender: seed.gender,
        phone: seed.phone,
        ward: seed.ward,
        roomNumber: seed.roomNumber,
        bedNumber: seed.bedNumber,
        admissionDate: addDays(new Date(), -Math.floor(Math.random() * 8 + 1)),
        preferences: jsonArray(seed.preferences),
        restrictions: jsonArray(seed.restrictions),
        allergies: jsonArray(seed.allergies),
        notes: 'Seed patient for HFMS demo.'
      }
    });
    const plan = await prisma.dietPlan.create({
      data: {
        patientId: patient.id,
        dietType: seed.dietType,
        restrictions: jsonArray(seed.restrictions),
        allergies: jsonArray(seed.allergies),
        calories: seed.dietType === 'LIQUID' ? 1200 : 1800,
        proteinGrams: seed.dietType === 'HIGH_PROTEIN' ? 120 : 70,
        carbsGrams: seed.dietType === 'DIABETIC' ? 160 : 220,
        fatGrams: 55,
        notes: `${seed.dietType} plan customized by dietician.`,
        approvedById: users.dietician.id
      }
    });
    await prisma.patient.update({ where: { id: patient.id }, data: { currentDietPlanId: plan.id } });
    patients[seed.key] = patient;
    plans[seed.key] = plan;
  }

  await prisma.dietPrescription.create({
    data: {
      patientId: patients.priya.id,
      doctorId: users.doctor.id,
      dieticianId: users.dietician.id,
      dietPlanId: plans.priya.id,
      dietType: 'DIABETIC',
      restrictions: jsonArray(['VEGETARIAN']),
      allergies: jsonArray(['Peanut']),
      instructions: 'Avoid sugar and refined flour. Monitor post-meal glucose.',
      status: 'APPROVED',
      approvedAt: new Date()
    }
  });
  await prisma.dietPrescription.create({
    data: {
      patientId: patients.neha.id,
      doctorId: users.doctor.id,
      dietType: 'LOW_SODIUM',
      restrictions: jsonArray(['JAIN']),
      allergies: jsonArray([]),
      instructions: 'Switch to low sodium dinner for two days due to blood pressure.',
      status: 'PENDING'
    }
  });

  const today = startOfDay(new Date());
  const allPatients = await prisma.patient.findMany({ include: { currentDietPlan: true } });
  const createdOrders = [];
  for (const patient of allPatients) {
    for (const schedule of schedules) {
      const dietType = patient.currentDietPlan?.dietType || 'NORMAL';
      const cost = Math.round((DIET_COST[dietType] || DIET_COST.NORMAL) * (MEAL_COST_FACTOR[schedule.mealType] || 0.25));
      const status = schedule.mealType === 'BREAKFAST' ? 'DELIVERED' : schedule.mealType === 'LUNCH' ? 'PACKED' : 'SCHEDULED';
      const timestamps = {};
      if (status === 'DELIVERED') {
        timestamps.preparedAt = combineDateAndTime(today, '06:30');
        timestamps.packedAt = combineDateAndTime(today, '07:15');
        timestamps.dispatchedAt = combineDateAndTime(today, '07:35');
        timestamps.deliveredAt = combineDateAndTime(today, '07:55');
        timestamps.deliveredById = users.delivery.id;
      }
      if (status === 'PACKED') {
        timestamps.preparedAt = combineDateAndTime(today, '11:00');
        timestamps.packedAt = combineDateAndTime(today, '12:00');
      }
      const order = await prisma.mealOrder.create({
        data: {
          patientId: patient.id,
          dietPlanId: patient.currentDietPlanId,
          mealType: schedule.mealType,
          serviceDate: today,
          ward: patient.ward,
          roomNumber: patient.roomNumber,
          bedNumber: patient.bedNumber,
          status,
          plannedFor: combineDateAndTime(today, schedule.serveTime),
          specialInstructions: `${patient.currentDietPlan?.restrictions || '[]'} ${patient.currentDietPlan?.allergies || '[]'}` === '[] []' ? null : `Restrictions/allergies: ${patient.currentDietPlan?.restrictions} ${patient.currentDietPlan?.allergies}`,
          cost,
          ...timestamps
        }
      });
      createdOrders.push(order);
      await prisma.mealStatusHistory.create({ data: { mealOrderId: order.id, status, changedById: users.admin.id, note: 'Seed status' } });
      if (status === 'DELIVERED') {
        await prisma.billingCharge.create({
          data: {
            patientId: patient.id,
            mealOrderId: order.id,
            description: `${schedule.displayName} - ${dietType} diet`,
            amount: cost,
            status: 'POSTED',
            chargeDate: today
          }
        });
      }
    }
  }

  const inventory = {};
  for (const item of [
    { key: 'rice', name: 'Rice', unit: 'kg', currentStock: 120, lowStockThreshold: 40, costPerUnit: 55, expiryDate: addDays(new Date(), 180), batchNumber: 'R-2026-01' },
    { key: 'vegetables', name: 'Vegetables', unit: 'kg', currentStock: 32, lowStockThreshold: 25, costPerUnit: 45, expiryDate: addDays(new Date(), 3), batchNumber: 'V-DAILY' },
    { key: 'milk', name: 'Milk', unit: 'litre', currentStock: 18, lowStockThreshold: 20, costPerUnit: 62, expiryDate: addDays(new Date(), 2), batchNumber: 'M-0626' },
    { key: 'fruits', name: 'Fruits', unit: 'kg', currentStock: 24, lowStockThreshold: 15, costPerUnit: 90, expiryDate: addDays(new Date(), 5), batchNumber: 'F-DAILY' },
    { key: 'spices', name: 'Spices', unit: 'kg', currentStock: 8, lowStockThreshold: 5, costPerUnit: 300, expiryDate: addDays(new Date(), 365), batchNumber: 'S-2026' }
  ]) {
    const { key, ...itemData } = item;
    inventory[key] = await prisma.inventoryItem.create({ data: itemData });
  }

  await prisma.inventoryTxn.createMany({
    data: [
      { itemId: inventory.rice.id, type: 'PURCHASE', quantity: 120, reason: 'Opening stock', createdById: users.kitchen.id },
      { itemId: inventory.vegetables.id, type: 'PURCHASE', quantity: 50, reason: 'Morning purchase', createdById: users.kitchen.id },
      { itemId: inventory.vegetables.id, type: 'CONSUMPTION', quantity: 18, reason: 'Breakfast prep', createdById: users.kitchen.id },
      { itemId: inventory.milk.id, type: 'PURCHASE', quantity: 30, reason: 'Opening stock', createdById: users.kitchen.id },
      { itemId: inventory.milk.id, type: 'CONSUMPTION', quantity: 12, reason: 'Breakfast/liquid diet', createdById: users.kitchen.id },
      { itemId: inventory.fruits.id, type: 'PURCHASE', quantity: 24, reason: 'Opening stock', createdById: users.kitchen.id },
      { itemId: inventory.spices.id, type: 'PURCHASE', quantity: 8, reason: 'Opening stock', createdById: users.kitchen.id }
    ]
  });

  await prisma.foodWastage.create({
    data: { itemId: inventory.vegetables.id, mealType: 'BREAKFAST', quantity: 1.5, unit: 'kg', reason: 'Trim waste', costEstimate: 67.5, createdById: users.kitchen.id }
  });

  await prisma.notification.createMany({
    data: [
      { roleTarget: 'KITCHEN_STAFF', title: 'Diet update pending kitchen acknowledgement', message: 'New and customized diet plans are available for today.', type: 'DIET_CHANGED', metadata: jsonObject({}) },
      { roleTarget: 'DELIVERY_STAFF', title: 'Lunch meals packed', message: 'Lunch meals are packed and ready to dispatch ward-wise.', type: 'PENDING_DELIVERY', metadata: jsonObject({}) },
      { roleTarget: 'ADMIN', title: 'Low stock: Milk', message: 'Milk is below threshold. Please reorder.', type: 'LOW_STOCK', metadata: jsonObject({ itemId: inventory.milk.id }) },
      { userId: users.patientUser.id, title: 'Breakfast delivered', message: 'Your breakfast has been delivered. Please share feedback.', type: 'GENERAL', metadata: jsonObject({}) }
    ]
  });

  const priyaBreakfast = createdOrders.find((order) => order.patientId === patients.priya.id && order.mealType === 'BREAKFAST');
  await prisma.feedback.create({
    data: { patientId: patients.priya.id, mealOrderId: priyaBreakfast.id, taste: 5, quality: 4, quantity: 5, timing: 5, comments: 'Good taste and delivered on time.' }
  });

  console.log('HFMS seed complete. Demo credentials:');
  console.table([
    ['Admin', 'admin@hfms.test', 'Admin@1234'],
    ['Doctor', 'doctor@hfms.test', 'Admin@1234'],
    ['Dietician', 'dietician@hfms.test', 'Admin@1234'],
    ['Kitchen Staff', 'kitchen@hfms.test', 'Admin@1234'],
    ['Delivery Staff', 'delivery@hfms.test', 'Admin@1234'],
    ['Patient', 'patient@hfms.test', 'Admin@1234']
  ]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
