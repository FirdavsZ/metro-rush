// Vercel serverless entry point — wraps the Express app
require('dotenv').config();
const { initializeDb } = require('../src/db/database');
const app = require('../src/app');

// Create tables on cold start (idempotent). All concurrent requests await
// this same promise so the DB is ready before any handler runs.
const dbReady = initializeDb().catch(err => {
  console.error('[DB init]', err.message);
});

module.exports = async (req, res) => {
  await dbReady;
  return app(req, res);
};
