const { Router } = require('express');
const { body, param, query } = require('express-validator');
const TeamMember = require('../models/TeamMember');
const Appointment = require('../models/Appointment');
const { validateRequest } = require('../middleware/errors');
const { requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { requireRecord, pagination, pageResult } = require('../utils/records');
const HttpError = require('../utils/httpError');

const router = Router();
const fields = [
  body('name').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Name is required.'),
  body('specialty').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Specialty is required.'),
  body('email').isEmail().normalizeEmail().withMessage('Enter a valid email.'),
  body('phone').optional().isString().trim().isLength({ max: 30 }),
  body('status').optional().isIn(['Available', 'In clinic', 'Away'])
];

router.get('/teams', [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 }), validateRequest], asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const [data, total] = await Promise.all([
    TeamMember.find().sort({ name: 1 }).skip(skip).limit(limit),
    TeamMember.countDocuments()
  ]);
  res.json(pageResult(data, total, page, limit));
}));

router.post('/teams', requireRole('admin', 'demo'), [...fields, validateRequest], asyncHandler(async (req, res) => {
  const data = await TeamMember.create(req.body);
  res.status(201).json({ data });
}));

router.get('/teams/:id', [param('id').isMongoId(), validateRequest], asyncHandler(async (req, res) => {
  res.json({ data: await requireRecord(TeamMember, req.params.id, 'Team member') });
}));

router.patch('/teams/:id', [
  requireRole('admin', 'demo'),
  param('id').isMongoId(),
  body('name').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('specialty').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isString().trim().isLength({ max: 30 }),
  body('status').optional().isIn(['Available', 'In clinic', 'Away']),
  validateRequest
], asyncHandler(async (req, res) => {
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => ['name', 'specialty', 'email', 'phone', 'status'].includes(key)));
  if (!Object.keys(changes).length) throw new HttpError(400, 'EMPTY_UPDATE', 'Provide at least one team member field.');
  const data = await TeamMember.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true });
  if (!data) throw new HttpError(404, 'NOT_FOUND', 'Team member was not found.');
  res.json({ data });
}));

router.delete('/teams/:id', requireRole('admin', 'demo'), [param('id').isMongoId(), validateRequest], asyncHandler(async (req, res) => {
  const member = await requireRecord(TeamMember, req.params.id, 'Team member');
  const assignments = await Appointment.countDocuments({ teamMember: member._id, status: { $in: ['Scheduled', 'Checked in'] } });
  if (assignments) throw new HttpError(409, 'TEAM_MEMBER_ASSIGNED', 'Reassign or cancel this member’s scheduled appointments first.');
  await member.deleteOne();
  res.status(204).end();
}));

module.exports = router;
