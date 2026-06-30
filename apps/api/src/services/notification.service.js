const { prisma } = require('../config/prisma');
const { jsonObject } = require('../utils/json');
const { NOTIFICATION_CHANNELS } = require('../constants');

async function createNotification({ userId = null, roleTarget = null, title, message, type = 'GENERAL', channel = 'IN_APP', metadata = {} }) {
  if (!NOTIFICATION_CHANNELS.includes(channel)) {
    channel = 'IN_APP';
  }

  // MVP adapters. Production would plug SES/Twilio/Kafka here.
  if (channel === 'EMAIL') console.info(`[email notification] ${title}: ${message}`);
  if (channel === 'SMS') console.info(`[sms notification] ${title}: ${message}`);

  return prisma.notification.create({
    data: {
      userId,
      roleTarget,
      title,
      message,
      type,
      channel,
      metadata: jsonObject(metadata)
    }
  });
}

async function notifyRole(roleTarget, payload) {
  return createNotification({ ...payload, roleTarget });
}

async function notifyUser(userId, payload) {
  return createNotification({ ...payload, userId });
}

async function notifyLowStock(item) {
  return notifyRole('ADMIN', {
    title: `Low stock: ${item.name}`,
    message: `${item.name} has ${item.currentStock} ${item.unit} left. Threshold is ${item.lowStockThreshold} ${item.unit}.`,
    type: 'LOW_STOCK',
    metadata: { itemId: item.id }
  });
}

module.exports = { createNotification, notifyRole, notifyUser, notifyLowStock };
