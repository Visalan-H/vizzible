// Single source of truth for platform colors - Profile.jsx (tab styling,
// legend), Heatmap.jsx (per-cell dominant-platform coloring in the combined
// view), and MockDashboard.jsx (landing page demo) all import this instead
// of keeping their own copies, so they can't silently drift out of sync.
export const PLATFORM_COLORS = {
  combined: 'var(--ink)',
  github: '#39d353',
  codeforces: '#4a90d9',
  leetcode: '#ffa116',
};

// Maps a platform tab to the field name on an activity-day object that
// holds that platform's count.
export const PLATFORM_KEY = {
  combined: 'total',
  github: 'github',
  codeforces: 'codeforces',
  leetcode: 'leetcode',
};

// Given a day's per-platform breakdown, which platform contributed the
// most that day. Ties resolve github > codeforces > leetcode - arbitrary,
// but consistent, and ties are rare enough (exact equal counts across
// platforms) that any fixed tiebreak is fine.
export function dominantPlatform(day) {
  const { github = 0, codeforces = 0, leetcode = 0 } = day;
  if (github >= codeforces && github >= leetcode) return 'github';
  if (codeforces >= leetcode) return 'codeforces';
  return 'leetcode';
}
