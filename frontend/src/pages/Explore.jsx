import { useState } from 'react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import CategoryToggle from '../components/CategoryToggle';
import LeaderboardRow from '../components/LeaderboardRow';
import './Explore.css';

const CATEGORIES = [
  { value: 'streakCurrent', label: 'Current streak', shortLabel: 'Streak' },
  { value: 'streakLongest', label: 'Longest streak', shortLabel: 'Best' },
  { value: 'activityThisYear', label: 'This year', shortLabel: 'Year' },
  { value: 'activityAllTime', label: 'All time', shortLabel: 'All' },
];

// Ranked, paginated leaderboard across a few categories (PLAN.md §2). The
// query itself is trivial - GET /api/leaderboard is a single indexed
// User.find().sort().skip().limit(), no live cross-user aggregation - the
// heavy lifting already happened at sync time (see backend/utils/
// leaderboardStats.js).
export default function Explore() {
  const [category, setCategory] = useState('streakCurrent');
  const { results, loading, loadingMore, hasMore, loadMore } = useLeaderboard(category);

  return (
    <section className="explore">
      <header className="explore-header">
        <h1>Explore</h1>
        <p className="explore-subtitle">Top profiles, ranked.</p>
      </header>

      <CategoryToggle options={CATEGORIES} value={category} onChange={setCategory} />

      {loading ? (
        <p className="state-msg">Loading...</p>
      ) : results.length === 0 ? (
        <p className="state-msg">No profiles on the leaderboard yet.</p>
      ) : (
        <ol className="leaderboard-list">
          {results.map((row) => (
            <LeaderboardRow key={row.githubUsername} row={row} category={category} />
          ))}
        </ol>
      )}

      {hasMore && (
        <button type="button" className="btn-secondary explore-load-more" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}
    </section>
  );
}
