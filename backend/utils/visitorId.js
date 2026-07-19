const crypto = require('crypto');
const { cookieOptions } = require('./cookies');

const COOKIE_NAME = 'vid';
const COOKIE_MAX_AGE = 5 * 365 * 24 * 60 * 60 * 1000; // 5 years - "forever" in practice

// Reads the anonymous visitor cookie, setting one if it doesn't exist yet.
// Reuses the same httpOnly/secure/sameSite trio as the session cookie
// (utils/cookies.js) since frontend and backend are on separate Vercel
// domains - sameSite:'lax' alone would get silently dropped on
// cross-origin fetches in production.
// Caveat (inherent to any no-login tracking, not fixable client-side):
// clearing cookies, incognito windows, or a second device all present as a
// "new" visitor. This is only used as a fallback when the visitor isn't
// signed in - see recordVisit in services/visits.js.
function getOrSetVisitorCookie(req, res) {
  let vid = req.cookies?.[COOKIE_NAME];
  if (!vid) {
    vid = crypto.randomUUID();
    res.cookie(COOKIE_NAME, vid, cookieOptions(COOKIE_MAX_AGE));
  }
  return vid;
}

function hashVisitorId(vid) {
  return crypto.createHash('sha256').update(vid).digest('hex');
}

module.exports = { getOrSetVisitorCookie, hashVisitorId };
