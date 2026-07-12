const { z } = require('zod');
const { waitUntil } = require('@vercel/functions');
const User = require('../models/User');
const DailyActivity = require('../models/DailyActivity');
const { syncUserActivity, isStale } = require('../services/sync');

// The sync promise is constructed (and starts running) before it's ever
// passed to waitUntil() below - JS evaluates arguments before the call - so
// even if waitUntil() itself misbehaves outside an actual Vercel runtime
// (this is plain Express, not a Vercel Function), the sync itself still
// fires. This wrapper just stops a misbehaving waitUntil() from throwing
// an uncaught error after the response has already been sent.
function safeWaitUntil(promise) {
  try {
    waitUntil(promise);
  } catch (err) {
    console.error('[waitUntil] threw, sync promise keeps running regardless:', err);
    promise.catch(() => {});
  }
}

const linkSchema = z.object({
  label: z.string().trim().min(1).max(40),
  url: z
    .string()
    .trim()
    .max(300)
    // z.string().url() alone would accept "javascript:alert(1)" - it's a
    // syntactically valid URL, just not one you ever want rendered as a
    // clickable <a href> on a public profile page (stored XSS on click, for
    // any visitor, not just the profile owner). Restricting to http(s)
    // closes that off.
    .refine((val) => {
      try {
        const { protocol } = new URL(val);
        return protocol === 'http:' || protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Must be a valid http(s) URL'),
});

const profileUpdateSchema = z.object({
  codeforcesHandle: z.string().trim().min(1).max(39).nullable(),
  leetcodeUsername: z.string().trim().min(1).max(39).nullable(),
  tagline: z.string().trim().max(120).nullable(),
  bio: z.string().trim().max(500).nullable(),
  links: z.array(linkSchema).max(10),
});

function publicFields(user) {
  return {
    githubUsername: user.githubUsername,
    codeforcesHandle: user.codeforcesHandle,
    leetcodeUsername: user.leetcodeUsername,
    tagline: user.tagline,
    bio: user.bio,
    links: user.links,
  };
}

async function updateProfile(req, res) {
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const before = await User.findById(req.userId);
  if (!before) return res.status(404).json({ error: 'User not found' });

  // Only resync if a handle actually changed - editing your bio or adding a
  // link shouldn't trigger a full GitHub/Codeforces/LeetCode refetch.
  const handleChanged =
    parsed.data.codeforcesHandle !== before.codeforcesHandle ||
    parsed.data.leetcodeUsername !== before.leetcodeUsername;

  const user = await User.findByIdAndUpdate(req.userId, parsed.data, { new: true });
  res.json(publicFields(user));

  if (!handleChanged) return;

  // isStale() alone isn't enough here: lastSyncedAt is usually already
  // "fresh" from the sync that ran right after GitHub sign-in (when these
  // handles were still null), so the 24h staleness check would silently
  // skip Codeforces/LeetCode for up to a day after someone actually adds
  // them. Adding a handle should sync it now, not whenever it next looks
  // stale - syncUserActivity's in-flight dedupe keeps this safe even if a
  // page load's own activity fetches trigger a sync around the same time.
  console.log(`[updateProfile] handle changed, calling waitUntil(syncUserActivity) for ${user.githubUsername}`);
  safeWaitUntil(
    syncUserActivity(user)
      .then(() => console.log(`[updateProfile] sync promise resolved for ${user.githubUsername}`))
      .catch((err) => console.error('[updateProfile] Post-edit sync failed:', err))
  );
}

async function getProfile(req, res) {
  const user = await User.findOne({ githubUsername: req.params.username });
  if (!user) return res.status(404).json({ error: 'Profile not found' });

  res.json({ ...publicFields(user), lastSyncedAt: user.lastSyncedAt });
}

async function getActivity(req, res) {
  const user = await User.findOne({ githubUsername: req.params.username });
  if (!user) return res.status(404).json({ error: 'Profile not found' });

  // One aggregation returns every platform's count per day, instead of the
  // frontend making 4 separate requests (one per tab) that each re-ran their
  // own query and independently triggered a staleness check. This shape is
  // also exactly what the day-detail popup needs - no separate endpoint for it.
  const rows = await DailyActivity.aggregate([
    { $match: { userId: user._id } },
    { $group: { _id: '$date', platforms: { $push: { platform: '$platform', count: '$count' } } } },
    { $sort: { _id: 1 } },
  ]);

  const activity = rows.map((row) => {
    const byPlatform = { github: 0, codeforces: 0, leetcode: 0 };
    for (const { platform, count } of row.platforms) byPlatform[platform] = count;
    const total = byPlatform.github + byPlatform.codeforces + byPlatform.leetcode;
    return { date: row._id, ...byPlatform, total };
  });

  res.json({ activity, lastSyncedAt: user.lastSyncedAt });

  // Serve cached data immediately, refresh in the background if it's stale.
  // A failed refresh just leaves the existing data in place for next time.
  const stale = isStale(user);
  console.log(
    `[getActivity] ${req.params.username} rows=${activity.length} lastSyncedAt=${user.lastSyncedAt} isStale=${stale}`
  );
  if (stale) {
    safeWaitUntil(
      syncUserActivity(user)
        .then(() => console.log(`[getActivity] background sync resolved for ${user.githubUsername}`))
        .catch((err) => console.error('[getActivity] Background sync failed:', err))
    );
  }
}

module.exports = { updateProfile, getProfile, getActivity };
