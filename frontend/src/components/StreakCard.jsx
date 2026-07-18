import CountUp from './CountUp';
import './StreakCard.css';

const PLATFORM_LABELS = { combined: 'combined', github: 'GitHub', codeforces: 'Codeforces', leetcode: 'LeetCode' };

function FlameIcon({ style }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={style}>
      <path d="M12 22c4 0 6-2.5 6-6.5 0-3-1.8-5-3-7 0 2-1 3-2 3-.5-2.5.5-5-1-8-1 3-4 5-4 9 0 1 .3 2 1 3-1-.3-2-1-2.5-2.3C5.5 17 6 22 12 22z" />
    </svg>
  );
}

// Always-visible stat card (unlike MonthDetail/DayDetail, which only
// appear once a month/day is clicked) - streaks are a headline number for
// this app, worth surfacing without an interaction.
export default function StreakCard({ current, longest, platform, color }) {
  const label = PLATFORM_LABELS[platform];
  const isLit = current > 0;

  // Translucent background color for the badges based on active status and platform
  const badgeBg = isLit 
    ? (platform === 'combined' ? 'var(--surface-card)' : `${color}20`)
    : 'var(--surface-soft)';

  const longestBadgeBg = longest > 0
    ? (platform === 'combined' ? 'var(--surface-card)' : `${color}15`)
    : 'var(--surface-soft)';

  return (
    <div className="streak-card">
      <div className="streak-card-stat">
        <div className="streak-flame-badge" style={{ backgroundColor: badgeBg }}>
          <FlameIcon style={{ color: isLit ? color : 'var(--text-ash)' }} />
        </div>
        <div className="streak-card-stat-text">
          <span className="streak-card-stat-value"><CountUp value={current} /></span>
          <span className="streak-card-stat-label">
            day current streak{platform !== 'combined' ? ` · ${label}` : ''}
          </span>
        </div>
      </div>

      <div className="streak-card-divider" />

      <div className="streak-card-stat">
        <div className="streak-flame-badge" style={{ backgroundColor: longestBadgeBg }}>
          <FlameIcon style={{ color: longest > 0 ? (platform === 'combined' ? 'var(--text-body)' : color) : 'var(--text-ash)' }} />
        </div>
        <div className="streak-card-stat-text">
          <span className="streak-card-stat-value"><CountUp value={longest} /></span>
          <span className="streak-card-stat-label">day longest streak</span>
        </div>
      </div>
    </div>
  );
}
