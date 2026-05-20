// Run once to create tables in production DB: node init-db.js
require('dotenv').config();
const { query, initializeDb } = require('./src/db/database');

initializeDb()
  .then(() => {
    console.log('Tables created successfully.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
