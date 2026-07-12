const mongoose = require('mongoose');

const linkSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 40 },
    url: { type: String, required: true, trim: true, maxlength: 300 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema({
  githubId: { type: Number, required: true, unique: true },
  githubUsername: { type: String, required: true, unique: true }, // also the public profile slug
  githubAccessToken: { type: String, required: true },
  codeforcesHandle: { type: String, default: null },
  leetcodeUsername: { type: String, default: null },
  tagline: { type: String, default: null, trim: true, maxlength: 120 },
  bio: { type: String, default: null, trim: true, maxlength: 500 },
  // Generic instead of dedicated linkedinUrl/twitterUrl/etc fields - covers
  // any link the person wants to add (portfolio, resume, LinkedIn, X, a
  // blog...) without a schema change every time a new platform comes up.
  // Capped at 10 by the validation layer, not enforced here.
  links: { type: [linkSchema], default: [] },
  lastSyncedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', userSchema);
