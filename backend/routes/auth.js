const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { requireSameOrigin } = require('../middleware/requireSameOrigin');
const { oauthLimiter } = require('../middleware/rateLimit');
const {
  redirectToGithub,
  handleGithubCallback,
  getCurrentUser,
  logout,
} = require('../controllers/authController');

const router = express.Router();

router.get('/github', oauthLimiter, redirectToGithub);
router.get('/github/callback', oauthLimiter, handleGithubCallback);
router.get('/me', requireAuth, getCurrentUser);
router.post('/logout', requireSameOrigin, logout);

module.exports = router;
