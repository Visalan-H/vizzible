export const PLATFORM_KEY = {
  combined: 'total',
  github: 'github',
  leetcode: 'leetcode',
  codeforces: 'codeforces',
};

export const PLATFORM_COLOR = {
  combined: 'var(--ink)',
  github: '#39d353',
  codeforces: '#4a90d9',
  leetcode: '#ffa116',
};

// Deterministic PRNG (mulberry32) - the landing page's demo dashboard
// should look the same on every load/build, not jitter between refreshes.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isWeekend(date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

// Shapes a believable "solid, employed developer" year instead of a flat
// random scatter or a couple of hand-tuned spikes: near-daily GitHub
// activity that's heavier on weekdays, a handful of LeetCode "grind weeks"
// (the bursty way most people actually interview-prep, not a steady daily
// habit), and light, occasional Codeforces contest participation - most
// working developers who touch competitive programming do it now and then,
// not constantly.
export function generateMockData() {
  const rand = mulberry32(20260101);
  const data = [];
  const year = 2026;
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));

  const leetcodeGrindWeeks = new Set([3, 4, 12, 13, 24, 25, 38, 39, 40]);

  const codeforcesContestDays = new Set();
  while (codeforcesContestDays.size < 14) {
    codeforcesContestDays.add(Math.floor(rand() * 365));
  }

  let dayOfYear = 0;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1), dayOfYear++) {
    const dateStr = d.toISOString().slice(0, 10);
    const weekend = isWeekend(d);
    const weekOfYear = Math.floor(dayOfYear / 7);

    let github = 0;
    let leetcode = 0;
    let codeforces = 0;

    // GitHub: active on most weekdays, a fair bit less on weekends, with an
    // occasional heavier push/merge day.
    const githubChance = weekend ? 0.35 : 0.8;
    if (rand() < githubChance) {
      github = 1 + Math.floor(rand() * (weekend ? 4 : 9));
      if (rand() < 0.06) github += Math.floor(rand() * 12);
    }

    // LeetCode: quiet most weeks, bursts during grind weeks.
    if (leetcodeGrindWeeks.has(weekOfYear)) {
      if (rand() < 0.75) leetcode = 1 + Math.floor(rand() * 6);
    } else if (rand() < 0.08) {
      leetcode = 1 + Math.floor(rand() * 2);
    }

    // Codeforces: only on scattered "contest" days, never weekends (most
    // contests run on weekday evenings).
    if (codeforcesContestDays.has(dayOfYear) && !weekend) {
      codeforces = 3 + Math.floor(rand() * 8);
    }

    data.push({
      date: dateStr,
      github,
      leetcode,
      codeforces,
      total: github + leetcode + codeforces,
    });
  }
  return data;
}
