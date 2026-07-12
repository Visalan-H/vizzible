const DailyActivity = require('../models/DailyActivity');
const { fetchGithubActivity } = require('../connectors/github');
const { fetchCodeforcesActivity } = require('../connectors/codeforces');
const { fetchLeetcodeActivity } = require('../connectors/leetcode');
const { decrypt } = require('../utils/crypto');

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function isStale(user) {
  return !user.lastSyncedAt || Date.now() - user.lastSyncedAt.getTime() > STALE_AFTER_MS;
}

async function saveActivity(userId, platform, days) {
  if (days.length === 0) return;

  const operations = days.map(({ date, count }) => ({
    updateOne: {
      filter: { userId, platform, date },
      update: { $set: { count } },
      upsert: true,
    },
  }));

  await DailyActivity.bulkWrite(operations);
}

// The frontend requests combined/github/codeforces/leetcode activity in
// parallel on every profile load, and each of those requests independently
// decides whether to trigger a sync. Without this, a single stale visit
// fires 4 concurrent syncs, each with its own Codeforces + LeetCode calls -
// blowing straight through Codeforces' 1-req/2s limit and hammering
// LeetCode's burst-sensitive unofficial endpoint. Keyed in-memory per
// userId so concurrent requests share one in-flight sync instead of racing.
const inFlightSyncs = new Map();

function syncUserActivity(user) {
  const key = user._id.toString();
  if (inFlightSyncs.has(key)) {
    console.log(`[sync] reusing in-flight sync for ${user.githubUsername}`);
    return inFlightSyncs.get(key);
  }

  console.log(`[sync] triggering sync for ${user.githubUsername}`);
  const promise = doSync(user).finally(() => inFlightSyncs.delete(key));
  inFlightSyncs.set(key, promise);
  return promise;
}

// Syncs whichever platforms succeed; one platform failing doesn't block the others,
// and a failed sync just leaves the existing data in place for the next attempt.
async function doSync(user) {
  console.log(
    `[sync] starting for ${user.githubUsername} (cf=${user.codeforcesHandle ?? 'none'}, lc=${user.leetcodeUsername ?? 'none'})`
  );

  const results = await Promise.allSettled([
    fetchGithubActivity(user.githubUsername, decrypt(user.githubAccessToken)).then((days) => {
      console.log(`[sync] github ok for ${user.githubUsername}: ${days.length} days`);
      return saveActivity(user._id, 'github', days);
    }),
    user.codeforcesHandle
      ? fetchCodeforcesActivity(user.codeforcesHandle).then((days) => {
          console.log(`[sync] codeforces ok for ${user.codeforcesHandle}: ${days.length} days`);
          return saveActivity(user._id, 'codeforces', days);
        })
      : (console.log(`[sync] codeforces skipped for ${user.githubUsername}: no handle set`), Promise.resolve()),
    user.leetcodeUsername
      ? fetchLeetcodeActivity(user.leetcodeUsername).then((days) => {
          console.log(`[sync] leetcode ok for ${user.leetcodeUsername}: ${days.length} days`);
          return saveActivity(user._id, 'leetcode', days);
        })
      : (console.log(`[sync] leetcode skipped for ${user.githubUsername}: no username set`), Promise.resolve()),
  ]);

  const labels = ['github', 'codeforces', 'leetcode'];
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const err = r.reason;
      console.error(`[sync] ${labels[i]} FAILED for ${user.githubUsername}:`, err?.response?.status, err?.response?.data ?? err?.message ?? err);
    }
  });

  user.lastSyncedAt = new Date();
  await user.save();
  console.log(`[sync] finished for ${user.githubUsername}, lastSyncedAt=${user.lastSyncedAt.toISOString()}`);
}

module.exports = { syncUserActivity, isStale };
