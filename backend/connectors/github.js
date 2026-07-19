const { GraphQLClient, gql } = require('graphql-request');

const YEARS_QUERY = gql`
  query ($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionYears
      }
    }
  }
`;

const YEAR_CALENDAR_QUERY = gql`
  query ($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

function yearRange(year) {
  const now = new Date();
  const from = new Date(Date.UTC(year, 0, 1)).toISOString();
  // GitHub caps a single query to a 1-year window. For the current year,
  // capping "to" at now avoids requesting a range that runs into the future.
  const to =
    year === now.getUTCFullYear()
      ? now.toISOString()
      : new Date(Date.UTC(year, 11, 31, 23, 59, 59)).toISOString();
  return { from, to };
}

// contributionsCollection is capped to a 1-year window per query, so full
// history means one query per year the account has contributions in.
// contributionYears (no from/to needed) tells us which years those are.
async function fetchGithubActivity(username, accessToken) {
  const client = new GraphQLClient('https://api.github.com/graphql', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const { user } = await client.request(YEARS_QUERY, { login: username });
  const years = user.contributionsCollection.contributionYears;

  const perYear = await Promise.all(
    years.map(async (year) => {
      const { from, to } = yearRange(year);
      const data = await client.request(YEAR_CALENDAR_QUERY, { login: username, from, to });
      return data.user.contributionsCollection.contributionCalendar.weeks
        .flatMap((week) => week.contributionDays)
        .map((day) => ({ date: day.date, count: day.contributionCount }))
        // GitHub's calendar includes every day of the year, active or not
        // (unlike Codeforces/LeetCode, which only report days with actual
        // submissions) - without this filter, saveActivity would write a
        // counts.MM-DD = 0 entry for every inactive day too, contradicting
        // DailyActivity's sparse-storage design (see that model's comment)
        // and inflating stats that assume a map key means "active" (e.g.
        // the OG image's active-days count).
        .filter((d) => d.count > 0);
    })
  );

  return perYear.flat();
}

module.exports = { fetchGithubActivity };
