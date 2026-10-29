const { Router } = require('express');
const { body, param, query } = require('express-validator');
const LabResult = require('../models/LabResult');
const Patient = require('../models/Patient');
const { validateRequest } = require('../middleware/errors');
const asyncHandler = require('../utils/asyncHandler');
const { requireRecord, pagination, pageResult } = require('../utils/records');
const HttpError = require('../utils/httpError');

const router = Router();
const fields = [
  body('testName').isString().trim().isLength({ min: 1, max: 140 }).withMessage('Test name is required.'),
  body('resultValue').isString().trim().isLength({ min: 1, max: 80 }).withMessage('Result value is required.'),
  body('unit').optional().isString().trim().isLength({ max: 40 }),
  body('referenceRange').optional().isString().trim().isLength({ max: 80 }),
  body('status').optional().isIn(['In range', 'Review', 'Pending']),
  body('recordedAt').isISO8601().withMessage('Recorded date must be valid.')
];

router.get('/patients/:patientId/labs', [
  param('patientId').isMongoId(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest
], asyncHandler(async (req, res) => {
  const patient = await requireRecord(Patient, req.params.patientId, 'Patient');
  const { page, limit, skip } = pagination(req.query);
  const [data, total] = await Promise.all([
    LabResult.find({ patient: patient._id }).sort({ recordedAt: -1 }).skip(skip).limit(limit),
    LabResult.countDocuments({ patient: patient._id })
  ]);
  res.json(pageResult(data, total, page, limit));
}));

router.post('/patients/:patientId/labs', [...fields, validateRequest], asyncHandler(async (req, res) => {
  const patient = await requireRecord(Patient, req.params.patientId, 'Patient');
  const data = await LabResult.create({ ...req.body, patient: patient._id });
  res.status(201).json({ data });
}));

router.patch('/labs/:id', [
  param('id').isMongoId(),
  body('testName').optional().isString().trim().isLength({ min: 1, max: 140 }),
  body('resultValue').optional().isString().trim().isLength({ min: 1, max: 80 }),
  body('unit').optional().isString().trim().isLength({ max: 40 }),
  body('referenceRange').optional().isString().trim().isLength({ max: 80 }),
  body('status').optional().isIn(['In range', 'Review', 'Pending']),
  body('recordedAt').optional().isISO8601(),
  validateRequest
], asyncHandler(async (req, res) => {
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => ['testName', 'resultValue', 'unit', 'referenceRange', 'status', 'recordedAt'].includes(key)));
  if (!Object.keys(changes).length) throw new HttpError(400, 'EMPTY_UPDATE', 'Provide at least one laboratory field.');
  const data = await LabResult.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true });
  if (!data) throw new HttpError(404, 'NOT_FOUND', 'Laboratory result was not found.');
  res.json({ data });
}));

router.delete('/labs/:id', [param('id').isMongoId(), validateRequest], asyncHandler(async (req, res) => {
  const data = await LabResult.findByIdAndDelete(req.params.id);
  if (!data) throw new HttpError(404, 'NOT_FOUND', 'Laboratory result was not found.');
  res.status(204).end();
}));

module.exports = router;
