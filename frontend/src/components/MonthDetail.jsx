import CountUp from './CountUp';
import { PLATFORM_KEY } from '../utils/platformColors';
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
// tab is active - same shape Heatmap's `values` items have. `platform` is
// the currently selected tab: 'combined' reports across all 3 platforms
// (as before); a single platform reports only that platform's own counts,
// same convention DayDetail already follows.
export default function MonthDetail({ days, month, year, platform, onClose }) {
  const field = PLATFORM_KEY[platform]; // 'total' for combined, else 'github'/'codeforces'/'leetcode'

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
  const effectiveTotal = totals[field];

  const activeDays = days.filter((d) => d[field] > 0).length;
  const busiest = days.reduce((max, d) => (d[field] > (max?.[field] ?? 0) ? d : max), null);

  const lines =
    platform === 'combined'
      ? Object.keys(PLATFORM_LABELS).reduce((acc, p) => {
          if (totals[p] > 0) acc.push(`${pluralize(totals[p], PLATFORM_UNITS[p])} on ${PLATFORM_LABELS[p]}`);
          return acc;
        }, [])
      : totals[platform] > 0
        ? [`${pluralize(totals[platform], PLATFORM_UNITS[platform])} on ${PLATFORM_LABELS[platform]}`]
        : [];

  return (
    <div className="month-detail">
      <button type="button" className="month-detail-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <p className="month-detail-title">{MONTH_NAMES[month]} {year}</p>

      <div className="month-detail-stats">
        <div className="month-detail-stat">
          <span className="month-detail-stat-value"><CountUp value={effectiveTotal} /></span>
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

      {busiest && busiest[field] > 0 && (
        <p className="month-detail-busiest">
          Busiest day: {formatDay(busiest.date)} ({pluralize(busiest[field], 'point')})
        </p>
      )}
    </div>
  );
}
