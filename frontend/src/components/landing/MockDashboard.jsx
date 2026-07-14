import { useMemo, useState } from 'react';
import PlatformToggle from '../PlatformToggle';
import YearSelector from '../YearSelector';
import ActivityBoard from '../ActivityBoard';
import StreakCard from '../StreakCard';
import PlatformLegend from '../PlatformLegend';
import ProfileLinks from '../ProfileLinks';
import { PLATFORM_KEY, PLATFORM_COLORS } from '../../utils/platformColors';
import { computeStreaks } from '../../utils/streaks';
import { generateMockData } from '../../utils/mockData';

const MOCK_LINKS = [
  { label: 'GitHub', url: 'https://github.com/your-username' },
  { label: 'Codeforces', url: 'https://codeforces.com/profile/your-username' },
  { label: 'LeetCode', url: 'https://leetcode.com/u/your-username/' },
  { label: 'Portfolio', url: 'https://your-portfolio.me' },
  { label: 'LinkedIn', url: 'https://linkedin.com/in/your-username' },
];

const START_DATE = new Date(Date.UTC(2026, 0, 1));
const END_DATE = new Date(Date.UTC(2026, 11, 31));

// Self-contained "sandbox" version of the real Profile page, used as the
// hero asset on the landing page so visitors can interact with the product
// before signing in - none of this state or data touches the backend.
//
// Reuses the same ActivityBoard used on the real Profile page: it owns the
// hover/click selection state internally, so hovering a day here re-renders
// only ActivityBoard's subtree - not the platform toggle, year selector, or
// profile links above it.
export default function MockDashboard() {
  const [platform, setPlatform] = useState('combined');

  const mockData = useMemo(() => generateMockData(), []);

  const values = useMemo(() => {
    const key = PLATFORM_KEY[platform];
    return mockData.map((d) => ({ ...d, count: d[key] }));
  }, [mockData, platform]);

  const total = useMemo(() => values.reduce((sum, v) => sum + v.count, 0), [values]);

  const streaks = useMemo(() => computeStreaks(mockData, PLATFORM_KEY[platform]), [mockData, platform]);

  return (
    <div
      id="demo"
      className="profile mock-profile-demo"
      style={{ width: '100%', maxWidth: '900px', margin: '48px auto 0 auto' }}
    >
      <header className="profile-header">
        <div
          className="avatar avatar-lg"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--ink)',
            color: 'var(--canvas)',
            fontWeight: 700,
            fontSize: '20px',
            userSelect: 'none',
          }}
        >
          YN
        </div>
        <div className="profile-header-text">
          <h1>Your Name</h1>
          <p className="profile-tagline">Your tagline goes here</p>
        </div>
      </header>

      <p className="profile-bio">A brief description of your coding profile, handles, and achievements.</p>

      <ProfileLinks links={MOCK_LINKS} />

      <div className="controls-row">
        <PlatformToggle value={platform} onChange={setPlatform} />
        <YearSelector years={[2026]} value={2026} onChange={() => {}} />
      </div>

      <StreakCard
        current={streaks.current}
        longest={streaks.longest}
        platform={platform}
        color={PLATFORM_COLORS[platform]}
      />

      <div className="activity-summary-bar">
        <p className="activity-total">
          {total} activity {total === 1 ? 'point' : 'points'} in 2026
          {streaks.current > 0 && (
            <span className="streak-inline" style={{ color: PLATFORM_COLORS[platform] }}>
              · {streaks.current} day streak
            </span>
          )}
        </p>
        <p className="activity-hint">Click a month label to see stats · hover a day for details</p>
      </div>

      {platform === 'combined' && <PlatformLegend />}

      <ActivityBoard
        key={platform}
        values={values}
        color={PLATFORM_COLORS[platform]}
        startDate={START_DATE}
        endDate={END_DATE}
        year={2026}
        platform={platform}
      />
    </div>
  );
}
