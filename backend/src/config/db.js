const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  // Errors on idle clients (e.g. connection dropped by the server)
  // should not crash the process silently — log loudly.
  console.error('Unexpected error on idle Postgres client', err);
});

module.exports = pool;
