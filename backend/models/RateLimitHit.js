const mongoose = require('mongoose');

// One document per (route class, client, time window), incremented
// atomically per request. TTL index auto-deletes each doc shortly after
// its window closes, so this collection self-cleans - no separate cron/
// cleanup job needed.
const rateLimitHitSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});

rateLimitHitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RateLimitHit', rateLimitHitSchema);
