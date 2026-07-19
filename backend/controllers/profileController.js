const { z } = require('zod');
const { waitUntil } = require('@vercel/functions');
const User = require('../models/User');
const DailyActivity = require('../models/DailyActivity');
const { syncUserActivity, isStale } = require('../services/sync');
const { findUserByUsername } = require('../services/userLookup');
const { renderProfileOGImage } = require('../services/ogImage');
const { renderProfileMetaHTML } = require('../services/profileMeta');
const { recordVisit, resolveVisitor } = require('../services/visits');

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
  label: z.string().trim().max(40).optional(),
  icon: z.string().trim().max(50).optional(),
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
  codeforcesHandle: z
    .string()
    .trim()
    .min(1)
    .max(39)
    .regex(/^[A-Za-z0-9_.-]+$/, 'Only letters, numbers, underscores, dots, and hyphens allowed')
    .nullable(),
  leetcodeUsername: z
    .string()
    .trim()
    .min(1)
    .max(39)
    .regex(/^[A-Za-z0-9_.-]+$/, 'Only letters, numbers, underscores, dots, and hyphens allowed')
    .nullable(),
  tagline: z.string().trim().max(120).nullable(),
  bio: z.string().trim().max(500).nullable(),
  links: z.array(linkSchema).max(10),
  showOnLeaderboard: z.boolean(),
});

function publicFields(user) {
  return {
    githubUsername: user.githubUsername,
    codeforcesHandle: user.codeforcesHandle,
    leetcodeUsername: user.leetcodeUsername,
    tagline: user.tagline,
    bio: user.bio,
    links: user.links,
    showOnLeaderboard: user.showOnLeaderboard,
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
  // stale - syncUserActivity's lock keeps this safe even if a page load's
  // own activity fetch triggers a sync around the same time.
  safeWaitUntil(
    syncUserActivity(user).catch((err) => console.error('[updateProfile] Post-edit sync failed:', err))
  );
}

async function getProfile(req, res) {
  const user = await findUserByUsername(req.params.username);
  if (!user) return res.status(404).json({ error: 'Profile not found' });

  const { isOwner, visitorKey } = resolveVisitor(req, res, user);

  res.json({
    ...publicFields(user),
    lastSyncedAt: user.lastSyncedAt,
    profileViews: user.profileViews,
    uniqueVisitorCount: user.uniqueVisitorCount,
  });

  // Off the response path, same pattern as the background sync below -
  // the visitor doesn't wait on this. Owner viewing their own page never
  // counts as a visit.
  if (!isOwner) {
    safeWaitUntil(
      recordVisit(user._id, visitorKey).catch((err) => console.error('[getProfile] visit tracking failed:', err))
    );
  }
}

async function getActivity(req, res) {
  const user = await findUserByUsername(req.params.username);
  if (!user) return res.status(404).json({ error: 'Profile not found' });

  // At most a few documents per user now (one per platform per year they've
  // been active), so a plain find + in-memory flatten replaces what used to
  // be a $group aggregation over hundreds/thousands of per-day rows.
  const rows = await DailyActivity.find({ userId: user._id }).lean();

  const byDate = new Map();
  for (const row of rows) {
    const counts = row.counts instanceof Map ? row.counts : new Map(Object.entries(row.counts || {}));
    for (const [monthDay, count] of counts) {
      const date = `${row.year}-${monthDay}`;
      const entry = byDate.get(date) ?? { date, github: 0, codeforces: 0, leetcode: 0, total: 0 };
      entry[row.platform] = count;
      entry.total = entry.github + entry.codeforces + entry.leetcode;
      byDate.set(date, entry);
    }
  }

  const activity = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  res.json({ activity, lastSyncedAt: user.lastSyncedAt });

  // Serve cached data immediately, refresh in the background if it's stale.
  // A failed refresh just leaves the existing data in place for next time.
  if (isStale(user)) {
    safeWaitUntil(
      syncUserActivity(user).catch((err) => console.error('[getActivity] Background sync failed:', err))
    );
  }
}

async function getProfileOGImage(req, res) {
  try {
    const user = await findUserByUsername(req.params.username);
    if (!user) return res.status(404).send('Profile not found');

    const rows = await DailyActivity.find({ userId: user._id }).lean();
    const buffer = await renderProfileOGImage(user, rows);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return res.send(buffer);
  } catch (err) {
    console.error('Error generating OG image:', err);
    return res.status(500).send('Error generating image');
  }
}

async function getProfileMetaHTML(req, res) {
  try {
    const user = await findUserByUsername(req.params.username);
    if (!user) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(404).send(renderProfileMetaHTML(null, req));
    }

    const html = renderProfileMetaHTML(user, req);
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (err) {
    console.error('Error serving meta HTML:', err);
    return res.status(500).send('Server Error');
  }
}

module.exports = { updateProfile, getProfile, getActivity, getProfileOGImage, getProfileMetaHTML };
