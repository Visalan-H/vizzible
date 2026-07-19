const DAY_MS = 24 * 60 * 60 * 1000;

// 'YYYY-MM-DD' -> integer day number since the Unix epoch, always parsed
// as UTC. All streak arithmetic below works in these day numbers instead
// of mutating Date objects - Date's getDate()/setDate() read and write in
// the host's LOCAL time zone, while the 'YYYY-MM-DD' keys in byDate are
// UTC-normalized (GitHub's calendar is already UTC-bucketed, and the
// Codeforces/LeetCode connectors both write toISOString().slice(0,10) -
// see saveActivity in services/sync.js). Mixing UTC-parsed values with
// local-time mutation meant this could silently drift by a day depending
// on the server's local time zone offset - now consumed by the
// leaderboard's persisted streakCurrent/streakLongest (PLAN.md §2.5), not
// just a single OG image rendered on demand, so getting this right
// matters more than it used to. Mirrors the frontend's identical
// (already-correct) version in src/utils/streaks.js.
function toUTCDayNumber(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

function todayUTCDayNumber(today) {
  return Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) / DAY_MS;
}

// byDate maps 'YYYY-MM-DD' -> an object with a `total` field (> 0 means
// active that day). `today` is passed in rather than read internally so
// this stays a pure function - easy to test with a fixed date.
function computeStreaks(byDate, today) {
  const activeDays = [...byDate.entries()]
    .filter(([, entry]) => entry.total > 0)
    .map(([date]) => toUTCDayNumber(date))
    .sort((a, b) => a - b);

  if (activeDays.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  let longestStreak = 1;
  let run = 1;
  for (let i = 1; i < activeDays.length; i++) {
    run = activeDays[i] - activeDays[i - 1] === 1 ? run + 1 : 1;
    if (run > longestStreak) longestStreak = run;
  }

  // A streak is still "current" if the most recent active day is today or
  // yesterday - yesterday counts so a visitor checking their profile before
  // logging today's activity doesn't see their streak reset to 0 at the
  // stroke of midnight.
  const lastActive = activeDays[activeDays.length - 1];
  const gapFromToday = todayUTCDayNumber(today) - lastActive;

  let currentStreak = 0;
  if (gapFromToday <= 1) {
    currentStreak = 1;
    for (let i = activeDays.length - 1; i > 0; i--) {
      if (activeDays[i] - activeDays[i - 1] === 1) currentStreak += 1;
      else break;
    }
  }

  return { currentStreak, longestStreak };
}

module.exports = { computeStreaks };
