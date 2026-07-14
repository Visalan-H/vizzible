const { z } = require('zod');
const { waitUntil } = require('@vercel/functions');
const axios = require('axios');
const User = require('../models/User');
const DailyActivity = require('../models/DailyActivity');
const { syncUserActivity, isStale } = require('../services/sync');

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

async function getProfileOGImage(req, res) {
  try {
    const user = await User.findOne({ githubUsername: req.params.username });
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

    // Calculate dates for the last 24 weeks (168 days) for the heatmap
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 23 * 7 - today.getDay());
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

    const escapedUsername = escapeXml(user.githubUsername);
    let taglineStr = user.tagline || 'Combine your heatmaps from GitHub, LeetCode, and Codeforces.';
    if (taglineStr.length > 55) taglineStr = taglineStr.slice(0, 52) + '...';
    const escapedTagline = escapeXml(taglineStr);

    let handlesSVG = '';
    let xOffset = 110;
    
    // GitHub
    handlesSVG += `
      <g transform="translate(${xOffset}, 225)">
        <rect width="130" height="36" rx="18" fill="#fafafa" stroke="rgba(0,0,0,0.12)" stroke-width="1" />
        <circle cx="20" cy="18" r="8" fill="#24292f" />
        <text x="36" y="23" class="font-mono" font-size="14" font-weight="600" fill="#24292f">GitHub</text>
      </g>
    `;
    xOffset += 145;
    
    if (user.codeforcesHandle) {
      handlesSVG += `
        <g transform="translate(${xOffset}, 225)">
          <rect width="145" height="36" rx="18" fill="#f4f7fb" stroke="rgba(59, 121, 181, 0.2)" stroke-width="1" />
          <circle cx="20" cy="18" r="8" fill="#3b79b5" />
          <text x="36" y="23" class="font-mono" font-size="14" font-weight="600" fill="#3b79b5">Codeforces</text>
        </g>
      `;
      xOffset += 160;
    }
    
    if (user.leetcodeUsername) {
      handlesSVG += `
        <g transform="translate(${xOffset}, 225)">
          <rect width="140" height="36" rx="18" fill="#fffcf6" stroke="rgba(217, 119, 6, 0.2)" stroke-width="1" />
          <circle cx="20" cy="18" r="8" fill="#d97706" />
          <text x="36" y="23" class="font-mono" font-size="14" font-weight="600" fill="#d97706">LeetCode</text>
        </g>
      `;
    }

    const gridMax = Math.max(1, ...grid.map((d) => d.github + d.codeforces + d.leetcode));
    const RAMPS = {
      github: ['#c6ebd1', '#7bc96f', '#239a3b', '#196127'],
      codeforces: ['#d5e5f5', '#8cb8e0', '#3b79b5', '#224a73'],
      leetcode: ['#ffeacc', '#fcaa3d', '#d97706', '#8a4b00'],
    };
    function tierIndex(total) {
      const ratio = total / gridMax;
      if (ratio > 0.75) return 3;
      if (ratio > 0.5) return 2;
      if (ratio > 0.25) return 1;
      return 0;
    }

    let cellsSVG = '';
    grid.forEach((day, index) => {
      const col = Math.floor(index / 7);
      const row = index % 7;
      const x = 640 + col * 19;
      const y = 200 + row * 19;
      
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
      cellsSVG += `  <rect x="${x}" y="${y}" width="15" height="15" rx="3" fill="${fillColor}" />\n`;
    });

    const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="card-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="24" flood-color="#000000" flood-opacity="0.08" />
    </filter>
    <clipPath id="avatar-clip">
      <circle cx="160" cy="155" r="50" />
    </clipPath>
  </defs>

  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&amp;display=swap');
    .font-mono {
      font-family: 'JetBrains Mono', 'IBM Plex Mono', monospace;
    }
  </style>

  <!-- Canvas Background -->
  <rect width="1200" height="630" fill="#F2EDED" />

  <!-- Floating White Banner Card -->
  <rect x="60" y="60" width="1080" height="510" rx="16" fill="#ffffff" stroke="rgba(0, 0, 0, 0.06)" stroke-width="1.5" filter="url(#card-shadow)" />

  <!-- Vizzible Logo -->
  <text x="1090" y="115" class="font-mono" font-size="28" font-weight="700" fill="#000000" letter-spacing="-1px" text-anchor="end">vizzible</text>
  <circle cx="1103" cy="105" r="5" fill="#30d158" />

  <!-- Left Side: Profile Info -->
  <circle cx="160" cy="155" r="51" fill="none" stroke="rgba(0, 0, 0, 0.08)" stroke-width="2" />
  <image href="${avatarDataUrl}" x="110" y="105" width="100" height="100" clip-path="url(#avatar-clip)" />

  <text x="240" y="145" class="font-mono" font-size="42" font-weight="700" fill="#000000">${escapedUsername}</text>
  <text x="240" y="180" class="font-mono" font-size="18" font-weight="500" fill="#6b7280">${escapedTagline}</text>

  <!-- Handles Pills -->
  ${handlesSVG}

  <!-- Streak Card -->
  <g transform="translate(110, 310)">
    <rect width="470" height="90" rx="12" fill="rgba(0,0,0,0.02)" stroke="rgba(0,0,0,0.08)" stroke-width="1" />
    
    <!-- Current Streak -->
    <circle cx="45" cy="45" r="20" fill="rgba(0,0,0,0.05)" />
    <!-- Fire Icon Base -->
    <path d="M45 31C45 31 51 37 51 43C51 47.5 48 50.5 45 50.5C42 50.5 39 47.5 39 43C39 37 45 31 45 31Z" fill="#ff4500" />
    <!-- Fire Icon Inner -->
    <path d="M45 37C45 37 49 41.5 49 45C49 48 47 50 45 50C43 50 41 48 41 45C41 41.5 45 37 45 37Z" fill="#ffa116" />
    
    <text x="85" y="43" class="font-mono" font-size="26" font-weight="700" fill="#000000">${currentStreak}</text>
    <text x="85" y="65" class="font-mono" font-size="13" font-weight="500" fill="#666666">Day Current Streak</text>
    
    <line x1="235" y1="20" x2="235" y2="70" stroke="rgba(0,0,0,0.08)" stroke-width="1" />

    <!-- Longest Streak -->
    <circle cx="280" cy="45" r="20" fill="rgba(0,0,0,0.05)" />
    <!-- Fire Icon Neutral -->
    <path d="M280 31C280 31 286 37 286 43C286 47.5 283 50.5 280 50.5C277 50.5 274 47.5 274 43C274 37 280 31 280 31Z" fill="#888888" />
    
    <text x="320" y="43" class="font-mono" font-size="26" font-weight="700" fill="#000000">${longestStreak}</text>
    <text x="320" y="65" class="font-mono" font-size="13" font-weight="500" fill="#666666">Day Longest Streak</text>
  </g>

  <!-- Stats Boxes -->
  <g transform="translate(110, 430)">
    <rect width="225" height="85" rx="12" fill="#fafafa" stroke="rgba(0,0,0,0.08)" stroke-width="1" />
    <text x="25" y="45" class="font-mono" font-size="28" font-weight="700" fill="#000000">${totalSubmissions}</text>
    <text x="25" y="65" class="font-mono" font-size="11" font-weight="600" fill="#888888" letter-spacing="0.5">TOTAL ACTIVITY</text>
  </g>

  <g transform="translate(355, 430)">
    <rect width="225" height="85" rx="12" fill="#fafafa" stroke="rgba(0,0,0,0.08)" stroke-width="1" />
    <text x="25" y="45" class="font-mono" font-size="28" font-weight="700" fill="#000000">${activeDaysCount}</text>
    <text x="25" y="65" class="font-mono" font-size="11" font-weight="600" fill="#888888" letter-spacing="0.5">ACTIVE DAYS</text>
  </g>

  <!-- Right Side: Heatmap -->
  <text x="640" y="165" class="font-mono" font-size="13" font-weight="700" fill="#666666" letter-spacing="1">ACTIVITY HEATMAP (LAST 24 WEEKS)</text>
  
  <g>
    ${cellsSVG}
  </g>

  <!-- Legend -->
  <g transform="translate(640, 375)">
    <text x="0" y="12" class="font-mono" font-size="12" font-weight="500" fill="#888888">Less</text>
    <rect x="40" y="1" width="14" height="14" rx="3" fill="rgba(0, 0, 0, 0.05)" />
    <rect x="58" y="1" width="14" height="14" rx="3" fill="#c6ebd1" />
    <rect x="76" y="1" width="14" height="14" rx="3" fill="#7bc96f" />
    <rect x="94" y="1" width="14" height="14" rx="3" fill="#239a3b" />
    <rect x="112" y="1" width="14" height="14" rx="3" fill="#196127" />
    <text x="134" y="12" class="font-mono" font-size="12" font-weight="500" fill="#888888">More</text>
  </g>

  <!-- Platforms Key -->
  <g transform="translate(640, 405)">
    <rect x="0" y="2" width="12" height="12" rx="3" fill="#196127" />
    <text x="18" y="13" class="font-mono" font-size="12" font-weight="500" fill="#666666">GitHub</text>
    
    <rect x="85" y="2" width="12" height="12" rx="3" fill="#3b79b5" />
    <text x="103" y="13" class="font-mono" font-size="12" font-weight="500" fill="#666666">Codeforces</text>
    
    <rect x="195" y="2" width="12" height="12" rx="3" fill="#d97706" />
    <text x="213" y="13" class="font-mono" font-size="12" font-weight="500" fill="#666666">LeetCode</text>
  </g>

</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return res.send(svg);
  } catch (err) {
    console.error('Error generating OG image:', err);
    return res.status(500).send('Error generating image');
  }
}async function getProfileMetaHTML(req, res) {
  try {
    const user = await User.findOne({ githubUsername: req.params.username });
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
