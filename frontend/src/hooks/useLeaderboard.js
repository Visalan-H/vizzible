import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';

// One category at a time - switching category starts over from page 1.
// Results accumulate across "load more" clicks within the same category,
// same shape GET /api/leaderboard returns (rank/githubUsername/value).
export function useLeaderboard(category) {
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setLoading(true);
    setResults([]);
    setPage(1);

    client
      .get('/api/leaderboard', { params: { category, page: 1 } })
      .then((res) => {
        setResults(res.data.results);
        setHasMore(res.data.hasMore);
      })
      .catch((err) => {
        console.error('[useLeaderboard] request failed', err.response?.status, err.response?.data || err.message);
      })
      .finally(() => setLoading(false));
  }, [category]);

  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    setLoadingMore(true);

    client
      .get('/api/leaderboard', { params: { category, page: nextPage } })
      .then((res) => {
        setResults((prev) => [...prev, ...res.data.results]);
        setHasMore(res.data.hasMore);
        setPage(nextPage);
      })
      .catch((err) => {
        console.error('[useLeaderboard] load more failed', err.response?.status, err.response?.data || err.message);
      })
      .finally(() => setLoadingMore(false));
  }, [category, page]);

  return { results, loading, loadingMore, hasMore, loadMore };
}
