const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { optionalAuth } = require('../middleware/optionalAuth');
const { requireSameOrigin } = require('../middleware/requireSameOrigin');
const { updateLimiter, ogImageLimiter } = require('../middleware/rateLimit');
const { updateProfile, getProfile, getActivity, getProfileOGImage, getProfileMetaHTML } = require('../controllers/profileController');

const router = express.Router();

router.patch('/me', requireSameOrigin, requireAuth, updateLimiter, updateProfile);
router.get('/:username', optionalAuth, getProfile);
router.get('/:username/activity', getActivity);
router.get('/:username/og-image', ogImageLimiter, getProfileOGImage);
router.get('/:username/meta', getProfileMetaHTML);

module.exports = router;
