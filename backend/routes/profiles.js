const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { updateProfile, getProfile, getActivity } = require('../controllers/profileController');

const router = express.Router();

router.patch('/me', requireAuth, updateProfile);
router.get('/:username', getProfile);
router.get('/:username/activity', getActivity);

module.exports = router;
