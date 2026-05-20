require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const authRoutes  = require('./routes/auth');
const userRoutes  = require('./routes/users');
const scoreRoutes = require('./routes/scores');

const app = express();

// Allowed origins: always include localhost for dev, plus CLIENT_URL for prod
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow no-origin requests (curl, Postman, mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin "${origin}" not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '16kb' }));

// Health check — useful for Render/Railway uptime checks
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Metro Rush API is running',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth',   authRoutes);
app.use('/api/users',  userRoutes);
app.use('/api/scores', scoreRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, _req, res, _next) => {
  if (process.env.NODE_ENV !== 'production') console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
