const mongoose = require('mongoose');

// One document per user+platform+year, holding a map of 'MM-DD' -> count,
// instead of one document per user+platform+day. A user with 3 years of
// GitHub/Codeforces/LeetCode history goes from ~3,300 documents to 9 -
// same data, a fraction of the storage and of the index/write overhead
// (bulkWrite upserts touch ~365 fewer documents per sync).
const dailyActivitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  platform: { type: String, enum: ['github', 'codeforces', 'leetcode'], required: true },
  year: { type: Number, required: true },
  // Keys are 'MM-DD' (no leading year, that's redundant with the `year`
  // field). Sparse - a day with zero activity just has no key.
  counts: { type: Map, of: Number, default: () => new Map() },
});

dailyActivitySchema.index({ userId: 1, platform: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('DailyActivity', dailyActivitySchema);
