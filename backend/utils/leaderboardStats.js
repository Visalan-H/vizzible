const DailyActivity = require('../models/DailyActivity');
const { buildActivityByDate } = require('./activityByDate');
const { computeStreaks } = require('./streaks');

// Recomputes the four denormalized ranking fields (PLAN.md §2.2) from a
// user's current DailyActivity rows. Called once per successful sync
// (services/sync.js), right where lastSyncedAt already gets stamped - not
// on every profile view or leaderboard request - so GET /api/leaderboard
// stays a plain indexed User query with no live cross-user aggregation,
// at any user-base size. Leaderboard numbers are therefore only as fresh
// as the user's last successful sync, same staleness model the rest of
// the app already runs on.
async function computeLeaderboardStats(userId) {
  const rows = await DailyActivity.find({ userId }).lean();
  const { byDate, totalSubmissions } = buildActivityByDate(rows);

  const today = new Date();
  const { currentStreak, longestStreak } = computeStreaks(byDate, today);

  // Scoped to the *current* calendar year at compute time, not accumulated
  // forever - a sync on Dec 31 vs. Jan 1 needs to produce a different
  // activityThisYear for the same underlying data. DailyActivity already
  // partitions by `year`, so this is just "sum the counts for the current
  // year's documents only," same query shape getActivity already does,
  // filtered to one year instead of all of them.
  const currentYear = today.getUTCFullYear();
  const activityThisYear = rows
    .filter((row) => row.year === currentYear)
    .reduce((sum, row) => {
      const counts = row.counts instanceof Map ? row.counts : new Map(Object.entries(row.counts || {}));
      for (const count of counts.values()) sum += count;
      return sum;
    }, 0);

  return {
    streakCurrent: currentStreak,
    streakLongest: longestStreak,
    activityAllTime: totalSubmissions,
    activityThisYear,
    statsUpdatedAt: today,
  };
}

module.exports = { computeLeaderboardStats };
