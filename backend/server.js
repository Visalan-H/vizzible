const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
require('dotenv').config({
  path: process.env.NODE_ENV === 'development' ? '.env.local' : '.env'
});

const { connectDB } = require('./config/db');
const { apiLimiter } = require('./middleware/rateLimit');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profiles');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));

// Ensures the DB connection is ready before any route runs. Cheap on warm
// invocations since connectDB() caches the connection promise.
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(503).json({ error: 'Database unavailable' });
  }
});

// apiLimiter needs a DB connection (it stores counters in Mongo), so it
// runs after the connectDB middleware above rather than before routing.
app.use(apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);

// Global error handler — keeps stack traces out of responses.
// Express 5 forwards async rejections here automatically.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
