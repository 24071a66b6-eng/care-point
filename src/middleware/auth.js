const jwt = require('jsonwebtoken');
const HttpError = require('../utils/httpError');

function requireRole(...roles) {
  return (req, res, next) => {
    const publicDemoAllowed = req.user?.role === 'demo' && roles.includes('demo');
    if (!req.user || (!roles.includes(req.user.role) && !publicDemoAllowed)) {
      return next(new HttpError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'));
    }
    next();
  };
}

function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token && process.env.PUBLIC_DEMO_MODE === 'true') {
    req.user = { sub: 'public-demo', role: 'demo', name: 'Public demo visitor' };
    return next();
  }
  if (!token) return next(new HttpError(401, 'UNAUTHENTICATED', 'Sign in to continue.'));

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new HttpError(401, 'INVALID_TOKEN', 'Your session is invalid or has expired.'));
  }
}

module.exports = { requireAuth, requireRole };
