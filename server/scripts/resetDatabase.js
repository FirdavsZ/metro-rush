require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function resetDatabase() {
  console.log('\n Metro Rush — Database Reset\n');
  console.log(' Connecting to:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));

  const client = await pool.connect();
  try {
    console.log('\n Deleting all scores and users...');
    await client.query('TRUNCATE TABLE scores, users RESTART IDENTITY CASCADE');
    console.log(' Done — all users and scores deleted.');
    console.log(' Leaderboard is now empty.');
    console.log('\n Everyone must register a new account.\n');
  } finally {
    client.release();
    await pool.end();
  }
}

resetDatabase().catch(err => {
  console.error('\n Reset failed:', err.message);
  process.exit(1);
});
