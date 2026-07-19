const mongoose = require('mongoose');

// One doc per (profile, distinct visitor), forever. Existence of a doc IS
// the "already counted" signal - there is no separate flag to check.
const profileVisitSchema = new mongoose.Schema({
  profileUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // 'user:<userId>' for signed-in visitors (exact identity - survives
  // cookie clearing, incognito, new devices), or 'cookie:<sha256>' for
  // anonymous visitors (best-effort - see visitorId.js for caveats).
  visitorKey: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// The dedupe mechanism itself: an insert either succeeds (genuinely new
// visitor for this profile) or throws E11000 (already counted). No
// read-then-write race, even under concurrent serverless invocations.
profileVisitSchema.index({ profileUserId: 1, visitorKey: 1 }, { unique: true });

module.exports = mongoose.model('ProfileVisit', profileVisitSchema);
