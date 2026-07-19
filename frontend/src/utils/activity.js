// The backend only stores rows for days that had activity. Filling in
// every day of Jan 1 - Dec 31 for the selected year (even for the current,
// still-in-progress year - future days just render empty) means every
// cell is clickable, the grid shape is consistent across years, and
// month-highlighting/stats have a full, evenly-spaced year to work with.
//
// Extracted out of Profile.jsx so Compare.jsx (which needs this run once
// per side, against a shared platform/year selection) uses the exact same
// logic rather than a second, driftable copy.
export function buildDenseValues(activity, platformKey, year) {
  const byDate = new Map(activity.map((day) => [day.date, day]));
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));

  const days = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const date = d.toISOString().slice(0, 10);
    const day = byDate.get(date) ?? { date, github: 0, codeforces: 0, leetcode: 0, total: 0 };
    days.push({ ...day, count: day[platformKey] });
  }
  return days;
}
