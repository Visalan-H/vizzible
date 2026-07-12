const axios = require('axios');

function toDateString(unixSeconds) {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

const QUERY = `
  query userProfileCalendar($username: String!, $year: Int) {
    matchedUser(username: $username) {
      userCalendar(year: $year) {
        activeYears
        submissionCalendar
      }
    }
  }
`;

function browserHeaders(username) {
  // LeetCode's edge checks for browser-shaped requests - a bare axios
  // request without these commonly gets a Cloudflare 403.
  return {
    'Content-Type': 'application/json',
    Referer: `https://leetcode.com/${username}/`,
    Origin: 'https://leetcode.com',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };
}

async function fetchYearCalendar(username, year) {
  const { data } = await axios.post(
    'https://leetcode.com/graphql',
    { query: QUERY, variables: { username, year } },
    { headers: browserHeaders(username) }
  );

  const calendar = data?.data?.matchedUser?.userCalendar;
  if (!calendar) {
    const reason = data?.errors ? JSON.stringify(data.errors) : 'unexpected response shape';
    throw new Error(`LeetCode user not found or calendar unavailable (${reason})`);
  }
  return calendar;
}

// userCalendar is year-scoped, like GitHub's contributionsCollection - but
// every response also includes activeYears for the whole account, so the
// first call (current year) tells us which other years are worth fetching.
async function fetchLeetcodeActivity(username) {
  const currentYear = new Date().getFullYear();
  const first = await fetchYearCalendar(username, currentYear);
  const activeYears = first.activeYears?.length ? first.activeYears : [currentYear];

  const otherYears = activeYears.filter((year) => year !== currentYear);
  const rest = await Promise.all(otherYears.map((year) => fetchYearCalendar(username, year)));

  const merged = Object.assign({}, ...[first, ...rest].map((c) => JSON.parse(c.submissionCalendar)));

  return Object.entries(merged).map(([epochSeconds, count]) => ({
    date: toDateString(Number(epochSeconds)),
    count,
  }));
}

module.exports = { fetchLeetcodeActivity };
