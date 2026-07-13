const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/requireAuth');
const {
  redirectToGithub,
  handleGithubCallback,
  getCurrentUser,
  logout,
} = require('../controllers/authController');

const router = express.Router();

// OAuth start/callback are unauthenticated and hit external APIs on our
// behalf - keep them from being hammered.
const oauthLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

router.get('/github', oauthLimiter, redirectToGithub);
router.get('/github/callback', oauthLimiter, handleGithubCallback);
router.get('/me', requireAuth, getCurrentUser);
router.post('/logout', logout);

module.exports = router;
