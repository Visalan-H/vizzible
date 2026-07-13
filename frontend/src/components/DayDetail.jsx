import './DayDetail.css';

const PLATFORM_LABELS = { github: 'GitHub', codeforces: 'Codeforces', leetcode: 'LeetCode' };
const PLATFORM_UNITS = { github: 'contribution', codeforces: 'submission', leetcode: 'submission' };

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function pluralize(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

// platform is the currently selected tab: 'combined' shows a line per
// platform that had activity that day; a single platform shows just its own count.
export default function DayDetail({ day, platform, onClose }) {
  const lines =
    platform === 'combined'
      ? Object.keys(PLATFORM_LABELS).reduce((acc, p) => {
          if (day[p] > 0) acc.push(`${pluralize(day[p], PLATFORM_UNITS[p])} on ${PLATFORM_LABELS[p]}`);
          return acc;
        }, [])
      : day[platform] > 0
        ? [`${pluralize(day[platform], PLATFORM_UNITS[platform])} on ${PLATFORM_LABELS[platform]}`]
        : [];

  return (
    <div className="day-detail">
      <button type="button" className="day-detail-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <p className="day-detail-date">{formatDate(day.date)}</p>
      {lines.length > 0 ? (
        <ul className="day-detail-list">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="day-detail-empty">No activity that day.</p>
      )}
    </div>
  );
}
