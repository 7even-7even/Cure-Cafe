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
  await prisma.foodOrderStatusHistory.deleteMany();
  await prisma.foodOrderItem.deleteMany();
  await prisma.foodOrder.deleteMany();
  await prisma.menuItem.deleteMany();
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
  const shouldReset = process.argv.includes('--reset') || process.env.SEED_RESET === 'true';
  if (shouldReset) {
    await reset();
  } else {
    const existingAdmin = await prisma.user.findUnique({ where: { email: 'devloper7even@gmail.com' } });
    if (existingAdmin) {
      console.log('Cure Cafe seed skipped: demo data already exists. Use `npm run db:reset -w apps/api` to reset it.');
      return;
    }

    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      console.log('Cure Cafe seed found existing users with a different seed set. Use `npm run db:reset -w apps/api` to recreate demo data with the latest admin credentials.');
      return;
    }
  }

  const adminPasswordHash = await bcrypt.hash('Password7', 12);
  const demoPasswordHash = await bcrypt.hash('Admin@1234', 12);
  const users = {};
  for (const user of [
    { key: 'admin', name: 'Admin', email: 'devloper7even@gmail.com', role: 'ADMIN', phone: '+919000000001', passwordHash: adminPasswordHash },
    { key: 'doctor', name: 'Dr. Meera Rao', email: 'doctor@curecafe.test', role: 'DOCTOR', phone: '+919000000002', passwordHash: demoPasswordHash },
    { key: 'dietician', name: 'Anika Dietician', email: 'dietician@curecafe.test', role: 'DIETICIAN', phone: '+919000000003', passwordHash: demoPasswordHash },
    { key: 'kitchen', name: 'Kabir Kitchen', email: 'kitchen@curecafe.test', role: 'KITCHEN_STAFF', phone: '+919000000004', passwordHash: demoPasswordHash },
    { key: 'delivery', name: 'Rohan Delivery', email: 'delivery@curecafe.test', role: 'DELIVERY_STAFF', phone: '+919000000005', passwordHash: demoPasswordHash },
    { key: 'patientUser', name: 'Priya Patient', email: 'patient@curecafe.test', role: 'PATIENT', phone: '+919000000006', passwordHash: demoPasswordHash }
  ]) {
    users[user.key] = await prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        passwordHash: user.passwordHash,
        emailVerifiedAt: new Date(),
        isActive: true
      }
    });
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
        notes: 'Seed patient for Cure Cafe demo.'
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

  const menuItems = {};
  for (const item of [
    {
      key: 'normalSet', name: 'Normal Recovery Set', itemType: 'NORMAL_SET', category: 'Sets', price: 140,
      description: 'Balanced hospital meal with rice, dal, seasonal vegetables, curd and fruit.', calories: 620, carbsGrams: 82, proteinGrams: 24, fatGrams: 14, vitaminsGrams: 9, fiberGrams: 12, sodiumMg: 420,
      ingredients: ['Rice', 'Dal', 'Vegetables', 'Curd', 'Fruit'], allergens: ['Milk'], restrictions: ['VEGETARIAN'], customizableOptions: ['Less oil', 'No curd', 'Extra dal']
    },
    {
      key: 'jumboSet', name: 'Jumbo Protein Set', itemType: 'JUMBO_SET', category: 'Sets', price: 220,
      description: 'High protein meal set with paneer or eggs, rice, dal, vegetables and fruit bowl.', calories: 860, carbsGrams: 94, proteinGrams: 46, fatGrams: 26, vitaminsGrams: 12, fiberGrams: 15, sodiumMg: 520,
      ingredients: ['Rice', 'Paneer/Eggs', 'Dal', 'Vegetables', 'Fruits'], allergens: ['Milk', 'Egg'], restrictions: [], customizableOptions: ['Paneer option', 'Egg option', 'Extra protein']
    },
    {
      key: 'riceBowl', name: 'Steamed Rice Bowl', itemType: 'INDIVIDUAL_ITEM', category: 'Individual Items', price: 55,
      description: 'Soft steamed rice portion suitable for normal and low-spice diets.', calories: 240, carbsGrams: 52, proteinGrams: 4, fatGrams: 1, vitaminsGrams: 1, fiberGrams: 2, sodiumMg: 8,
      ingredients: ['Rice'], allergens: [], restrictions: ['VEGETARIAN', 'JAIN'], customizableOptions: ['Small portion', 'Large portion']
    },
    {
      key: 'fruitCup', name: 'Fresh Fruit Cup', itemType: 'INDIVIDUAL_ITEM', category: 'Individual Items', price: 75,
      description: 'Seasonal fruit cup rich in vitamins and hydration.', calories: 160, carbsGrams: 34, proteinGrams: 2, fatGrams: 1, vitaminsGrams: 18, fiberGrams: 6, sodiumMg: 5,
      ingredients: ['Seasonal fruits'], allergens: [], restrictions: ['VEGETARIAN', 'JAIN', 'GLUTEN_FREE'], customizableOptions: ['No banana', 'Diabetic portion']
    },
    {
      key: 'customBowl', name: 'Build Your Own Recovery Bowl', itemType: 'CUSTOMIZABLE', category: 'Customizable', price: 180,
      description: 'Custom bowl with selectable base, protein, vegetables and add-ons.', calories: 700, carbsGrams: 76, proteinGrams: 32, fatGrams: 18, vitaminsGrams: 14, fiberGrams: 13, sodiumMg: 390,
      ingredients: ['Base', 'Protein', 'Vegetables', 'Add-ons'], allergens: [], restrictions: ['VEGETARIAN'], customizableOptions: ['Rice base', 'Millet base', 'Paneer protein', 'Egg protein', 'No spice', 'Jain preparation']
    }
  ]) {
    const { key, ingredients, allergens, restrictions, customizableOptions, ...itemData } = item;
    menuItems[key] = await prisma.menuItem.create({
      data: {
        ...itemData,
        ingredients: jsonArray(ingredients),
        allergens: jsonArray(allergens),
        restrictions: jsonArray(restrictions),
        customizableOptions: jsonArray(customizableOptions),
        createdById: users.kitchen.id
      }
    });
  }

  const demoFoodOrder = await prisma.foodOrder.create({
    data: {
      orderNumber: `CC-${today.toISOString().slice(0, 10).replace(/-/g, '')}-DEMO01`,
      patientId: patients.priya.id,
      orderedById: users.patientUser.id,
      status: 'PLACED',
      ward: patients.priya.ward,
      roomNumber: patients.priya.roomNumber,
      bedNumber: patients.priya.bedNumber,
      totalAmount: menuItems.fruitCup.price + menuItems.riceBowl.price,
      specialInstructions: 'Please keep fruit chilled and rice warm.',
      items: {
        create: [
          { menuItemId: menuItems.fruitCup.id, nameSnapshot: menuItems.fruitCup.name, itemTypeSnapshot: menuItems.fruitCup.itemType, priceSnapshot: menuItems.fruitCup.price, quantity: 1, lineTotal: menuItems.fruitCup.price, calories: menuItems.fruitCup.calories, carbsGrams: menuItems.fruitCup.carbsGrams, proteinGrams: menuItems.fruitCup.proteinGrams, fatGrams: menuItems.fruitCup.fatGrams, vitaminsGrams: menuItems.fruitCup.vitaminsGrams, customizationNotes: 'Diabetic portion' },
          { menuItemId: menuItems.riceBowl.id, nameSnapshot: menuItems.riceBowl.name, itemTypeSnapshot: menuItems.riceBowl.itemType, priceSnapshot: menuItems.riceBowl.price, quantity: 1, lineTotal: menuItems.riceBowl.price, calories: menuItems.riceBowl.calories, carbsGrams: menuItems.riceBowl.carbsGrams, proteinGrams: menuItems.riceBowl.proteinGrams, fatGrams: menuItems.riceBowl.fatGrams, vitaminsGrams: menuItems.riceBowl.vitaminsGrams, customizationNotes: 'Small portion' }
        ]
      }
    }
  });
  await prisma.foodOrderStatusHistory.create({ data: { foodOrderId: demoFoodOrder.id, status: 'PLACED', changedById: users.patientUser.id, note: 'Seed Cure Cafe menu order' } });
  await prisma.billingCharge.create({ data: { patientId: patients.priya.id, foodOrderId: demoFoodOrder.id, description: `Cure Cafe order ${demoFoodOrder.orderNumber}`, amount: demoFoodOrder.totalAmount, status: 'PENDING', chargeDate: today } });

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

  console.log('Cure Cafe seed complete. Demo credentials:');
  console.table([
    ['Admin', 'devloper7even@gmail.com', 'Password7'],
    ['Doctor', 'doctor@curecafe.test', 'Admin@1234'],
    ['Dietician', 'dietician@curecafe.test', 'Admin@1234'],
    ['Kitchen Staff', 'kitchen@curecafe.test', 'Admin@1234'],
    ['Delivery Staff', 'delivery@curecafe.test', 'Admin@1234'],
    ['Patient', 'patient@curecafe.test', 'Admin@1234']
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
