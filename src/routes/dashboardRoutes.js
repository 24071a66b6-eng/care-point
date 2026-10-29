const { Router } = require('express');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const TeamMember = require('../models/TeamMember');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

router.get('/dashboard/summary', asyncHandler(async (req, res) => {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const [patients, todayAppointments, upcomingAppointments, teamMembers, unreadNotifications, nextAppointments] = await Promise.all([
    Patient.countDocuments(),
    Appointment.countDocuments({ scheduledAt: { $gte: dayStart, $lt: dayEnd }, status: { $ne: 'Cancelled' } }),
    Appointment.countDocuments({ scheduledAt: { $gte: now }, status: { $in: ['Scheduled', 'Checked in'] } }),
    TeamMember.countDocuments(),
    Notification.countDocuments({ read: false }),
    Appointment.find({ scheduledAt: { $gte: now }, status: { $in: ['Scheduled', 'Checked in'] } })
      .populate('patient', 'firstName lastName')
      .populate('teamMember', 'name')
      .sort({ scheduledAt: 1 })
      .limit(5)
  ]);
  res.json({ data: {
    patients, todayAppointments, upcomingAppointments, teamMembers, unreadNotifications,
    nextAppointments, generatedAt: now
  } });
}));

router.get('/dashboard/activity', asyncHandler(async (req, res) => {
  const data = await Activity.find().sort({ createdAt: -1 }).limit(12);
  res.json({ data });
}));

module.exports = router;
