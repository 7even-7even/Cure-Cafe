const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { env } = require('./config/env');
const { uploadRoot } = require('./modules/files/upload');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/users/users.routes');
const patientRoutes = require('./modules/patients/patients.routes');
const dietRoutes = require('./modules/diets/diets.routes');
const mealRoutes = require('./modules/meals/meals.routes');
const inventoryRoutes = require('./modules/inventory/inventory.routes');
const billingRoutes = require('./modules/billing/billing.routes');
const reportRoutes = require('./modules/reports/reports.routes');
const notificationRoutes = require('./modules/notifications/notifications.routes');
const feedbackRoutes = require('./modules/feedback/feedback.routes');

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((v) => v.trim()), credentials: true }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }));
app.use('/uploads', express.static(uploadRoot));

app.get('/health', (_req, res) => {
  res.json({ success: true, service: 'HFMS API', status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/diets', dietRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/feedback', feedbackRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = { app };
