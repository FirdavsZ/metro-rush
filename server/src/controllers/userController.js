const { query } = require('../db/database');

async function getMe(req, res) {
  try {
    const userResult = await query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const statsResult = await query(
      `SELECT
         COUNT(*)                        AS games_played,
         COALESCE(MAX(score), 0)         AS best_score,
         COALESCE(SUM(coins), 0)         AS total_coins,
         COALESCE(MAX(distance), 0)      AS best_distance
       FROM scores WHERE user_id = $1`,
      [req.user.id]
    );

    return res.json({ ...user, ...statsResult.rows[0] });
  } catch (err) {
    console.error('[getMe]', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { getMe };
