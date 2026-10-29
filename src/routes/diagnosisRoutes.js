const { Router } = require('express');
const { body, param, query } = require('express-validator');
const Diagnosis = require('../models/Diagnosis');
const Patient = require('../models/Patient');
const { validateRequest } = require('../middleware/errors');
const asyncHandler = require('../utils/asyncHandler');
const { requireRecord, pagination, pageResult } = require('../utils/records');
const HttpError = require('../utils/httpError');

const router = Router();
const fields = [
  body('name').isString().trim().isLength({ min: 1, max: 140 }).withMessage('Diagnosis name is required.'),
  body('description').optional().isString().trim().isLength({ max: 1000 }),
  body('status').optional().isIn(['Active', 'Monitoring', 'Resolved']),
  body('recordedAt').isISO8601().withMessage('Recorded date must be valid.')
];

router.get('/patients/:patientId/diagnoses', [
  param('patientId').isMongoId(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest
], asyncHandler(async (req, res) => {
  const patient = await requireRecord(Patient, req.params.patientId, 'Patient');
  const { page, limit, skip } = pagination(req.query);
  const [data, total] = await Promise.all([
    Diagnosis.find({ patient: patient._id }).sort({ recordedAt: -1 }).skip(skip).limit(limit),
    Diagnosis.countDocuments({ patient: patient._id })
  ]);
  res.json(pageResult(data, total, page, limit));
}));

router.post('/patients/:patientId/diagnoses', [...fields, validateRequest], asyncHandler(async (req, res) => {
  const patient = await requireRecord(Patient, req.params.patientId, 'Patient');
  const data = await Diagnosis.create({ ...req.body, patient: patient._id });
  res.status(201).json({ data });
}));

router.patch('/diagnoses/:id', [
  param('id').isMongoId(),
  body('name').optional().isString().trim().isLength({ min: 1, max: 140 }),
  body('description').optional().isString().trim().isLength({ max: 1000 }),
  body('status').optional().isIn(['Active', 'Monitoring', 'Resolved']),
  body('recordedAt').optional().isISO8601(),
  validateRequest
], asyncHandler(async (req, res) => {
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => ['name', 'description', 'status', 'recordedAt'].includes(key)));
  if (!Object.keys(changes).length) throw new HttpError(400, 'EMPTY_UPDATE', 'Provide at least one diagnosis field.');
  const data = await Diagnosis.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true });
  if (!data) throw new HttpError(404, 'NOT_FOUND', 'Diagnosis was not found.');
  res.json({ data });
}));

router.delete('/diagnoses/:id', [param('id').isMongoId(), validateRequest], asyncHandler(async (req, res) => {
  const data = await Diagnosis.findByIdAndDelete(req.params.id);
  if (!data) throw new HttpError(404, 'NOT_FOUND', 'Diagnosis was not found.');
  res.status(204).end();
}));

module.exports = router;
