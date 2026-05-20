// Demo data seeder — run manually only: npm run seed
// All seeded users have is_seed=TRUE and are hidden from the leaderboard.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, initializeDb } = require('./src/db/database');

const USERS = [
  { username: 'SpeedDemon',  email: 'speed@example.com',  score: 18420, coins: 382, distance: 1842 },
  { username: 'NeonRunner',  email: 'neon@example.com',   score: 15200, coins: 310, distance: 1520 },
  { username: 'MetroKing',   email: 'metro@example.com',  score: 13800, coins: 290, distance: 1380 },
  { username: 'CoinHunter',  email: 'coins@example.com',  score: 11500, coins: 420, distance: 1150 },
  { username: 'RailRider',   email: 'rail@example.com',   score: 9700,  coins: 215, distance: 970  },
  { username: 'GhostSprint', email: 'ghost@example.com',  score: 8200,  coins: 180, distance: 820  },
  { username: 'TurboMax',    email: 'turbo@example.com',  score: 7400,  coins: 160, distance: 740  },
  { username: 'SkyDasher',   email: 'sky@example.com',    score: 5800,  coins: 130, distance: 580  },
];

async function seed() {
  await initializeDb();
  const hash = await bcrypt.hash('password123', 12);
  let created = 0;

  for (const u of USERS) {
    try {
      const res = await query(
        `INSERT INTO users (username, email, password_hash, is_seed)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [u.username, u.email, hash]
      );

      if (res.rows.length > 0) {
        await query(
          'INSERT INTO scores (user_id, score, coins, distance) VALUES ($1, $2, $3, $4)',
          [res.rows[0].id, u.score, u.coins, u.distance]
        );
        created++;
        console.log(`  Created: ${u.username} (score: ${u.score})`);
      } else {
        console.log(`  Skipped: ${u.username} (already exists)`);
      }
    } catch (err) {
      console.log(`  Error for ${u.username}: ${err.message}`);
    }
  }

  console.log(`\nSeed complete — ${created} users created.`);
  console.log('Note: seeded users are marked is_seed=TRUE and hidden from leaderboard.\n');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
