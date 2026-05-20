const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render / Neon / Railway require SSL in production
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function query(text, params) {
  return pool.query(text, params);
}

async function initializeDb() {
  // Create tables (idempotent)
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT    UNIQUE NOT NULL,
      email         TEXT    UNIQUE NOT NULL,
      password_hash TEXT    NOT NULL,
      is_seed       BOOLEAN DEFAULT FALSE,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS scores (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      score      INTEGER NOT NULL DEFAULT 0,
      coins      INTEGER NOT NULL DEFAULT 0,
      distance   INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Mark any demo/seed users so they stay off the leaderboard
  const marked = await query(
    "UPDATE users SET is_seed = TRUE WHERE email LIKE '%@example.com' AND is_seed = FALSE RETURNING id"
  );
  if (marked.rowCount > 0) {
    console.log(`[DB] Marked ${marked.rowCount} seed user(s) as demo-only`);
  }

  // Remove scores that belong to seed users
  const cleaned = await query(
    'DELETE FROM scores WHERE user_id IN (SELECT id FROM users WHERE is_seed = TRUE)'
  );
  if (cleaned.rowCount > 0) {
    console.log(`[DB] Removed ${cleaned.rowCount} seed score(s) from leaderboard`);
  }
}

module.exports = { query, initializeDb };
