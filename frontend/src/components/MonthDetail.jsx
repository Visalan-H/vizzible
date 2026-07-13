import './MonthDetail.css';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const PLATFORM_LABELS = { github: 'GitHub', codeforces: 'Codeforces', leetcode: 'LeetCode' };
const PLATFORM_UNITS = { github: 'contribution', codeforces: 'submission', leetcode: 'submission' };

function pluralize(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function formatDay(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// days: dense per-day rows for just the selected month, each already
// carrying github/codeforces/leetcode/total regardless of which platform
// tab is active - same shape Heatmap's `values` items have.
export default function MonthDetail({ days, month, year, onClose }) {
  const totals = days.reduce(
    (acc, d) => {
      acc.github += d.github;
      acc.codeforces += d.codeforces;
      acc.leetcode += d.leetcode;
      acc.total += d.total;
      return acc;
    },
    { github: 0, codeforces: 0, leetcode: 0, total: 0 }
  );

  const activeDays = days.filter((d) => d.total > 0).length;
  const busiest = days.reduce((max, d) => (d.total > (max?.total ?? 0) ? d : max), null);

  const lines = Object.keys(PLATFORM_LABELS).reduce((acc, p) => {
    if (totals[p] > 0) acc.push(`${pluralize(totals[p], PLATFORM_UNITS[p])} on ${PLATFORM_LABELS[p]}`);
    return acc;
  }, []);

  return (
    <div className="month-detail">
      <button type="button" className="month-detail-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <p className="month-detail-title">{MONTH_NAMES[month]} {year}</p>

      <div className="month-detail-stats">
        <div className="month-detail-stat">
          <span className="month-detail-stat-value">{totals.total}</span>
          <span className="month-detail-stat-label">activity points</span>
        </div>
        <div className="month-detail-stat">
          <span className="month-detail-stat-value">{activeDays}/{days.length}</span>
          <span className="month-detail-stat-label">active days</span>
        </div>
      </div>

      {lines.length > 0 ? (
        <ul className="month-detail-list">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="month-detail-empty">No activity this month.</p>
      )}

      {busiest && busiest.total > 0 && (
        <p className="month-detail-busiest">
          Busiest day: {formatDay(busiest.date)} ({pluralize(busiest.total, 'point')})
        </p>
      )}
    </div>
  );
}
