// Shared by every place that sets/clears an httpOnly cookie (session,
// oauth_state, vid) so the httpOnly/secure/sameSite trio can't drift out
// of sync between them - a clearCookie() call with different options than
// the original set() silently fails to actually clear the cookie.
function cookieOptions(maxAge) {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    // secure:true requires https - gating on NODE_ENV keeps local http
    // dev working while still being secure in production.
    secure: isProduction,
    // Frontend and backend are separate Vercel domains, so cross-origin
    // fetches need sameSite:'none' in production or the cookie is silently
    // dropped; 'lax' is fine for same-origin local dev.
    sameSite: isProduction ? 'none' : 'lax',
    ...(maxAge != null && { maxAge }),
  };
}

module.exports = { cookieOptions };
