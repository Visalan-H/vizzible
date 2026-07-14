const { z } = require('zod');
const { waitUntil } = require('@vercel/functions');
const axios = require('axios');
const { Resvg } = require('@resvg/resvg-js');
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

    const escapedUsername = escapeXml(user.githubUsername);
    let taglineStr = user.tagline || 'Combine your heatmaps from GitHub, LeetCode, and Codeforces.';
    if (taglineStr.length > 55) taglineStr = taglineStr.slice(0, 52) + '...';
    const escapedTagline = escapeXml(taglineStr);



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

    // Dynamic month labels & cell grid SVG
    let cellsSVG = '';
    const monthLabels = [];
    let lastMonth = -1;
    
    grid.forEach((day, index) => {
      const col = Math.floor(index / 7);
      const row = index % 7;
      const x = 40 + col * 24.3; // Spread slightly to use 1120px width
      const y = 330 + row * 24.3;
      
      // Collect month labels at column transitions
      if (row === 0) {
        const date = new Date(day.date);
        const month = date.getMonth();
        if (month !== lastMonth) {
          const monthName = date.toLocaleString('en-US', { month: 'short' });
          monthLabels.push({ text: monthName, x });
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
      cellsSVG += `  <rect x="${x}" y="${y}" width="21" height="21" rx="3.5" fill="${fillColor}" />\n`;
    });

    let monthsSVG = '';
    monthLabels.forEach((label) => {
      monthsSVG += `<text x="${label.x}" y="315" class="font-mono" font-size="16" fill="#666666" font-weight="500">${label.text}</text>\n`;
    });

    const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="avatar-clip">
      <circle cx="83" cy="75" r="40" />
    </clipPath>
  </defs>

  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&amp;display=swap');
    
    .font-mono {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
    }
  </style>

  <!-- Solid Canvas Background matching site theme exactly -->
  <rect width="1200" height="630" fill="#F2EDED" stroke="#000000" stroke-width="4" />

  <!-- Profile Info Header -->
  <circle cx="83" cy="75" r="42" fill="none" stroke="rgba(0, 0, 0, 0.15)" stroke-width="2" />
  <image href="${avatarDataUrl}" x="41" y="33" width="84" height="84" clip-path="url(#avatar-clip)" />

  <text x="145" y="68" class="font-mono" font-size="42" font-weight="800" fill="#000000" letter-spacing="-1px">${escapedUsername}</text>
  <text x="145" y="105" class="font-mono" font-size="24" font-weight="500" fill="#333333">${escapedTagline}</text>

  <!-- Clean Stats Row (No Box) -->
  <g transform="translate(40, 165)">
    <!-- Dividers -->
    <line x1="280" y1="5" x2="280" y2="65" stroke="rgba(0, 0, 0, 0.15)" stroke-width="1.5" />
    <line x1="560" y1="5" x2="560" y2="65" stroke="rgba(0, 0, 0, 0.15)" stroke-width="1.5" />
    <line x1="840" y1="5" x2="840" y2="65" stroke="rgba(0, 0, 0, 0.15)" stroke-width="1.5" />
    
    <!-- Current Streak -->
    <text x="140" y="38" class="font-mono" font-size="38" font-weight="800" fill="#000000" text-anchor="middle">${currentStreak}</text>
    <text x="140" y="68" class="font-mono" font-size="18" font-weight="600" fill="#555555" text-anchor="middle" letter-spacing="0.5px">CURRENT STREAK</text>
    
    <!-- Longest Streak -->
    <text x="420" y="38" class="font-mono" font-size="38" font-weight="800" fill="#000000" text-anchor="middle">${longestStreak}</text>
    <text x="420" y="68" class="font-mono" font-size="18" font-weight="600" fill="#555555" text-anchor="middle" letter-spacing="0.5px">LONGEST STREAK</text>
    
    <!-- Total Activity -->
    <text x="700" y="38" class="font-mono" font-size="38" font-weight="800" fill="#000000" text-anchor="middle">${totalSubmissions}</text>
    <text x="700" y="68" class="font-mono" font-size="18" font-weight="600" fill="#555555" text-anchor="middle" letter-spacing="0.5px">TOTAL ACTIVITY</text>
    
    <!-- Active Days -->
    <text x="980" y="38" class="font-mono" font-size="38" font-weight="800" fill="#000000" text-anchor="middle">${activeDaysCount}</text>
    <text x="980" y="68" class="font-mono" font-size="18" font-weight="600" fill="#555555" text-anchor="middle" letter-spacing="0.5px">ACTIVE DAYS</text>
  </g>

  <!-- Month labels -->
  ${monthsSVG}
  
  <!-- Cells grid -->
  <g>
    ${cellsSVG}
  </g>

  <!-- Legend -->
  <g transform="translate(40, 545)">
    <text x="0" y="16" class="font-mono" font-size="16" font-weight="600" fill="#666666">Less</text>
    <rect x="55" y="0" width="22" height="22" rx="3.5" fill="rgba(0, 0, 0, 0.05)" />
    <rect x="83" y="0" width="22" height="22" rx="3.5" fill="#c6ebd1" />
    <rect x="111" y="0" width="22" height="22" rx="3.5" fill="#7bc96f" />
    <rect x="139" y="0" width="22" height="22" rx="3.5" fill="#239a3b" />
    <rect x="167" y="0" width="22" height="22" rx="3.5" fill="#196127" />
    <text x="202" y="16" class="font-mono" font-size="16" font-weight="600" fill="#666666">More</text>
  </g>

  <!-- Platforms Key -->
  <g transform="translate(760, 545)">
    <rect x="0" y="3" width="16" height="16" rx="3" fill="#196127" />
    <text x="26" y="16" class="font-mono" font-size="16" font-weight="700" fill="#555555">GitHub</text>
    
    <rect x="110" y="3" width="16" height="16" rx="3" fill="#3b79b5" />
    <text x="136" y="16" class="font-mono" font-size="16" font-weight="700" fill="#555555">Codeforces</text>
    
    <rect x="256" y="3" width="16" height="16" rx="3" fill="#d97706" />
    <text x="282" y="16" class="font-mono" font-size="16" font-weight="700" fill="#555555">LeetCode</text>
  </g>

  <!-- Brand branding at the top-right for clean space -->
  <text x="1160" y="68" class="font-mono" font-size="32" font-weight="800" fill="#000000" letter-spacing="-1px" text-anchor="end">vizzible.vercel.app</text>
</svg>`;

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');

    // WhatsApp's crawler (and several other unfurlers) silently ignore an
    // SVG og:image - no error, just a text-only preview with no thumbnail
    // - so this is rasterized to PNG rather than sent as-is. resvg (not
    // sharp) specifically: it's the same SVG-to-PNG rasterizer Vercel's own
    // @vercel/og tooling uses, and it's a much smaller native dependency
    // than sharp+libvips - sharp has an open, unresolved issue as of mid-
    // 2026 (lovell/sharp#4543) where Vercel's file tracer fails to bundle
    // its nested platform binary for non-Next.js frameworks like this one.
    const resvg = new Resvg(svg);
    const pngBuffer = resvg.render().asPng();
    return res.send(pngBuffer);
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
