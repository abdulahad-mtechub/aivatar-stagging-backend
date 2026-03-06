const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function runFix() {
  try {
    console.log('--- Creating contact_us table ---');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contact_us (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        query TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      );
    `);
    console.log('✅ Table contact_us ensured');

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_contact_us_email ON contact_us(email);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_contact_us_deleted_at ON contact_us(deleted_at);`);
    console.log('✅ Indexes ensured');

    console.log('--- Verifying table existence ---');
    const res = await pool.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'contact_us');");
    console.log('Table exists:', res.rows[0].exists);

    process.exit(0);
  } catch (err) {
    console.error('❌ Fix failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runFix();
