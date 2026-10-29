const { Router } = require('express');
const { body, param, query } = require('express-validator');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const TeamMember = require('../models/TeamMember');
const Activity = require('../models/Activity');
const { validateRequest } = require('../middleware/errors');
const asyncHandler = require('../utils/asyncHandler');
const { requireRecord, pagination, pageResult } = require('../utils/records');
const HttpError = require('../utils/httpError');

const router = Router();
const fields = [
  body('patient').isMongoId().withMessage('Select a valid patient.'),
  body('teamMember').optional({ values: 'falsy' }).isMongoId().withMessage('Select a valid team member.'),
  body('scheduledAt').isISO8601({ strict: true }).withMessage('Enter a valid appointment date and time.'),
  body('type').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Appointment type is required.'),
  body('status').optional().isIn(['Scheduled', 'Checked in', 'Completed', 'Cancelled']),
  body('notes').optional().isString().trim().isLength({ max: 1000 })
];
const activeStatuses = ['Scheduled', 'Checked in'];

async function assertNoConflict(input, ignoreId) {
  const filter = {
    scheduledAt: new Date(input.scheduledAt),
    status: { $in: activeStatuses },
    $or: [{ patient: input.patient }]
  };
  if (input.teamMember) filter.$or.push({ teamMember: input.teamMember });
  if (ignoreId) filter._id = { $ne: ignoreId };
  if (input.status && !activeStatuses.includes(input.status)) return;
  const conflict = await Appointment.findOne(filter);
  if (conflict) throw new HttpError(409, 'APPOINTMENT_CONFLICT', 'The patient or assigned professional already has an appointment at that time.');
}

router.get('/appointments', [
  query('patient').optional().isMongoId(),
  query('status').optional().isIn(['Scheduled', 'Checked in', 'Completed', 'Cancelled']),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest
], asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.patient) filter.patient = req.query.patient;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.from || req.query.to) {
    filter.scheduledAt = {};
    if (req.query.from) filter.scheduledAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.scheduledAt.$lte = new Date(req.query.to);
  }
  const { page, limit, skip } = pagination(req.query);
  const [data, total] = await Promise.all([
    Appointment.find(filter).populate('patient', 'firstName lastName patientNumber').populate('teamMember', 'name specialty').sort({ scheduledAt: 1 }).skip(skip).limit(limit),
    Appointment.countDocuments(filter)
  ]);
  res.json(pageResult(data, total, page, limit));
}));

router.post('/appointments', [...fields, validateRequest], asyncHandler(async (req, res) => {
  await requireRecord(Patient, req.body.patient, 'Patient');
  if (req.body.teamMember) await requireRecord(TeamMember, req.body.teamMember, 'Team member');
  await assertNoConflict(req.body);
  const data = await Appointment.create(req.body);
  await Activity.create({ action: 'Appointment scheduled', detail: req.body.type, type: 'appointment' });
  res.status(201).json({ data: await data.populate(['patient', 'teamMember']) });
}));

router.get('/appointments/:id', [param('id').isMongoId(), validateRequest], asyncHandler(async (req, res) => {
  const data = await Appointment.findById(req.params.id).populate('patient').populate('teamMember');
  if (!data) throw new HttpError(404, 'NOT_FOUND', 'Appointment was not found.');
  res.json({ data });
}));

router.patch('/appointments/:id', [
  param('id').isMongoId(),
  body('patient').optional().isMongoId(),
  body('teamMember').optional({ values: 'falsy' }).isMongoId(),
  body('scheduledAt').optional().isISO8601({ strict: true }),
  body('type').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('status').optional().isIn(['Scheduled', 'Checked in', 'Completed', 'Cancelled']),
  body('notes').optional().isString().trim().isLength({ max: 1000 }),
  validateRequest
], asyncHandler(async (req, res) => {
  const current = await requireRecord(Appointment, req.params.id, 'Appointment');
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => ['patient', 'teamMember', 'scheduledAt', 'type', 'status', 'notes'].includes(key)));
  if (!Object.keys(changes).length) throw new HttpError(400, 'EMPTY_UPDATE', 'Provide at least one appointment field.');
  const candidate = { ...current.toObject(), ...changes, patient: changes.patient || current.patient, teamMember: Object.hasOwn(changes, 'teamMember') ? changes.teamMember : current.teamMember };
  if (changes.patient) await requireRecord(Patient, changes.patient, 'Patient');
  if (candidate.teamMember) await requireRecord(TeamMember, candidate.teamMember, 'Team member');
  await assertNoConflict(candidate, current._id);
  Object.assign(current, changes);
  await current.save();
  if (changes.status === 'Cancelled') {
    await Activity.create({ action: 'Appointment cancelled', detail: current.type, type: 'appointment' });
  } else {
    await Activity.create({ action: 'Appointment updated', detail: current.type, type: 'appointment' });
  }
  res.json({ data: await current.populate(['patient', 'teamMember']) });
}));

router.delete('/appointments/:id', [param('id').isMongoId(), validateRequest], asyncHandler(async (req, res) => {
  const data = await Appointment.findByIdAndDelete(req.params.id);
  if (!data) throw new HttpError(404, 'NOT_FOUND', 'Appointment was not found.');
  await Activity.create({ action: 'Appointment removed', detail: data.type, type: 'appointment' });
  res.status(204).end();
}));

module.exports = router;
