const mongoose = require('mongoose');

const linkSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 40 },
    url: { type: String, required: true, trim: true, maxlength: 300 },
    icon: { type: String, default: 'generic' }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema({
  githubId: { type: Number, required: true, unique: true },
  githubUsername: { type: String, required: true, unique: true }, // also the public profile slug
  githubAccessToken: { type: String, required: true },
  codeforcesHandle: { type: String, default: null },
  leetcodeUsername: { type: String, default: null },
  tagline: { type: String, default: null, trim: true, maxlength: 120 },
  bio: { type: String, default: null, trim: true, maxlength: 500 },
  // Generic instead of dedicated linkedinUrl/twitterUrl/etc fields - covers
  // any link the person wants to add (portfolio, resume, LinkedIn, X, a
  // blog...) without a schema change every time a new platform comes up.
  // Capped at 10 by the validation layer, not enforced here.
  links: { type: [linkSchema], default: [] },
  lastSyncedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  // Raw page loads of this user's public profile - never deduped.
  profileViews: { type: Number, default: 0 },
  // Distinct visitors, deduped forever via the ProfileVisit unique index.
  // Logged-in visitors are deduped by userId (exact); anonymous visitors
  // are deduped by a long-lived cookie (best-effort - see ProfileVisit).
  uniqueVisitorCount: { type: Number, default: 0 },

  // --- Leaderboard (Explore/Leaderboard PLAN.md §2.2) ---
  // Denormalized at sync time (services/sync.js's doSync, via
  // utils/leaderboardStats.js) rather than aggregated live from
  // DailyActivity on every leaderboard request - keeps GET /api/leaderboard
  // a cheap, indexed User query regardless of how many users exist.
  streakCurrent: { type: Number, default: 0 },
  streakLongest: { type: Number, default: 0 },
  activityAllTime: { type: Number, default: 0 },
  activityThisYear: { type: Number, default: 0 },
  // When the four fields above were last computed - NOT the same as
  // lastSyncedAt, since a sync where every platform failed leaves both
  // untouched together, but they're conceptually separate facts.
  statsUpdatedAt: { type: Date, default: null },
  // Profiles are already public-by-link; this controls DISCOVERABILITY -
  // whether a stranger can find this profile via the leaderboard without
  // already having the direct link. Defaults true (existing users keep
  // their current implicit "public" status); one-click opt-out lives in
  // EditProfileForm. See PLAN.md §2.4 for the reasoning.
  showOnLeaderboard: { type: Boolean, default: true },
});

// One compound index per leaderboard category (PLAN.md §2.6) - each
// query is `User.find({ showOnLeaderboard: ... }).sort({ [category]: -1 })`,
// so the leading field matches the filter and the trailing field matches
// the sort. Four small indexes, cheap at any realistic scale this app
// will hit.
userSchema.index({ showOnLeaderboard: 1, streakCurrent: -1 });
userSchema.index({ showOnLeaderboard: 1, streakLongest: -1 });
userSchema.index({ showOnLeaderboard: 1, activityAllTime: -1 });
userSchema.index({ showOnLeaderboard: 1, activityThisYear: -1 });

module.exports = mongoose.model('User', userSchema);
