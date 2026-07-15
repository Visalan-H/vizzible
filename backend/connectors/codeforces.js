const axios = require('axios');

function toDateString(unixSeconds) {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

const PAGE_SIZE = 10000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Codeforces' user.status returns newest-first with no date filter, and a
// single call only returns up to PAGE_SIZE submissions. A prolific user with
// more than that would silently lose their oldest years if we only fetched
// once - so page with an increasing `from` until a page comes back shorter
// than PAGE_SIZE (meaning we've reached the end of their history).
// Counts every submission, not just accepted ones, as activity for that day.
async function fetchCodeforcesActivity(handle) {
  const countsByDate = {};
  let from = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data } = await axios.get('https://codeforces.com/api/user.status', {
      params: { handle, from, count: PAGE_SIZE },
    });

    if (data.status !== 'OK') {
      throw new Error(`Codeforces API error: ${data.comment}`);
    }

    for (const submission of data.result) {
      const date = toDateString(submission.creationTimeSeconds);
      countsByDate[date] = (countsByDate[date] || 0) + 1;
    }

    if (data.result.length < PAGE_SIZE) break; // short page - reached the end of their history

    from += PAGE_SIZE;
    await sleep(2100); // respect Codeforces' 1-request-per-2-seconds limit between pages
  }

  return Object.entries(countsByDate).map(([date, count]) => ({ date, count }));
}

module.exports = { fetchCodeforcesActivity };
