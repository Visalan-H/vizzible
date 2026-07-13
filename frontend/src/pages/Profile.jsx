import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { useHoverCapable } from '../hooks/useHoverCapable';
import PlatformToggle from '../components/PlatformToggle';
import YearSelector from '../components/YearSelector';
import ActivityBoard from '../components/ActivityBoard';
import ProfileLinks, { ICON_MAP } from '../components/ProfileLinks';
import './Profile.css';

const PLATFORM_COLOR = {
  combined: 'var(--ink)',
  github: '#39d353',
  codeforces: '#4a90d9',
  leetcode: '#ffa116',
};

const PLATFORM_KEY = { combined: 'total', github: 'github', codeforces: 'codeforces', leetcode: 'leetcode' };

const CURRENT_YEAR = new Date().getFullYear();
const MAX_LINKS = 10;

// The backend only stores rows for days that had activity. Filling in
// every day of Jan 1 - Dec 31 for the selected year (even for the current,
// still-in-progress year - future days just render empty) means every
// cell is clickable, the grid shape is consistent across years, and
// month-highlighting/stats have a full, evenly-spaced year to work with.
function buildDenseValues(activity, platformKey, year) {
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

// GitHub/Codeforces/LeetCode profile links are derived from handles that
// already exist rather than stored separately - one less thing to edit or
// go stale relative to the actual handle.
function buildPlatformLinks(profile) {
  const links = [{ label: 'GitHub', url: `https://github.com/${encodeURIComponent(profile.githubUsername)}` }];
  if (profile.codeforcesHandle) {
    links.push({
      label: 'Codeforces',
      url: `https://codeforces.com/profile/${encodeURIComponent(profile.codeforcesHandle)}`,
    });
  }
  if (profile.leetcodeUsername) {
    links.push({
      label: 'LeetCode',
      url: `https://leetcode.com/u/${encodeURIComponent(profile.leetcodeUsername)}/`,
    });
  }
  return links;
}

export default function Profile() {
  const { username } = useParams();
  const { user: currentUser } = useAuth();
  const { profile, activity, loading, notFound, setProfile, fetchActivity } = useProfile(username);
  const hoverCapable = useHoverCapable();
  const [platform, setPlatform] = useState('combined');
  const [year, setYear] = useState(CURRENT_YEAR);
  const [editing, setEditing] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [syncingData, setSyncingData] = useState(false);
  const pollRef = useRef(null);

  // Guards against the post-save poll loop below outliving the component -
  // without this, navigating away mid-poll (or switching to another
  // profile) leaves a stale setInterval calling fetchActivity() against a
  // username that's no longer on screen, and eventually setState-ing an
  // unmounted component. Keyed on `username` (not just unmount) since
  // React Router reuses this component instance across param changes -
  // /alice -> /bob is a re-render, not an unmount/remount.
  useEffect(() => {
    return () => clearInterval(pollRef.current);
  }, [username]);

  const availableYears = useMemo(() => {
    const years = new Set(activity?.map((day) => Number(day.date.slice(0, 4))));
    years.add(CURRENT_YEAR);
    return [...years].sort((a, b) => b - a);
  }, [activity]);

  const values = useMemo(
    () => (activity ? buildDenseValues(activity, PLATFORM_KEY[platform], year) : []),
    [activity, platform, year]
  );

  // Memoized so identity is stable across renders that don't touch year -
  // `new Date(...)` inline in the render body would otherwise hand Heatmap
  // a "new" prop on every render, defeating its memo for no reason.
  const yearBounds = useMemo(
    () => ({ start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year, 11, 31)) }),
    [year]
  );

  const allLinks = useMemo(
    () => [...buildPlatformLinks(profile ?? {}), ...(profile?.links || [])],
    [profile]
  );

  if (loading) return <p className="state-msg">Loading...</p>;
  if (notFound) return <p className="state-msg">No profile at {username}.</p>;
  if (!profile) return null;

  const isOwnProfile = currentUser?.githubUsername === profile.githubUsername;
  const handlesMissing = !profile.codeforcesHandle || !profile.leetcodeUsername;
  const showForm = editing || (isOwnProfile && handlesMissing && !onboardingDismissed);
  const total = values.reduce((sum, v) => sum + v.count, 0);

  // No manual "clear selectedDay/selectedMonth" needed here anymore - that
  // state now lives inside ActivityBoard, keyed below by platform+year, so
  // switching either just remounts it with a clean slate.
  function handlePlatformChange(next) {
    setPlatform(next);
  }

  function handleYearChange(next) {
    setYear(next);
  }

  return (
    <section className="profile">
      <header className="profile-header">
        <img
          src={`https://github.com/${profile.githubUsername}.png`}
          alt=""
          className="avatar avatar-lg"
          width="56"
          height="56"
        />
        <div className="profile-header-text">
          <h1>{profile.githubUsername}</h1>
          {profile.tagline && <p className="profile-tagline">{profile.tagline}</p>}
        </div>
        {isOwnProfile && !showForm && (
          <button type="button" className="btn-secondary edit-profile-btn" onClick={() => setEditing(true)}>
            Edit profile
          </button>
        )}
      </header>

      {profile.bio && <p className="profile-bio">{profile.bio}</p>}

      <ProfileLinks links={allLinks} />

      {syncingData && (
        <div className="syncing-banner">
          Fetching your latest Codeforces and LeetCode activity...
        </div>
      )}

      {isOwnProfile && showForm && (
        <EditProfileForm
          profile={profile}
          onboarding={!editing && handlesMissing}
          onSaved={(updated, handlesChanged) => {
            const oldLastSyncedAt = profile.lastSyncedAt;
            setProfile((prev) => ({ ...prev, ...updated }));
            setEditing(false);
            setOnboardingDismissed(true);
            
            if (handlesChanged) {
              setSyncingData(true);
              let attempts = 0;
              clearInterval(pollRef.current);
              pollRef.current = setInterval(() => {
                attempts++;
                fetchActivity()
                  .then((data) => {
                    // Stop polling if we see a new sync timestamp or hit max attempts
                    if (data?.lastSyncedAt !== oldLastSyncedAt || attempts >= 4) {
                      clearInterval(pollRef.current);
                      setSyncingData(false);
                    }
                  })
                  // A single failed poll attempt (network blip, etc.) shouldn't
                  // leave this running forever - without this, a rejected
                  // fetchActivity() call skips the check above entirely and
                  // the interval just keeps firing past the 4-attempt cap.
                  .catch(() => {
                    if (attempts >= 4) {
                      clearInterval(pollRef.current);
                      setSyncingData(false);
                    }
                  });
              }, 2500);
            }
          }}
          onCancel={() => {
            setEditing(false);
            setOnboardingDismissed(true);
          }}
        />
      )}

      <div className="controls-row">
        <PlatformToggle value={platform} onChange={handlePlatformChange} />
        <YearSelector years={availableYears} value={year} onChange={handleYearChange} />
      </div>

      <div className="activity-summary-bar">
        <p className="activity-total">
          {total} activity {total === 1 ? 'point' : 'points'} in {year}
        </p>
        <p className="activity-hint">
          Click a month label to see stats · {hoverCapable ? 'hover' : 'tap'} a day for details
        </p>
      </div>

      <ActivityBoard
        key={`${platform}-${year}`}
        values={values}
        color={PLATFORM_COLOR[platform]}
        startDate={yearBounds.start}
        endDate={yearBounds.end}
        year={year}
        platform={platform}
      />
    </section>
  );
}

function normalizeUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function EditProfileForm({ profile, onboarding, onSaved, onCancel }) {
  const [codeforcesHandle, setCodeforcesHandle] = useState(profile.codeforcesHandle || '');
  const [leetcodeUsername, setLeetcodeUsername] = useState(profile.leetcodeUsername || '');
  const [tagline, setTagline] = useState(profile.tagline || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [links, setLinks] = useState(profile.links?.length ? profile.links : [{ label: '', url: '', icon: 'generic' }]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // 'saved' | 'error' | null

  function updateLink(index, field, value) {
    setLinks((prev) => prev.map((link, i) => (i === index ? { ...link, [field]: value } : link)));
  }

  function addLink() {
    if (links.length >= MAX_LINKS) return;
    setLinks((prev) => [...prev, { label: '', url: '', icon: 'generic' }]);
  }

  function removeLink(index) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    const cleanedLinks = links.reduce((acc, link) => {
      const cleaned = {
        label: (link.icon || 'generic') === 'generic' ? (link.label || '').trim() : '',
        url: normalizeUrl(link.url),
        icon: link.icon || 'generic'
      };
      if (cleaned.url) acc.push(cleaned);
      return acc;
    }, []);

    const nextCodeforces = codeforcesHandle.trim() || null;
    const nextLeetcode = leetcodeUsername.trim() || null;
    const handlesChanged =
      nextCodeforces !== (profile.codeforcesHandle || null) || nextLeetcode !== (profile.leetcodeUsername || null);

    client
      .patch('/api/profiles/me', {
        codeforcesHandle: nextCodeforces,
        leetcodeUsername: nextLeetcode,
        tagline: tagline.trim() || null,
        bio: bio.trim() || null,
        links: cleanedLinks,
      })
      .then((res) => {
        setStatus(handlesChanged ? 'saved-resync' : 'saved');
        onSaved(res.data, handlesChanged);
      })
      .catch(() => setStatus('error'))
      .finally(() => setSaving(false));
  }

  return (
    <form className="onboarding-form" onSubmit={handleSubmit}>
      <div className="onboarding-form-title">
        {onboarding ? 'Add your Codeforces and LeetCode handles' : 'Edit profile'}
      </div>

      <div className="field-group">
        <label htmlFor="tagline">Tagline</label>
        <input
          id="tagline"
          className="text-input"
          placeholder="e.g. SWE @ Company, CP enthusiast"
          value={tagline}
          maxLength={120}
          onChange={(e) => setTagline(e.target.value)}
        />
        <span className="char-count">{tagline.length}/120</span>
      </div>

      <div className="field-group">
        <label htmlFor="bio">Bio</label>
        <textarea
          id="bio"
          className="textarea"
          placeholder="A few sentences about you"
          value={bio}
          maxLength={500}
          rows={3}
          onChange={(e) => setBio(e.target.value)}
        />
        <span className="char-count">{bio.length}/500</span>
      </div>

      <div className="form-inputs-group">
        <div className="input-wrapper">
          <label htmlFor="codeforcesHandle">Codeforces handle</label>
          <input
            id="codeforcesHandle"
            className="text-input"
            placeholder="e.g. tourist"
            value={codeforcesHandle}
            onChange={(e) => setCodeforcesHandle(e.target.value)}
          />
        </div>
        <div className="input-wrapper">
          <label htmlFor="leetcodeUsername">LeetCode username</label>
          <input
            id="leetcodeUsername"
            className="text-input"
            placeholder="e.g. neal_wu"
            value={leetcodeUsername}
            onChange={(e) => setLeetcodeUsername(e.target.value)}
          />
        </div>
      </div>

      <div className="field-group">
        <label>Links ({links.length}/{MAX_LINKS})</label>
        <div className="links-editor">
          {links.map((link, i) => (
            <div className="links-editor-row" key={i}>
              <div className="icon-selector-row">
                {Object.entries(ICON_MAP).map(([key, info]) => {
                  const IconComp = info.component;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`icon-selector-btn ${(link.icon || 'generic') === key ? 'active' : ''}`}
                      onClick={() => updateLink(i, 'icon', key)}
                      title={info.label}
                      aria-label={info.label}
                    >
                      <IconComp />
                    </button>
                  );
                })}
              </div>
              {(link.icon || 'generic') === 'generic' && (
                <input
                  className="text-input link-label-input"
                  placeholder="Label (e.g. Portfolio)"
                  value={link.label || ''}
                  onChange={(e) => updateLink(i, 'label', e.target.value)}
                />
              )}
              <input
                className="text-input link-url-input"
                placeholder="yoursite.com"
                value={link.url}
                onChange={(e) => updateLink(i, 'url', e.target.value)}
              />
              <button
                type="button"
                className="links-editor-remove"
                onClick={() => removeLink(i)}
                aria-label="Remove link"
              >
                ×
              </button>
            </div>
          ))}
          {links.length < MAX_LINKS && (
            <button type="button" className="btn-ghost links-editor-add" onClick={addLink}>
              + Add link
            </button>
          )}
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" disabled={saving} className={`btn-primary ${saving ? 'btn-disabled' : ''}`}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          {onboarding ? 'Skip for now' : 'Cancel'}
        </button>
      </div>

      {status === 'saved' && <span className="form-status-msg saved">Saved.</span>}
      {status === 'saved-resync' && (
        <span className="form-status-msg saved">Saved - syncing handles now, refresh in a few seconds.</span>
      )}
      {status === 'error' && (
        <span className="form-status-msg error">Could not save - check the fields and try again.</span>
      )}
    </form>
  );
}
