// Extracted so getProfileOGImage's streak math isn't buried inside the
// image-rendering pipeline - this is plain date arithmetic and has nothing
// to do with how the result gets drawn.
//
// byDate maps 'YYYY-MM-DD' -> an object with a `total` field (> 0 means
// active that day). `today` is passed in rather than read internally so
// this stays a pure function - easy to test with a fixed date.
function computeStreaks(byDate, today) {
  const allDates = Array.from(byDate.keys()).sort();
  let currentStreak = 0;
  let longestStreak = 0;

  if (allDates.length === 0) {
    return { currentStreak, longestStreak };
  }

  const firstDate = new Date(allDates[0]);
  let tempStreak = 0;
  const d = new Date(firstDate);
  while (d <= today) {
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
  while (true) {
    const dateStr = d2.toISOString().slice(0, 10);
    const entry = byDate.get(dateStr);
    if (entry && entry.total > 0) {
      currentStreak++;
    } else if (dateStr !== today.toISOString().slice(0, 10)) {
      break;
    }
    d2.setDate(d2.getDate() - 1);
    if (d2 < firstDate) break;
  }

  return { currentStreak, longestStreak };
}

module.exports = { computeStreaks };
