import { useEffect, useState } from 'react';
import client from '../api/client';

// Same two calls useProfile.js makes per profile, just run for both
// usernames at once. Each side resolves independently - a 404 on one
// side is caught and turned into { notFound: true } rather than
// rejecting, so one bad username doesn't stop the other side from
// loading (PLAN.md §1.4).
function fetchSide(username) {
  return Promise.all([
    client.get(`/api/profiles/${username}`),
    client.get(`/api/profiles/${username}/activity`),
  ])
    .then(([profileRes, activityRes]) => ({
      profile: profileRes.data,
      activity: activityRes.data.activity,
      notFound: false,
    }))
    .catch((err) => {
      if (err.response?.status === 404) {
        return { profile: null, activity: null, notFound: true };
      }
      throw err;
    });
}

// Fetches both profiles' meta + activity in parallel. No new endpoint -
// reuses GET /api/profiles/:username and /:username/activity exactly as
// Profile.jsx does, just twice (PLAN.md §1.2).
export function useCompareProfiles(userA, userB) {
  const [left, setLeft] = useState(null);
  const [right, setRight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userA || !userB) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);
    setLeft(null);
    setRight(null);

    Promise.all([fetchSide(userA), fetchSide(userB)])
      .then(([a, b]) => {
        setLeft(a);
        setRight(b);
      })
      .catch((err) => {
        // A non-404 failure (network error, 500, etc.) used to leave this
        // hook stuck on loading=true forever - fetchSide only catches 404s
        // itself, so anything else rejected straight through Promise.all
        // with nothing downstream to turn loading back off.
        console.error('[useCompareProfiles] failed to load one or both profiles:', err);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [userA, userB]);

  return { left, right, loading, error };
}
