const { Router } = require('express');
const { param } = require('express-validator');
const Notification = require('../models/Notification');
const { validateRequest } = require('../middleware/errors');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { pagination, pageResult } = require('../utils/records');

const router = Router();

router.get('/notifications', asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const [data, total, unread] = await Promise.all([
    Notification.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(),
    Notification.countDocuments({ read: false })
  ]);
  res.json({ ...pageResult(data, total, page, limit), unread });
}));

router.patch('/notifications/:id/read', [param('id').isMongoId(), validateRequest], asyncHandler(async (req, res) => {
  const data = await Notification.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
  if (!data) throw new HttpError(404, 'NOT_FOUND', 'Notification was not found.');
  res.json({ data });
}));

module.exports = router;
