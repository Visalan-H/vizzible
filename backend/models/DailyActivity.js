const mongoose = require('mongoose');

const dailyActivitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  platform: { type: String, enum: ['github', 'codeforces', 'leetcode'], required: true },
  date: { type: String, required: true }, // 'YYYY-MM-DD'
  count: { type: Number, required: true },
});

dailyActivitySchema.index({ userId: 1, platform: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyActivity', dailyActivitySchema);
