const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/requireAuth');
const { updateProfile, getProfile, getActivity } = require('../controllers/profileController');

const router = express.Router();

// Each save can trigger a background GitHub/Codeforces/LeetCode sync -
// cheap to abuse otherwise since a single account could fire dozens of
// syncs in seconds by toggling a handle back and forth.
const updateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

router.patch('/me', requireAuth, updateLimiter, updateProfile);
router.get('/:username', getProfile);
router.get('/:username/activity', getActivity);

module.exports = router;
