import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import CountUp from './CountUp';
import './LeaderboardRow.css';

const CATEGORY_UNIT = {
  streakCurrent: 'day streak',
  streakLongest: 'day best',
  activityThisYear: 'points this year',
  activityAllTime: 'points all time',
};

function CompareIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="M16 21l4-4-4-4" />
      <path d="M20 17H4" />
    </svg>
  );
}

// Each row links straight to that profile - the leaderboard is just a
// ranked index into profiles that already exist and are already public
// (PLAN.md §2.4), nothing new is exposed here. Signed-in visitors also get
// a one-click link into Compare against whoever's signed in (PLAN.md
// §2.7's "cheap addition once both features are live" - both are, so it's
// wired up now rather than deferred).
export default function LeaderboardRow({ row, category }) {
  const { user } = useAuth();
  const canCompare = user && user.githubUsername.toLowerCase() !== row.githubUsername.toLowerCase();

  return (
    <li className="leaderboard-row">
      <span className="leaderboard-rank">{row.rank}</span>
      <img
        src={`https://github.com/${row.githubUsername}.png`}
        alt=""
        className="avatar leaderboard-avatar"
        width="32"
        height="32"
      />
      <Link to={`/${row.githubUsername}`} className="leaderboard-username">
        {row.githubUsername}
      </Link>
      <span className="leaderboard-value">
        <CountUp value={row.value} />
        <span className="leaderboard-unit">{CATEGORY_UNIT[category]}</span>
      </span>
      {canCompare && (
        <Link
          to={`/compare/${encodeURIComponent(user.githubUsername)}/${encodeURIComponent(row.githubUsername)}`}
          className="leaderboard-compare-link"
          title={`Compare with ${row.githubUsername}`}
        >
          <CompareIcon />
        </Link>
      )}
    </li>
  );
}
