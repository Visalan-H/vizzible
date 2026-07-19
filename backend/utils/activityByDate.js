// Flattens an array of DailyActivity rows (one per user+platform+year) into
// a single 'YYYY-MM-DD' -> {github, codeforces, leetcode, total} map, plus
// the grand total across every row. Extracted out of ogImage/index.js so
// the leaderboard stats computed after each sync (services/sync.js, via
// utils/leaderboardStats.js) build the exact same view of "this user's
// activity" from the same raw rows, rather than a second, driftable copy
// of this loop - see PLAN.md §2.3.
function buildActivityByDate(rows) {
  const byDate = new Map();
  let totalSubmissions = 0;

  for (const row of rows) {
    const counts = row.counts instanceof Map ? row.counts : new Map(Object.entries(row.counts || {}));
    for (const [monthDay, count] of counts) {
      const date = `${row.year}-${monthDay}`;
      const entry = byDate.get(date) ?? { github: 0, codeforces: 0, leetcode: 0, total: 0 };
      entry[row.platform] = (entry[row.platform] || 0) + count;
      entry.total = entry.github + entry.codeforces + entry.leetcode;
      byDate.set(date, entry);
      totalSubmissions += count;
    }
  }

  return { byDate, totalSubmissions };
}

module.exports = { buildActivityByDate };
