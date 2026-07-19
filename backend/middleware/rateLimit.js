const RateLimitHit = require('../models/RateLimitHit');

// Vercel functions are stateless and horizontally scaled - a burst of
// requests can land on several different instances, each with its own
// process memory. express-rate-limit's default in-memory store counts
// per-instance, so a client that should get blocked just gets spread
// across instances and never actually trips the limit.
//
// Mongo is already part of this stack (config/db.js), so counters live
// there instead of standing up a separate service just for this: one doc
// per (route class, client, fixed time window), incremented atomically via
// $inc, auto-deleted by RateLimitHit's TTL index once its window closes.
function makeLimiter({ limit, windowMs, prefix }) {
  return async function rateLimitMiddleware(req, res, next) {
    const bucket = Math.floor(Date.now() / windowMs);
    const key = `${prefix}:${req.ip}:${bucket}`;

    try {
      const hit = await RateLimitHit.findOneAndUpdate(
        { key },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + windowMs) } },
        { upsert: true, new: true }
      );

      if (hit.count > limit) {
        return res.status(429).json({ error: 'Too many requests' });
      }
      next();
    } catch (err) {
      // A DB hiccup on the rate-limit check shouldn't take the whole API
      // down with it - fail open and log, rather than 500ing every request.
      console.error(`[rateLimit:${prefix}] failed, allowing request:`, err.message);
      next();
    }
  };
}

module.exports = {
  // Generic API-wide ceiling against abusive traffic, applied to every
  // request. Individual routes below get tighter, purpose-specific limits
  // on top of this.
  apiLimiter: makeLimiter({ limit: 300, windowMs: 15 * 60 * 1000, prefix: 'api' }),

  // OAuth start/callback are unauthenticated and hit GitHub's API on our
  // behalf - keep them from being hammered.
  oauthLimiter: makeLimiter({ limit: 20, windowMs: 15 * 60 * 1000, prefix: 'oauth' }),

  // Each profile save can trigger a background GitHub/Codeforces/LeetCode
  // sync - cheap to abuse otherwise since one account could fire dozens of
  // syncs in seconds by toggling a handle back and forth.
  updateLimiter: makeLimiter({ limit: 30, windowMs: 15 * 60 * 1000, prefix: 'update' }),

  // OG image generation fetches an external avatar and renders a PNG on
  // every request - meaningfully more expensive than a normal JSON route,
  // so it gets its own (tighter than default) ceiling instead of relying
  // solely on the blanket apiLimiter.
  ogImageLimiter: makeLimiter({ limit: 60, windowMs: 15 * 60 * 1000, prefix: 'ogimage' }),
};
