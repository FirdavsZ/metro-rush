require('dotenv').config();
const app = require('./app');
const { initializeDb } = require('./db/database');

const PORT = process.env.PORT || 5000;

initializeDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n  Metro Rush API`);
      console.log(`  Running on port ${PORT}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  Press Ctrl+C to stop\n`);
    });
  })
  .catch(err => {
    console.error('[Server] Database initialization failed:', err.message);
    process.exit(1);
  });
