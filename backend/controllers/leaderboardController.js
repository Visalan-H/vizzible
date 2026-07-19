const User = require('../models/User');

const CATEGORIES = ['streakCurrent', 'streakLongest', 'activityThisYear', 'activityAllTime'];
const PAGE_SIZE = 25;

// GET /api/leaderboard?category=<one of CATEGORIES>&page=<1-based>
async function getLeaderboard(req, res) {
  const { category } = req.query;
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  // showOnLeaderboard defaults to true in the schema (PLAN.md §2.4), but
  // that default only applies to documents created/saved after the field
  // was added - a user who existed before this shipped and hasn't synced
  // since has no showOnLeaderboard key in Mongo at all yet, not `true`.
  // Filtering on { $ne: false } (rather than { $eq: true }) treats
  // "missing" the same as "true", matching the intended default without
  // requiring a one-time backfill migration to be run first.
  const filter = { showOnLeaderboard: { $ne: false } };

  // Fetch one extra row past the page size to know whether there's a next
  // page without a separate count() query - a count() would need to scan
  // the whole matching set every request, where this stays a single
  // indexed sort+skip+limit.
  const users = await User.find(filter)
    .sort({ [category]: -1 })
    .skip(skip)
    .limit(PAGE_SIZE + 1)
    .select({ githubUsername: 1, [category]: 1 })
    .lean();

  const hasMore = users.length > PAGE_SIZE;
  const pageUsers = users.slice(0, PAGE_SIZE);

  const results = pageUsers.map((user, i) => ({
    rank: skip + i + 1,
    githubUsername: user.githubUsername,
    value: user[category] ?? 0,
  }));

  res.json({ category, page, results, hasMore });
}

module.exports = { getLeaderboard };
