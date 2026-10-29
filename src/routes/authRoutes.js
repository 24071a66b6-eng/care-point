const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { validateRequest } = require('../middleware/errors');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');

const router = Router();

router.post('/login', [
  body('email').isEmail().withMessage('Enter a valid email address.').normalizeEmail(),
  body('password').isString().isLength({ min: 1, max: 200 }).withMessage('Password is required.'),
  validateRequest
], asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  const token = jwt.sign(
    { sub: user.id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
  res.json({ data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } } });
}));

router.get('/me', requireAuth, (req, res) => {
  res.json({ data: { id: req.user.sub, name: req.user.name, role: req.user.role } });
});

module.exports = router;
