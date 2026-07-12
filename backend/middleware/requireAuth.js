const { verifySession } = require('../utils/jwt');

function requireAuth(req, res, next) {
  const token = req.cookies.session;
  const payload = token && verifySession(token);

  if (!payload) {
    return res.status(401).json({ error: 'Not signed in' });
  }

  req.userId = payload.userId;
  next();
}

module.exports = { requireAuth };
