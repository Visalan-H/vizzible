import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import PlatformToggle from '../components/PlatformToggle';
import YearSelector from '../components/YearSelector';
import Heatmap from '../components/Heatmap';
import DayDetail from '../components/DayDetail';
import ProfileLinks from '../components/ProfileLinks';
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

function timeAgo(dateStr) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// The backend only stores rows for days that had activity. Filling in every
// day of the selected year (Jan 1 through Dec 31, or today if it's the
// current year) means every cell is clickable and shows a proper
// "no activity" detail, instead of react-calendar-heatmap handing back a
// null value for gaps.
function buildDenseValues(activity, platformKey, year) {
  const byDate = new Map(activity.map((day) => [day.date, day]));
  const start = new Date(Date.UTC(year, 0, 1));
  const end = year === CURRENT_YEAR ? new Date() : new Date(Date.UTC(year, 11, 31));

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
  const links = [{ label: 'GitHub', url: `https://github.com/${profile.githubUsername}` }];
  if (profile.codeforcesHandle) {
    links.push({ label: 'Codeforces', url: `https://codeforces.com/profile/${profile.codeforcesHandle}` });
  }
  if (profile.leetcodeUsername) {
    links.push({ label: 'LeetCode', url: `https://leetcode.com/u/${profile.leetcodeUsername}/` });
  }
  return links;
}

export default function Profile() {
  const { username } = useParams();
  const { user: currentUser } = useAuth();
  const { profile, activity, loading, notFound, setProfile } = useProfile(username);
  const [platform, setPlatform] = useState('combined');
  const [year, setYear] = useState(CURRENT_YEAR);
  const [selectedDay, setSelectedDay] = useState(null);
  const [editing, setEditing] = useState(false);

  const availableYears = useMemo(() => {
    const years = new Set(activity?.map((day) => Number(day.date.slice(0, 4))));
    years.add(CURRENT_YEAR);
    return [...years].sort((a, b) => b - a);
  }, [activity]);

  const values = useMemo(
    () => (activity ? buildDenseValues(activity, PLATFORM_KEY[platform], year) : []),
    [activity, platform, year]
  );

  if (loading) return <p className="state-msg">Loading...</p>;
  if (notFound) return <p className="state-msg">No profile at {username}.</p>;
  if (!profile) return null;

  const isOwnProfile = currentUser?.githubUsername === profile.githubUsername;
  const isStale = !profile.lastSyncedAt || Date.now() - new Date(profile.lastSyncedAt).getTime() > 24 * 60 * 60 * 1000;
  const total = values.reduce((sum, v) => sum + v.count, 0);
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = year === CURRENT_YEAR ? new Date() : new Date(Date.UTC(year, 11, 31));
  const allLinks = [...buildPlatformLinks(profile), ...(profile.links || [])];

  function handlePlatformChange(next) {
    setPlatform(next);
    setSelectedDay(null); // stale detail from a different tab would be confusing
  }

  function handleYearChange(next) {
    setYear(next);
    setSelectedDay(null);
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
        {isOwnProfile && !editing && (
          <button className="btn-secondary edit-profile-btn" onClick={() => setEditing(true)}>
            Edit profile
          </button>
        )}
      </header>

      {profile.bio && <p className="profile-bio">{profile.bio}</p>}

      <ProfileLinks links={allLinks} />

      {isOwnProfile && editing && (
        <EditProfileForm
          profile={profile}
          onSaved={(updated) => {
            setProfile((prev) => ({ ...prev, ...updated }));
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
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
        <p className="activity-hint">Click a day to see what happened</p>
      </div>

      <Heatmap
        values={values}
        color={PLATFORM_COLOR[platform]}
        onDayClick={setSelectedDay}
        startDate={yearStart}
        endDate={yearEnd}
      />

      {selectedDay && (
        <DayDetail day={selectedDay} platform={platform} onClose={() => setSelectedDay(null)} />
      )}
    </section>
  );
}

function normalizeUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function EditProfileForm({ profile, onSaved, onCancel }) {
  const [codeforcesHandle, setCodeforcesHandle] = useState(profile.codeforcesHandle || '');
  const [leetcodeUsername, setLeetcodeUsername] = useState(profile.leetcodeUsername || '');
  const [tagline, setTagline] = useState(profile.tagline || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [links, setLinks] = useState(profile.links?.length ? profile.links : [{ label: '', url: '' }]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // 'saved' | 'error' | null

  function updateLink(index, field, value) {
    setLinks((prev) => prev.map((link, i) => (i === index ? { ...link, [field]: value } : link)));
  }

  function addLink() {
    if (links.length >= MAX_LINKS) return;
    setLinks((prev) => [...prev, { label: '', url: '' }]);
  }

  function removeLink(index) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    const cleanedLinks = links
      .map((link) => ({ label: link.label.trim(), url: normalizeUrl(link.url) }))
      .filter((link) => link.label && link.url);

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
        onSaved(res.data);
      })
      .catch(() => setStatus('error'))
      .finally(() => setSaving(false));
  }

  return (
    <form className="onboarding-form" onSubmit={handleSubmit}>
      <div className="onboarding-form-title">Edit profile</div>

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
        <input
          className="text-input"
          placeholder="Codeforces handle"
          value={codeforcesHandle}
          onChange={(e) => setCodeforcesHandle(e.target.value)}
        />
        <input
          className="text-input"
          placeholder="LeetCode username"
          value={leetcodeUsername}
          onChange={(e) => setLeetcodeUsername(e.target.value)}
        />
      </div>

      <div className="field-group">
        <label>Links ({links.length}/{MAX_LINKS})</label>
        <div className="links-editor">
          {links.map((link, i) => (
            <div className="links-editor-row" key={i}>
              <input
                className="text-input"
                placeholder="Label (e.g. Portfolio)"
                value={link.label}
                onChange={(e) => updateLink(i, 'label', e.target.value)}
              />
              <input
                className="text-input"
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
          Cancel
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
