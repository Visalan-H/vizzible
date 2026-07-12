const mongoose = require('mongoose');

// Reuse the connection across warm serverless invocations instead of
// reconnecting on every request.
let connectionPromise = null;

function connectDB() {
  if (connectionPromise) return connectionPromise;
  connectionPromise = mongoose.connect(process.env.MONGODB_URI).catch((err) => {
    connectionPromise = null;
    throw err;
  });
  return connectionPromise;
}

module.exports = { connectDB };
