const mongoose = require('mongoose');

// Claims a lock by inserting a doc with a unique `key` - a second
// invocation trying to claim the same key hits the unique index and gets
// a duplicate-key error, so it knows to back off instead of racing the
// same sync. TTL index means a lock also self-clears if a process crashes
// mid-sync without reaching the deleteOne() cleanup.
const syncLockSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
});

syncLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('SyncLock', syncLockSchema);
