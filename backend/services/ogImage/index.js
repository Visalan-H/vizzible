const axios = require('axios');
const { RAMPS } = require('./colorRamp');
const { buildOGImageElement, getImageResponseCtor } = require('./render');
const { computeStreaks } = require('../../utils/streaks');

function tierIndex(total, gridMax) {
  const ratio = total / gridMax;
  if (ratio > 0.75) return 3;
  if (ratio > 0.5) return 2;
  if (ratio > 0.25) return 1;
  return 0;
}

async function fetchAvatarDataUrl(githubUsername) {
  try {
    const avatarRes = await axios.get(`https://github.com/${githubUsername}.png`, {
      responseType: 'arraybuffer',
      timeout: 3000,
    });
    const mimeType = avatarRes.headers['content-type'] || 'image/png';
    const base64 = Buffer.from(avatarRes.data).toString('base64');
    return `data:${mimeType};base64,${base64}`;
  } catch (err) {
    console.error(`Failed to fetch avatar base64 for ${githubUsername}:`, err.message);
    return `https://github.com/${githubUsername}.png`;
  }
}

// Renders a user's public share-preview PNG (the og:image on their profile
// link). `rows` are the raw DailyActivity docs for this user, fetched by
// the caller (profileController) - this stays focused on turning that data
// into an image rather than also owning the DB query.
async function renderProfileOGImage(user, rows) {
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

  // byDate can contain entries for days with zero total activity (a day
  // where every platform reported 0 that day still gets a map entry - see
  // the GitHub connector fix for why). byDate.size alone would count those
  // as "active", so this filters to days that actually had activity.
  const activeDaysCount = [...byDate.values()].filter((d) => d.total > 0).length;

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
    grid.push({ date: dateStr, ...entry });
    temp.setDate(temp.getDate() + 1);
  }

  const { currentStreak, longestStreak } = computeStreaks(byDate, today);

  const avatarDataUrl = await fetchAvatarDataUrl(user.githubUsername);

  let taglineStr = user.tagline || 'Combine your heatmaps from GitHub, LeetCode, and Codeforces.';
  if (taglineStr.length > 55) taglineStr = taglineStr.slice(0, 52) + '...';

  const gridMax = Math.max(1, ...grid.map((d) => d.github + d.codeforces + d.leetcode));

  // Cell descriptors (position + color) and month-label positions - same
  // math as the old SVG version, just building plain data here instead of
  // concatenating <rect>/<text> strings, since these get turned into
  // absolutely-positioned <div>s by render.js instead.
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
      fillColor = RAMPS[dominant][tierIndex(totalVal, gridMax)];
    }
    cells.push({ x, y, fillColor });
  });

  const element = buildOGImageElement({
    avatarDataUrl,
    username: user.githubUsername,
    taglineStr,
    currentStreak,
    longestStreak,
    totalSubmissions,
    activeDaysCount,
    monthLabels,
    cells,
  });

  const ImageResponse = await getImageResponseCtor();
  const imageResponse = new ImageResponse(element, { width: 1200, height: 630 });
  const arrayBuffer = await imageResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = { renderProfileOGImage };
