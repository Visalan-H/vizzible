const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { connectDB } = require('./config/db');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profiles');

const app = express();
const PORT = process.env.PORT || 3000;

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

app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);

// Global error handler — keeps stack traces out of responses.
// Express 5 forwards async rejections here automatically.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
