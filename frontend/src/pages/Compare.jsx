import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCompareProfiles } from '../hooks/useCompareProfiles';
import PlatformToggle from '../components/PlatformToggle';
import YearSelector from '../components/YearSelector';
import ActivityBoard from '../components/ActivityBoard';
import PlatformLegend from '../components/PlatformLegend';
import { computeStreaks } from '../utils/streaks';
import { buildDenseValues } from '../utils/activity';
import { PLATFORM_COLORS, PLATFORM_KEY } from '../utils/platformColors';
import './Compare.css';

const CURRENT_YEAR = new Date().getFullYear();

// Two profiles' heatmaps and stats side by side (PLAN.md §1). No new
// backend endpoint - both sides reuse GET /api/profiles/:username and
// /:username/activity exactly as Profile.jsx does, via useCompareProfiles.
export default function Compare() {
  const { userA, userB } = useParams();

  // Same-user guard (PLAN.md §1.4) - checked before any fetch happens, so
  // /compare/alice/alice never even asks the backend for the redundant
  // second copy of alice's data.
  const isSameUser = userA && userB && userA.toLowerCase() === userB.toLowerCase();

  // Bare /compare (no params) or a blocked same-user URL both fall back to
  // the picker - the form pre-fills whatever was actually typed so fixing
  // a same-user mistake is a one-field edit, not starting over.
  if (!userA || !userB || isSameUser) {
    return (
      <section className="compare-page">
        <CompareForm
          initialA={userA || ''}
          initialB={isSameUser ? '' : userB || ''}
          error={isSameUser ? 'Pick two different profiles to compare.' : null}
        />
      </section>
    );
  }

  return <CompareContent userA={userA} userB={userB} />;
}

function CompareContent({ userA, userB }) {
  const { left, right, loading, error } = useCompareProfiles(userA, userB);
  const [platform, setPlatform] = useState('combined');
  const [year, setYear] = useState(CURRENT_YEAR);

  const bothMissing = !loading && left?.notFound && right?.notFound;

  useEffect(() => {
    if (bothMissing) return;
    const leftName = left?.profile?.githubUsername ?? userA;
    const rightName = right?.profile?.githubUsername ?? userB;
    document.title = `${leftName} vs ${rightName} — Vizzible`;
    return () => {
      document.title = 'Vizzible — Make your coding Vizzible';
    };
  }, [left, right, userA, userB, bothMissing]);

  const availableYears = useMemo(() => {
    const years = new Set([
      ...(left?.activity?.map((day) => Number(day.date.slice(0, 4))) ?? []),
      ...(right?.activity?.map((day) => Number(day.date.slice(0, 4))) ?? []),
    ]);
    years.add(CURRENT_YEAR);
    return [...years].sort((a, b) => b - a);
  }, [left, right]);

  const yearBounds = useMemo(
    () => ({ start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year, 11, 31)) }),
    [year]
  );

  const leftValues = useMemo(
    () => (left?.activity ? buildDenseValues(left.activity, PLATFORM_KEY[platform], year) : null),
    [left, platform, year]
  );
  const rightValues = useMemo(
    () => (right?.activity ? buildDenseValues(right.activity, PLATFORM_KEY[platform], year) : null),
    [right, platform, year]
  );

  const leftStreaks = useMemo(
    () => (left?.activity ? computeStreaks(left.activity, PLATFORM_KEY[platform]) : null),
    [left, platform]
  );
  const rightStreaks = useMemo(
    () => (right?.activity ? computeStreaks(right.activity, PLATFORM_KEY[platform]) : null),
    [right, platform]
  );

  const leftTotal = leftValues?.reduce((sum, v) => sum + v.count, 0) ?? null;
  const rightTotal = rightValues?.reduce((sum, v) => sum + v.count, 0) ?? null;

  if (loading) return <p className="state-msg">Loading...</p>;

  if (error) {
    return (
      <section className="compare-page">
        <p className="state-msg">Something went wrong loading these profiles. Try again in a moment.</p>
        <CompareForm initialA={userA} initialB={userB} />
      </section>
    );
  }

  if (bothMissing) {
    return (
      <section className="compare-page">
        <p className="state-msg">Neither {userA} nor {userB} has a profile here.</p>
        <CompareForm initialA="" initialB="" />
      </section>
    );
  }

  return (
    <section className="compare">
      <header className="compare-header">
        <h1>
          <CompareName side={left} fallback={userA} /> <span className="compare-vs">vs</span>{' '}
          <CompareName side={right} fallback={userB} />
        </h1>
      </header>

      <div className="controls-row">
        <PlatformToggle value={platform} onChange={setPlatform} />
        <YearSelector years={availableYears} value={year} onChange={setYear} />
      </div>

      <div className="compare-stats">
        <div className="compare-stats-header">
          <CompareUserChip side={left} fallback={userA} />
          <span />
          <CompareUserChip side={right} fallback={userB} align="right" />
        </div>
        <StatRow label={`activity in ${year}`} left={leftTotal} right={rightTotal} />
        <StatRow label="current streak" left={leftStreaks?.current} right={rightStreaks?.current} />
        <StatRow label="longest streak" left={leftStreaks?.longest} right={rightStreaks?.longest} />
      </div>

      <CompareSide profile={left?.profile} values={leftValues} yearBounds={yearBounds} year={year} platform={platform} notFound={left?.notFound} username={userA} sideKey="left" />
      <CompareSide profile={right?.profile} values={rightValues} yearBounds={yearBounds} year={year} platform={platform} notFound={right?.notFound} username={userB} sideKey="right" />

      {platform === 'combined' && <PlatformLegend />}
    </section>
  );
}

function CompareName({ side, fallback }) {
  if (side?.notFound) return <span className="compare-name-missing">{fallback}</span>;
  return <Link to={`/${side?.profile?.githubUsername ?? fallback}`} className="compare-name-link">{side?.profile?.githubUsername ?? fallback}</Link>;
}

function CompareUserChip({ side, fallback, align }) {
  if (side?.notFound) {
    return <span className={`compare-stats-user missing ${align === 'right' ? 'right' : ''}`}>{fallback}</span>;
  }
  const username = side?.profile?.githubUsername ?? fallback;
  return (
    <Link to={`/${username}`} className={`compare-stats-user ${align === 'right' ? 'right' : ''}`}>
      {align === 'right' && <span className="compare-stats-user-name">{username}</span>}
      <img src={`https://github.com/${username}.png`} alt="" className="avatar" width="24" height="24" />
      {align !== 'right' && <span className="compare-stats-user-name">{username}</span>}
    </Link>
  );
}

function StatRow({ label, left, right }) {
  return (
    <div className="compare-stats-row">
      <span className="compare-stats-value">{left ?? '—'}</span>
      <span className="compare-stats-label">{label}</span>
      <span className="compare-stats-value">{right ?? '—'}</span>
    </div>
  );
}

// One profile's heatmap. Renders a "not found" placeholder in its own slot
// instead of the caller skipping this side entirely - the other side still
// renders normally either way (PLAN.md §1.4).
function CompareSide({ profile, values, yearBounds, year, platform, notFound, username, sideKey }) {
  if (notFound) {
    return (
      <div className="compare-side">
        <p className="state-msg compare-side-missing">No profile at {username}.</p>
      </div>
    );
  }

  if (!profile || !values) return null;

  return (
    <div className="compare-side">
      <div className="compare-side-header">
        <img src={`https://github.com/${profile.githubUsername}.png`} alt="" className="avatar" width="28" height="28" />
        <Link to={`/${profile.githubUsername}`} className="compare-side-username">{profile.githubUsername}</Link>
      </div>
      <ActivityBoard
        key={`${sideKey}-${year}`}
        values={values}
        color={PLATFORM_COLORS[platform]}
        startDate={yearBounds.start}
        endDate={yearBounds.end}
        year={year}
        platform={platform}
      />
    </div>
  );
}

// Picker shown at bare /compare, and reused as the fallback when a
// same-user URL is blocked. A searchable picker is deferred (PLAN.md
// §1.5) - two text inputs and a submit is enough for v1.
function CompareForm({ initialA = '', initialB = '', error = null }) {
  const navigate = useNavigate();
  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialB);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmedA = a.trim();
    const trimmedB = b.trim();
    if (!trimmedA || !trimmedB) return;
    navigate(`/compare/${encodeURIComponent(trimmedA)}/${encodeURIComponent(trimmedB)}`);
  }

  return (
    <form className="compare-picker-form" onSubmit={handleSubmit}>
      <div className="compare-picker-title">Compare two profiles</div>
      {error && <p className="compare-picker-error">{error}</p>}
      <div className="compare-picker-inputs">
        <input
          className="text-input"
          placeholder="First GitHub username"
          value={a}
          onChange={(e) => setA(e.target.value)}
        />
        <span className="compare-picker-vs">vs</span>
        <input
          className="text-input"
          placeholder="Second GitHub username"
          value={b}
          onChange={(e) => setB(e.target.value)}
        />
      </div>
      <button type="submit" className="btn-primary">Compare</button>
    </form>
  );
}
