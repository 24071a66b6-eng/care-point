const { Router } = require('express');
const { body, param, query } = require('express-validator');
const Message = require('../models/Message');
const Patient = require('../models/Patient');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const { validateRequest } = require('../middleware/errors');
const asyncHandler = require('../utils/asyncHandler');
const { requireRecord, pagination, pageResult } = require('../utils/records');
const HttpError = require('../utils/httpError');

const router = Router();

router.get('/patients/:patientId/messages', [
  param('patientId').isMongoId(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest
], asyncHandler(async (req, res) => {
  const patient = await requireRecord(Patient, req.params.patientId, 'Patient');
  const { page, limit, skip } = pagination(req.query);
  const [data, total] = await Promise.all([
    Message.find({ patient: patient._id }).sort({ createdAt: 1 }).skip(skip).limit(limit),
    Message.countDocuments({ patient: patient._id })
  ]);
  res.json(pageResult(data, total, page, limit));
}));

router.post('/patients/:patientId/messages', [
  body('text').isString().trim().isLength({ min: 1, max: 2000 }).withMessage('Message must be between 1 and 2,000 characters.'),
  validateRequest
], asyncHandler(async (req, res) => {
  const patient = await requireRecord(Patient, req.params.patientId, 'Patient');
  const data = await Message.create({
    patient: patient._id,
    senderName: req.user.name,
    senderRole: 'staff',
    text: req.body.text
  });
  await Promise.all([
    Activity.create({ action: 'Patient message sent', detail: `${patient.firstName} ${patient.lastName}`, type: 'message' }),
    Notification.create({ title: 'Message sent', message: `A message was added to ${patient.firstName} ${patient.lastName}’s demo thread.`, type: 'message' })
  ]);
  res.status(201).json({ data });
}));

router.get('/messages/:id', [param('id').isMongoId(), validateRequest], asyncHandler(async (req, res) => {
  const data = await Message.findById(req.params.id).populate('patient', 'firstName lastName patientNumber');
  if (!data) throw new HttpError(404, 'NOT_FOUND', 'Message was not found.');
  res.json({ data });
}));

module.exports = router;
