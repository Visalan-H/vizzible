const User = require('../models/User');
const ProfileVisit = require('../models/ProfileVisit');
const { getOrSetVisitorCookie, hashVisitorId } = require('../utils/visitorId');

// Records one raw pageview, and - if this visitorKey has never hit this
// profile before - one unique visitor. The unique index on ProfileVisit
// does the dedupe atomically, so this is safe under concurrent requests
// (two simultaneous first-time visits can't both count as unique).
async function recordVisit(profileUserId, visitorKey) {
  const inc = { profileViews: 1 };

  try {
    await ProfileVisit.create({ profileUserId, visitorKey });
    inc.uniqueVisitorCount = 1; // insert succeeded -> genuinely first visit
  } catch (err) {
    if (err.code !== 11000) throw err; // anything but "duplicate key" is a real failure
    // else: already counted as unique before, just record the pageview
  }

  await User.findByIdAndUpdate(profileUserId, { $inc: inc });
}

// Builds the visitorKey for the current request: exact identity if signed
// in, best-effort cookie hash otherwise. Also returns whether this request
// is the profile owner viewing their own page (never counted as a visit).
function resolveVisitor(req, res, profileUser) {
  const isOwner = req.userId && String(req.userId) === String(profileUser._id);

  if (req.userId) {
    return { isOwner, visitorKey: `user:${req.userId}` };
  }

  const vid = getOrSetVisitorCookie(req, res);
  return { isOwner, visitorKey: `cookie:${hashVisitorId(vid)}` };
}

module.exports = { recordVisit, resolveVisitor };
