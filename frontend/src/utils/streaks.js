const DAY_MS = 24 * 60 * 60 * 1000;

// activity dates are 'YYYY-MM-DD' strings written by the backend from
// UTC-normalized data (GitHub's calendar is already UTC-bucketed, and the
// Codeforces/LeetCode connectors both write toISOString().slice(0,10)) -
// parsing/comparing in UTC here keeps "today" and day-gaps consistent with
// what the backend actually stored, regardless of the visitor's own
// timezone or DST.
function toUTCDayNumber(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

function todayUTCDayNumber() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / DAY_MS;
}

// activity: the sparse [{date, github, codeforces, leetcode, total}] array
// from GET /activity - only days with at least one platform's count are
// present at all, so "consecutive" has to be measured by day-number gaps
// between entries, not by array adjacency.
// platformKey: 'total' | 'github' | 'codeforces' | 'leetcode'
export function computeStreaks(activity, platformKey) {
  if (!activity || activity.length === 0) return { current: 0, longest: 0 };

  const activeDays = activity
    .filter((day) => day[platformKey] > 0)
    .map((day) => toUTCDayNumber(day.date))
    .sort((a, b) => a - b);

  if (activeDays.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < activeDays.length; i++) {
    run = activeDays[i] - activeDays[i - 1] === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  // A streak is still "current" if the most recent active day is today or
  // yesterday - yesterday counts so a visitor checking their profile before
  // logging today's activity doesn't see their streak reset to 0 at the
  // stroke of midnight.
  const lastActive = activeDays[activeDays.length - 1];
  const gapFromToday = todayUTCDayNumber() - lastActive;

  let current = 0;
  if (gapFromToday <= 1) {
    current = 1;
    for (let i = activeDays.length - 1; i > 0; i--) {
      if (activeDays[i] - activeDays[i - 1] === 1) current += 1;
      else break;
    }
  }

  return { current, longest };
}
