const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const {
  redirectToGithub,
  handleGithubCallback,
  getCurrentUser,
  logout,
} = require('../controllers/authController');

const router = express.Router();

router.get('/github', redirectToGithub);
router.get('/github/callback', handleGithubCallback);
router.get('/me', requireAuth, getCurrentUser);
router.post('/logout', logout);

module.exports = router;
