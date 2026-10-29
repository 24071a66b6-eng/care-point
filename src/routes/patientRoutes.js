const { Router } = require('express');
const { body, param, query } = require('express-validator');
const Patient = require('../models/Patient');
const Diagnosis = require('../models/Diagnosis');
const LabResult = require('../models/LabResult');
const Appointment = require('../models/Appointment');
const Message = require('../models/Message');
const { validateRequest } = require('../middleware/errors');
const { requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { assertId, requireRecord, pagination, pageResult } = require('../utils/records');
const HttpError = require('../utils/httpError');

const router = Router();
const patientFields = [
  body('firstName').isString().trim().isLength({ min: 1, max: 60 }).withMessage('First name is required and must be 60 characters or fewer.'),
  body('lastName').isString().trim().isLength({ min: 1, max: 60 }).withMessage('Last name is required and must be 60 characters or fewer.'),
  body('patientNumber').isString().trim().isLength({ min: 2, max: 30 }).withMessage('Patient number is required.'),
  body('dateOfBirth').isISO8601().withMessage('Date of birth must be a valid date.').custom((value) => new Date(value) <= new Date()).withMessage('Date of birth cannot be in the future.'),
  body('gender').optional().isIn(['Female', 'Male', 'Non-binary', 'Unspecified']),
  body('email').optional({ values: 'falsy' }).isEmail().normalizeEmail(),
  body('phone').optional().isString().trim().isLength({ max: 30 }),
  body('address').optional().isString().trim().isLength({ max: 240 }),
  body('insurance').optional().isObject()
];

router.get('/', [
  query('q').optional().isString().trim().isLength({ max: 100 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest
], asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const searchText = req.query.q ? req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
  const search = searchText ? {
    $or: [
      { firstName: { $regex: searchText, $options: 'i' } },
      { lastName: { $regex: searchText, $options: 'i' } },
      { patientNumber: { $regex: searchText, $options: 'i' } }
    ]
  } : {};
  const [items, total] = await Promise.all([
    Patient.find(search).sort({ lastName: 1, firstName: 1 }).skip(skip).limit(limit),
    Patient.countDocuments(search)
  ]);
  res.json(pageResult(items, total, page, limit));
}));

router.post('/', requireRole('admin', 'clinician', 'demo'), [...patientFields, validateRequest], asyncHandler(async (req, res) => {
  const patient = await Patient.create(req.body);
  res.status(201).json({ data: patient });
}));

router.get('/:id', [param('id').isMongoId(), validateRequest], asyncHandler(async (req, res) => {
  res.json({ data: await requireRecord(Patient, req.params.id, 'Patient') });
}));

router.patch('/:id', [
  param('id').isMongoId(),
  body('firstName').optional().isString().trim().isLength({ min: 1, max: 60 }),
  body('lastName').optional().isString().trim().isLength({ min: 1, max: 60 }),
  body('patientNumber').optional().isString().trim().isLength({ min: 2, max: 30 }),
  body('dateOfBirth').optional().isISO8601().custom((value) => new Date(value) <= new Date()),
  body('gender').optional().isIn(['Female', 'Male', 'Non-binary', 'Unspecified']),
  body('email').optional({ values: 'falsy' }).isEmail().normalizeEmail(),
  body('phone').optional().isString().trim().isLength({ max: 30 }),
  body('address').optional().isString().trim().isLength({ max: 240 }),
  body('insurance').optional().isObject(),
  body('vitals').not().exists().withMessage('Vitals must be added through a supported monitoring workflow.'),
  validateRequest
], asyncHandler(async (req, res) => {
  const allowed = ['firstName', 'lastName', 'patientNumber', 'dateOfBirth', 'gender', 'email', 'phone', 'address', 'insurance'];
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  if (!Object.keys(changes).length) throw new HttpError(400, 'EMPTY_UPDATE', 'Provide at least one editable patient field.');
  const patient = await Patient.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true });
  if (!patient) throw new HttpError(404, 'NOT_FOUND', 'Patient was not found.');
  res.json({ data: patient });
}));

router.delete('/:id', requireRole('admin', 'demo'), [param('id').isMongoId(), validateRequest], asyncHandler(async (req, res) => {
  const patient = await requireRecord(Patient, req.params.id, 'Patient');
  await Promise.all([
    Diagnosis.deleteMany({ patient: patient._id }),
    LabResult.deleteMany({ patient: patient._id }),
    Appointment.deleteMany({ patient: patient._id }),
    Message.deleteMany({ patient: patient._id })
  ]);
  await patient.deleteOne();
  res.status(204).end();
}));

module.exports = router;
