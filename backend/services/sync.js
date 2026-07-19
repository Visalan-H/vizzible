const DailyActivity = require('../models/DailyActivity');
const SyncLock = require('../models/SyncLock');
const { fetchGithubActivity } = require('../connectors/github');
const { fetchCodeforcesActivity } = require('../connectors/codeforces');
const { fetchLeetcodeActivity } = require('../connectors/leetcode');
const { decrypt } = require('../utils/crypto');
const { computeLeaderboardStats } = require('../utils/leaderboardStats');

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const LOCK_TTL_MS = 60 * 1000;

function isStale(user) {
  return !user.lastSyncedAt || Date.now() - user.lastSyncedAt.getTime() > STALE_AFTER_MS;
}

async function saveActivity(userId, platform, days) {
  if (days.length === 0) return;

  // Group the flat {date, count}[] this connector returned into one bucket
  // per year, then upsert each year as a single document - $set only the
  // specific 'MM-DD' map keys that changed, leaving any other days already
  // stored for that year untouched.
  const byYear = new Map();
  for (const { date, count } of days) {
    const year = Number(date.slice(0, 4));
    const monthDay = date.slice(5); // 'MM-DD'
    if (!byYear.has(year)) byYear.set(year, {});
    byYear.get(year)[monthDay] = count;
  }

  const operations = [...byYear.entries()].map(([year, counts]) => ({
    updateOne: {
      filter: { userId, platform, year },
      update: {
        $set: Object.fromEntries(Object.entries(counts).map(([monthDay, count]) => [`counts.${monthDay}`, count])),
      },
      upsert: true,
    },
  }));

  await DailyActivity.bulkWrite(operations);
}

// The frontend requests combined/github/codeforces/leetcode activity in
// parallel on every profile load, and each of those requests independently
// decides whether to trigger a sync. Without a lock, a single stale visit
// fires several concurrent syncs, each with its own Codeforces + LeetCode
// calls - blowing straight through Codeforces' 1-req/2s limit and
// hammering LeetCode's burst-sensitive unofficial endpoint.
//
// This used to be an in-memory Map, which only dedupes requests that land
// on the same warm serverless instance - on Vercel, concurrent requests
// for the same user can easily hit different instances with separate
// memory, so it wasn't actually preventing concurrent syncs in production.
// A Mongo-backed lock is visible to every instance: claiming it is a
// single insert that either succeeds or hits SyncLock's unique index, so
// only one caller ever proceeds.
async function syncUserActivity(user) {
  const key = user._id.toString();

  try {
    await SyncLock.create({ key, expiresAt: new Date(Date.now() + LOCK_TTL_MS) });
  } catch (err) {
    if (err.code === 11000) return; // another instance already has this covered
    throw err;
  }

  try {
    await doSync(user);
  } finally {
    await SyncLock.deleteOne({ key }).catch((err) =>
      console.error(`[sync] failed to release lock for ${user.githubUsername}:`, err.message)
    );
  }
}

// Syncs whichever platforms succeed; one platform failing doesn't block the others,
// and a failed sync just leaves the existing data in place for the next attempt.
async function doSync(user) {
  const results = await Promise.allSettled([
    fetchGithubActivity(user.githubUsername, decrypt(user.githubAccessToken)).then((days) =>
      saveActivity(user._id, 'github', days)
    ),
    user.codeforcesHandle
      ? fetchCodeforcesActivity(user.codeforcesHandle).then((days) => saveActivity(user._id, 'codeforces', days))
      : Promise.resolve(),
    user.leetcodeUsername
      ? fetchLeetcodeActivity(user.leetcodeUsername).then((days) => saveActivity(user._id, 'leetcode', days))
      : Promise.resolve(),
  ]);

  const labels = ['github', 'codeforces', 'leetcode'];
  let anySucceeded = false;
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const err = r.reason;
      console.error(`[sync] ${labels[i]} FAILED for ${user.githubUsername}:`, err?.response?.status, err?.response?.data ?? err?.message ?? err);
    } else {
      anySucceeded = true;
    }
  });

  // Only stamp lastSyncedAt when something actually synced. Previously
  // this ran unconditionally, so a total outage (all three platforms
  // failing) still marked the user "freshly synced" - isStale() would then
  // report fresh for a full day even though nothing ever succeeded,
  // silently delaying the next retry.
  if (anySucceeded) {
    user.lastSyncedAt = new Date();
    // Same guard as lastSyncedAt above, and for the same reason: a sync
    // where every platform failed shouldn't zero out someone's leaderboard
    // position with stats computed from stale/incomplete data (PLAN.md
    // §2.5). Recomputed from DailyActivity rather than derived from
    // `results` above so this reflects everything on record for the user,
    // not just what this particular sync happened to touch.
    const stats = await computeLeaderboardStats(user._id).catch((err) => {
      console.error(`[sync] leaderboard stats computation failed for ${user.githubUsername}:`, err.message);
      return null;
    });
    if (stats) Object.assign(user, stats);
    await user.save();
  }
}

module.exports = { syncUserActivity, isStale };
