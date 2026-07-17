const { z } = require('zod');
const { waitUntil } = require('@vercel/functions');
const axios = require('axios');
const React = require('react');
const User = require('../models/User');
const DailyActivity = require('../models/DailyActivity');
const { syncUserActivity, isStale } = require('../services/sync');

// OG image rendering: @vercel/og's ImageResponse (Satori + resvg under the
// hood), NOT raw SVG + a bare @resvg/resvg-js call like an earlier version
// of this file used. Every attempt to hand a custom font to resvg directly
// - reading .woff2 from node_modules/@fontsource/..., a vercel.json
// includeFiles glob, a plain committed backend/fonts/ folder, even a
// base64 string embedded straight in JS source (so there was no separate
// file at all for any bundler step to miss) - still rendered blank text in
// production despite every one of those working locally, which stopped
// looking like a "file didn't get bundled" problem and started looking
// like something more fundamental about how that font data was reaching
// resvg on Vercel's specific runtime. @vercel/og sidesteps the whole
// question: it ships its own Noto Sans font built into the npm package
// itself (not a loose asset needing separate bundling), so no custom font
// handling is needed here at all.
//
// @vercel/og ships as an ES Module (dist/index.node.js), and this backend
// is CommonJS (require()) - a plain top-level require('@vercel/og') throws
// ERR_REQUIRE_ESM at runtime, since CJS can't load ESM synchronously.
// Loaded via dynamic import() instead (the fix Node's own error message
// points to), cached in a module-level promise so a warm function instance
// only pays that import cost once, not once per request.
let ImageResponseCtorPromise = null;
function getImageResponseCtor() {
  if (!ImageResponseCtorPromise) {
    ImageResponseCtorPromise = import('@vercel/og').then((mod) => mod.ImageResponse);
  }
  return ImageResponseCtorPromise;
}

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// GitHub usernames are case-insensitive (GitHub itself treats Visalan-H
// and visalan-h as the same account), but githubUsername is stored with
// whatever casing GitHub's API returned at sign-in and Mongo string
// equality is case-sensitive by default - so a profile URL only worked if
// you typed the exact original casing. Every route below looks a user up
// by username from a URL, so they all go through this instead of a plain
// findOne, matching case-insensitively via an anchored, escaped regex
// (small user table - a regex scan here is not a perf concern - so this
// skips a schema migration/second indexed field for a one-line fix).
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function findUserByUsername(username) {
  return User.findOne({ githubUsername: new RegExp(`^${escapeRegExp(username)}$`, 'i') });
}

// --- Theme-equal intensity math ---------------------------------------
// Duplicated from frontend/src/utils/platformColors.js (getLightModeTierColor /
// getDarkModeTierColor) rather than shared, since this is a separate
// CommonJS backend with no shared module boundary with the Vite frontend.
// Keep both in sync if either the platform hues or TIER_FRACTIONS curve
// ever changes.
//
// See that file's comment block for the full rationale: target ratios are
// defined directly on a shared curve (TIER_FRACTIONS) anchored to each hue's
// own contrast against black, then solved as a solid HSL-darkened shade
// hitting that exact ratio against THIS image's near-white canvas. This
// image only ever renders on a light canvas, so it only needs the
// light-mode half of that math (no dark-canvas / lightenToContrast side).
const OG_CANVAS = '#F2EDED'; // matches this image's own background, below
const OG_DARK_REFERENCE_CANVAS = '#000000';
// Same curve as frontend's TIER_FRACTIONS - keep numerically identical.
const OG_TIER_FRACTIONS = [0.35, 0.55, 0.8, 1];

function ogSrgbToLinear(c) {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function ogHexToRgb(hex) {
  hex = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
function ogRelativeLuminance(hex) {
  const [r, g, b] = ogHexToRgb(hex).map(ogSrgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ogContrastRatio(hexA, hexB) {
  const L1 = ogRelativeLuminance(hexA);
  const L2 = ogRelativeLuminance(hexB);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}
function ogHexToHsl(hex) {
  const [r, g, b] = ogHexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h, s, l];
}
function ogHslToHex(h, s, l) {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (c) => Math.round(c * 255).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}
function ogDarkenToContrast(baseHex, bgHex, targetRatio) {
  const [h, s] = ogHexToHsl(baseHex);
  // Full [0,1] range, not capped at the base hue's own lightness: contrast
  // against a near-white bg falls monotonically as l rises from 0 (black)
  // to 1 (white) across the WHOLE range, regardless of where the base hue
  // itself sits. Capping the search at the base hue assumed every tier
  // needs darkening, but a hue that's already fairly dark (codeforces blue)
  // can overshoot an early tier's target before any darkening at all -
  // early tiers there need to search *lighter* than the base hue instead,
  // or two adjacent tiers collapse into the identical color.
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const ratio = ogContrastRatio(ogHslToHex(h, s, mid), bgHex);
    if (ratio < targetRatio) hi = mid;
    else lo = mid;
  }
  return ogHslToHex(h, s, (lo + hi) / 2);
}
// Builds the 4-tier ramp (level 1-4) for one platform hue, each tier hitting
// a target ratio on the shared TIER_FRACTIONS curve, anchored to baseHex's
// own contrast against black (see comment block above).
function buildTierRamp(baseHex) {
  const fullRatio = ogContrastRatio(baseHex, OG_DARK_REFERENCE_CANVAS);
  return OG_TIER_FRACTIONS.map((fraction) => {
    const targetRatio = 1 + (fullRatio - 1) * fraction;
    return ogDarkenToContrast(baseHex, OG_CANVAS, targetRatio);
  });
}
// Computed once at module load, not per-request - inputs are fixed hexes,
// there's nothing request-specific to recompute.
const RAMPS = {
  github: buildTierRamp('#39d353'),
  codeforces: buildTierRamp('#4a90d9'),
  leetcode: buildTierRamp('#ffa116'),
};

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
  safeWaitUntil(
    syncUserActivity(user).catch((err) => console.error('[updateProfile] Post-edit sync failed:', err))
  );
}

async function getProfile(req, res) {
  const user = await findUserByUsername(req.params.username);
  if (!user) return res.status(404).json({ error: 'Profile not found' });

  res.json({ ...publicFields(user), lastSyncedAt: user.lastSyncedAt });
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

    const activeDaysCount = byDate.size;

    // Calculate dates for the last 46 weeks (322 days) for the heatmap
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 45 * 7 - today.getDay());
    startDate.setHours(0, 0, 0, 0);

    const grid = [];
    const temp = new Date(startDate);
    while (temp <= today) {
      const dateStr = temp.toISOString().slice(0, 10);
      const entry = byDate.get(dateStr) ?? { github: 0, codeforces: 0, leetcode: 0, total: 0 };
      grid.push({
        date: dateStr,
        ...entry
      });
      temp.setDate(temp.getDate() + 1);
    }

    // Accurate Streak Calculation across ALL time
    const allDates = Array.from(byDate.keys()).sort();
    let currentStreak = 0;
    let longestStreak = 0;
    
    if (allDates.length > 0) {
      const firstDate = new Date(allDates[0]);
      let tempStreak = 0;
      const d = new Date(firstDate);
      while(d <= today) {
        const dateStr = d.toISOString().slice(0, 10);
        const entry = byDate.get(dateStr);
        if (entry && entry.total > 0) {
          tempStreak++;
          if (tempStreak > longestStreak) longestStreak = tempStreak;
        } else {
          tempStreak = 0;
        }
        d.setDate(d.getDate() + 1);
      }
      
      const d2 = new Date(today);
      while(true) {
        const dateStr = d2.toISOString().slice(0, 10);
        const entry = byDate.get(dateStr);
        if (entry && entry.total > 0) {
          currentStreak++;
        } else {
          if (dateStr !== today.toISOString().slice(0, 10)) {
            break;
          }
        }
        d2.setDate(d2.getDate() - 1);
        if (d2 < firstDate) break;
      }
    }

    // Try to fetch avatar as base64
    let avatarDataUrl = '';
    try {
      const avatarRes = await axios.get(`https://github.com/${user.githubUsername}.png`, {
        responseType: 'arraybuffer',
        timeout: 3000
      });
      const mimeType = avatarRes.headers['content-type'] || 'image/png';
      const base64 = Buffer.from(avatarRes.data).toString('base64');
      avatarDataUrl = `data:${mimeType};base64,${base64}`;
    } catch (err) {
      console.error(`Failed to fetch avatar base64 for ${user.githubUsername}:`, err.message);
      avatarDataUrl = `https://github.com/${user.githubUsername}.png`;
    }

    let taglineStr = user.tagline || 'Combine your heatmaps from GitHub, LeetCode, and Codeforces.';
    if (taglineStr.length > 55) taglineStr = taglineStr.slice(0, 52) + '...';

    const gridMax = Math.max(1, ...grid.map((d) => d.github + d.codeforces + d.leetcode));
    function tierIndex(total) {
      const ratio = total / gridMax;
      if (ratio > 0.75) return 3;
      if (ratio > 0.5) return 2;
      if (ratio > 0.25) return 1;
      return 0;
    }

    // Cell descriptors (position + color) and month-label positions, same
    // math as the old SVG version - just building plain data here instead
    // of concatenating <rect>/<text> strings, since these get turned into
    // absolutely-positioned <div>s below instead.
    const cells = [];
    const monthLabels = [];
    let lastMonth = -1;
    grid.forEach((day, index) => {
      const col = Math.floor(index / 7);
      const row = index % 7;
      const x = 40 + col * 24.3;
      const y = 330 + row * 24.3;

      if (row === 0) {
        const date = new Date(day.date);
        const month = date.getMonth();
        if (month !== lastMonth) {
          monthLabels.push({ text: date.toLocaleString('en-US', { month: 'short' }), x });
          lastMonth = month;
        }
      }

      let fillColor = 'rgba(0, 0, 0, 0.05)';
      const totalVal = day.github + day.codeforces + day.leetcode;
      if (totalVal > 0) {
        const dominant =
          day.github >= day.codeforces && day.github >= day.leetcode
            ? 'github'
            : day.codeforces >= day.leetcode
              ? 'codeforces'
              : 'leetcode';
        fillColor = RAMPS[dominant][tierIndex(totalVal)];
      }
      cells.push({ x, y, fillColor });
    });

    const e = React.createElement;

    // Satori (the engine behind ImageResponse) requires any element with
    // more than one child to declare display: 'flex', even when every
    // child is taken out of flow via position: 'absolute' for exact pixel
    // placement - that's why it shows up on every multi-child node below,
    // not just the ones actually using flex layout for something.
    const abs = (extra) => ({ position: 'absolute', display: 'flex', ...extra });

    function statBlock(x, value, label) {
      return e(
        'div',
        { key: `stat-${x}`, style: abs({ left: x, top: 165, width: 260, flexDirection: 'column', alignItems: 'center' }) },
        e('div', { key: 'v', style: { display: 'flex', fontSize: 36, fontWeight: 800, color: '#000000' } }, String(value)),
        e('div', { key: 'l', style: { display: 'flex', fontSize: 15, fontWeight: 600, color: '#555555', letterSpacing: 0.5, marginTop: 4 } }, label)
      );
    }

    function platformKey(x, color, label) {
      return e(
        'div',
        { key: `pk-${x}`, style: abs({ left: x, top: 548, alignItems: 'center' }) },
        e('div', { key: 'sw', style: { display: 'flex', width: 16, height: 16, borderRadius: 3, background: color, marginRight: 10 } }),
        e('div', { key: 'lb', style: { display: 'flex', fontSize: 15, fontWeight: 700, color: '#555555' } }, label)
      );
    }

    const element = e(
      'div',
      { style: { width: 1200, height: 630, display: 'flex', position: 'relative', background: '#F2EDED', border: '4px solid #000000' } },
      // Avatar ring + image
      e('div', { key: 'ring', style: abs({ left: 41, top: 33, width: 84, height: 84, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.15)' }) }),
      e('img', { key: 'avatar', src: avatarDataUrl, width: 84, height: 84, style: abs({ left: 41, top: 33, width: 84, height: 84, borderRadius: '50%' }) }),
      // Username + tagline
      e('div', { key: 'username', style: abs({ left: 145, top: 38, fontSize: 40, fontWeight: 800, color: '#000000' }) }, user.githubUsername),
      e('div', { key: 'tagline', style: abs({ left: 145, top: 88, fontSize: 22, fontWeight: 500, color: '#333333' }) }, taglineStr),
      // Stat dividers
      e('div', { key: 'div1', style: abs({ left: 320, top: 170, width: 1.5, height: 60, background: 'rgba(0,0,0,0.15)' }) }),
      e('div', { key: 'div2', style: abs({ left: 600, top: 170, width: 1.5, height: 60, background: 'rgba(0,0,0,0.15)' }) }),
      e('div', { key: 'div3', style: abs({ left: 880, top: 170, width: 1.5, height: 60, background: 'rgba(0,0,0,0.15)' }) }),
      // Stats
      statBlock(40, currentStreak, 'CURRENT STREAK'),
      statBlock(320, longestStreak, 'LONGEST STREAK'),
      statBlock(600, totalSubmissions, 'TOTAL ACTIVITY'),
      statBlock(880, activeDaysCount, 'ACTIVE DAYS'),
      // Month labels
      ...monthLabels.map((m, i) => e('div', { key: `month-${i}`, style: abs({ left: m.x, top: 298, fontSize: 14, color: '#666666', fontWeight: 500 }) }, m.text)),
      // Heatmap cells
      ...cells.map((c, i) => e('div', { key: `cell-${i}`, style: abs({ left: c.x, top: c.y, width: 21, height: 21, borderRadius: 3.5, background: c.fillColor }) })),
      // Legend: Less [empty][4 github tiers] More
      e('div', { key: 'less', style: abs({ left: 40, top: 548, fontSize: 14, fontWeight: 600, color: '#666666' }) }, 'Less'),
      e('div', { key: 'sw0', style: abs({ left: 95, top: 545, width: 22, height: 22, borderRadius: 3.5, background: 'rgba(0,0,0,0.05)' }) }),
      e('div', { key: 'sw1', style: abs({ left: 123, top: 545, width: 22, height: 22, borderRadius: 3.5, background: RAMPS.github[0] }) }),
      e('div', { key: 'sw2', style: abs({ left: 151, top: 545, width: 22, height: 22, borderRadius: 3.5, background: RAMPS.github[1] }) }),
      e('div', { key: 'sw3', style: abs({ left: 179, top: 545, width: 22, height: 22, borderRadius: 3.5, background: RAMPS.github[2] }) }),
      e('div', { key: 'sw4', style: abs({ left: 207, top: 545, width: 22, height: 22, borderRadius: 3.5, background: RAMPS.github[3] }) }),
      e('div', { key: 'more', style: abs({ left: 242, top: 548, fontSize: 14, fontWeight: 600, color: '#666666' }) }, 'More'),
      // Platform key
      platformKey(760, RAMPS.github[3], 'GitHub'),
      platformKey(870, RAMPS.codeforces[3], 'Codeforces'),
      platformKey(1016, RAMPS.leetcode[3], 'LeetCode'),
      // Brand
      e('div', { key: 'brand', style: abs({ right: 40, top: 40, fontSize: 26, fontWeight: 800, color: '#000000' }) }, 'vizzible.vercel.app')
    );

    const ImageResponse = await getImageResponseCtor();
    const imageResponse = new ImageResponse(element, { width: 1200, height: 630 });
    const arrayBuffer = await imageResponse.arrayBuffer();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('Error generating OG image:', err);
    return res.status(500).send('Error generating image');
  }
}async function getProfileMetaHTML(req, res) {
  try {
    const user = await findUserByUsername(req.params.username);
    if (!user) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Profile Not Found</title></head>
        <body>Profile Not Found</body>
        </html>
      `);
    }

    const username = escapeXml(user.githubUsername);
    const tagline = escapeXml(user.tagline || 'Combine your heatmaps from GitHub, LeetCode, and Codeforces.');
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    
    const host = req.get('host');
    const protocol = req.protocol;
    const backendUrl = `${protocol}://${host}`;
    
    const ogImageUrl = `${backendUrl}/api/profiles/${user.githubUsername}/og-image`;
    const profileUrl = `${clientUrl}/${user.githubUsername}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${username} — Vizzible</title>
  <meta name="description" content="${tagline}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="profile">
  <meta property="og:url" content="${profileUrl}">
  <meta property="og:title" content="${username} — Vizzible Profile">
  <meta property="og:description" content="${tagline}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${profileUrl}">
  <meta name="twitter:title" content="${username} — Vizzible Profile">
  <meta name="twitter:description" content="${tagline}">
  <meta name="twitter:image" content="${ogImageUrl}">
  
  <!-- Client-side Redirect for humans -->
  <script>
    window.location.replace("${profileUrl}");
  </script>
</head>
<body>
  <p>Redirecting to ${username}'s profile on Vizzible...</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (err) {
    console.error('Error serving meta HTML:', err);
    return res.status(500).send('Server Error');
  }
}

module.exports = { updateProfile, getProfile, getActivity, getProfileOGImage, getProfileMetaHTML };
