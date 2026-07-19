const User = require('../models/User');

// GitHub usernames are case-insensitive (GitHub itself treats Visalan-H
// and visalan-h as the same account), but githubUsername is stored with
// whatever casing GitHub's API returned at sign-in, and Mongo string
// equality is case-sensitive by default - so a profile URL only worked if
// you typed the exact original casing. Every route that looks a user up
// by username from a URL goes through this instead of a plain findOne,
// matching case-insensitively via an anchored, escaped regex (small user
// table - a regex scan here is not a perf concern - so this skips a schema
// migration/second indexed field for a one-line fix).
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findUserByUsername(username) {
  return User.findOne({ githubUsername: new RegExp(`^${escapeRegExp(username)}$`, 'i') });
}

module.exports = { findUserByUsername };
