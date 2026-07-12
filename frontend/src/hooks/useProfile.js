import { useEffect, useState } from 'react';
import client from '../api/client';

// One request gets profile meta and one gets the full per-day, per-platform
// breakdown - the frontend derives all 4 tab views from that single array
// client-side instead of asking the backend once per tab.
export function useProfile(username) {
  const [profile, setProfile] = useState(null);
  const [activity, setActivity] = useState(null); // [{date, github, codeforces, leetcode, total}]
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) return;

    setLoading(true);
    setNotFound(false);

    Promise.all([
      client.get(`/api/profiles/${username}`),
      client.get(`/api/profiles/${username}/activity`),
    ])
      .then(([profileRes, activityRes]) => {
        setProfile(profileRes.data);
        setActivity(activityRes.data.activity);
      })
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [username]);

  return { profile, activity, loading, notFound, setProfile };
}
