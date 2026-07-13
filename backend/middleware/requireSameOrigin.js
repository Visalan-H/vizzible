// Session cookie is SameSite=None in production (frontend and API are on
// different origins, so the cookie needs to travel on cross-origin fetch/
// axios calls) - which also means it travels on a cross-origin request an
// attacker's page fires without the user ever knowing. CORS doesn't stop
// that: it only blocks the attacker's JS from *reading* the response, not
// the request from executing. This is the cheap mitigation for state-
// changing routes: reject anything whose Origin/Referer doesn't match our
// own frontend, since only a same-origin request could legitimately have
// gotten a real user through our own UI.
function requireSameOrigin(req, res, next) {
  // Browsers attach Origin to every fetch/XHR request other than plain
  // GET/HEAD navigation - which covers exactly the state-changing methods
  // this guards. A request with no Origin header on a PATCH/POST/DELETE
  // isn't a real browser call, so it's rejected rather than let through.
  const origin = req.headers.origin;

  if (!origin || origin !== process.env.CLIENT_URL) {
    return res.status(403).json({ error: 'Invalid origin' });
  }

  next();
}

module.exports = { requireSameOrigin };
