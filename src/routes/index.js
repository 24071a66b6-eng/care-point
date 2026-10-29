const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const authRoutes = require('./authRoutes');
const patientRoutes = require('./patientRoutes');
const diagnosisRoutes = require('./diagnosisRoutes');
const labRoutes = require('./labRoutes');
const teamRoutes = require('./teamRoutes');
const appointmentRoutes = require('./appointmentRoutes');
const messageRoutes = require('./messageRoutes');
const notificationRoutes = require('./notificationRoutes');
const dashboardRoutes = require('./dashboardRoutes');

const router = Router();
const knownRoutePaths = [
  '/patients', '/diagnoses', '/labs', '/teams', '/appointments',
  '/messages', '/notifications', '/dashboard'
];

router.get('/health', asyncHandler(async (req, res) => {
  const mongoose = require('mongoose');
  const healthy = mongoose.connection.readyState === 1;
  res.status(healthy ? 200 : 503).json({
    data: { status: healthy ? 'ok' : 'unavailable', database: healthy ? 'connected' : 'disconnected' }
  });
}));
router.use('/auth', authRoutes);
router.use((req, res, next) => {
  if (!knownRoutePaths.some((path) => req.path === path || req.path.startsWith(`${path}/`))) return next();
  requireAuth(req, res, next);
});
router.use('/patients', patientRoutes);
router.use(diagnosisRoutes);
router.use(labRoutes);
router.use(teamRoutes);
router.use(appointmentRoutes);
router.use(messageRoutes);
router.use(notificationRoutes);
router.use(dashboardRoutes);
router.use((req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.path}`);
  error.status = 404;
  error.code = 'NOT_FOUND';
  next(error);
});

module.exports = router;
