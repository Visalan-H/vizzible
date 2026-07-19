const { verifySession } = require('../utils/jwt');

// Public profile routes need to know WHO is looking (to dedupe visits by
// userId when possible, and to skip counting the owner viewing their own
// page) without requiring sign-in the way requireAuth does. Sets
// req.userId when a valid session exists, otherwise leaves it undefined
// and continues - never a 401.
function optionalAuth(req, res, next) {
  const token = req.cookies?.session;
  const payload = token && verifySession(token);
  if (payload) req.userId = payload.userId;
  next();
}

module.exports = { optionalAuth };
