const { Client } = require('pg');

// Read connection info from env or use defaults from repository
const DB_HOST = process.env.DB_HOST || 'postgres-testing.cp.mtechub.org';
const DB_PORT = process.env.DB_PORT || 5432;
const DB_USER = process.env.DB_USER || 'eventopia-user';
const DB_NAME = process.env.DB_NAME || 'eventopia-db';
const PGPASSWORD = process.env.PGPASSWORD || process.env.PG_PASSWORD || 'Mtechub@123';

async function run() {
  const client = new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: PGPASSWORD,
    database: DB_NAME,
  });

  try {
    console.log(`Connecting to ${DB_HOST}:${DB_PORT} ${DB_NAME} as ${DB_USER}`);
    await client.connect();

    const queries = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS otp VARCHAR(10);`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP;`,
    ];

    for (const q of queries) {
      console.log('Running:', q.trim());
      await client.query(q);
    }

    console.log('✅ Migration complete: OTP columns ensured on users table');
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    try { await client.end(); } catch (e) {}
    process.exit(1);
  }
}

run();
