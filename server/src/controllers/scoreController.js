const { query } = require('../db/database');

async function saveScore(req, res) {
  const { score, coins, distance } = req.body;

  if (score == null || coins == null || distance == null) {
    return res.status(400).json({ error: 'score, coins and distance are required' });
  }

  const s = Math.floor(Number(score));
  const c = Math.floor(Number(coins));
  const d = Math.floor(Number(distance));

  if (isNaN(s) || isNaN(c) || isNaN(d) || s < 0 || c < 0 || d < 0) {
    return res.status(400).json({ error: 'Invalid score values' });
  }

  try {
    const existing = await query(
      'SELECT id, score FROM scores WHERE user_id = $1 ORDER BY score DESC LIMIT 1',
      [req.user.id]
    );

    if (existing.rows.length === 0) {
      const result = await query(
        'INSERT INTO scores (user_id, score, coins, distance) VALUES ($1, $2, $3, $4) RETURNING id',
        [req.user.id, s, c, d]
      );
      return res.status(201).json({ id: result.rows[0].id, score: s, coins: c, distance: d, newBest: true });
    }

    const current = existing.rows[0];
    if (s > current.score) {
      await query(
        'UPDATE scores SET score = $1, coins = $2, distance = $3, created_at = NOW() WHERE id = $4',
        [s, c, d, current.id]
      );
      return res.json({ id: current.id, score: s, coins: c, distance: d, newBest: true });
    }

    return res.json({ id: current.id, score: current.score, newBest: false });
  } catch (err) {
    console.error('[saveScore]', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
}

async function getLeaderboard(_req, res) {
  try {
    const result = await query(
      `SELECT id, username, score, coins, distance, created_at FROM (
         SELECT DISTINCT ON (s.user_id)
           s.id, u.username, s.score, s.coins, s.distance, s.created_at
         FROM scores s
         JOIN users u ON s.user_id = u.id
         WHERE u.is_seed = FALSE
         ORDER BY s.user_id, s.score DESC
       ) best
       ORDER BY score DESC
       LIMIT 20`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[getLeaderboard]', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
}

async function getMyScores(req, res) {
  try {
    const result = await query(
      `SELECT id, score, coins, distance, created_at
       FROM scores WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[getMyScores]', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { saveScore, getLeaderboard, getMyScores };
