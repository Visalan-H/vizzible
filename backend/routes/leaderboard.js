const express = require('express');
const { getLeaderboard } = require('../controllers/leaderboardController');

const router = express.Router();

// No dedicated rate limiter (PLAN.md §2.6) - this is a single indexed
// query per request, cheaper than the /og-image route which already runs
// fine under just the blanket apiLimiter in server.js.
router.get('/', getLeaderboard);

module.exports = router;
