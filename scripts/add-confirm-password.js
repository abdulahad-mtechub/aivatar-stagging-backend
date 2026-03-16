require('dotenv').config();
const db = require('../src/config/database');
const logger = require('../src/utils/logger');

async function migrate() {
  try {
    console.log('Starting migration: Adding confirm_password column to users table...');
    
    // Check if column exists
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='confirm_password';
    `;
    
    const result = await db.query(checkColumnQuery);
    
    if (result.rows.length === 0) {
      await db.query('ALTER TABLE users ADD COLUMN confirm_password VARCHAR(255)');
      console.log('Successfully added confirm_password column.');
    } else {
      console.log('Column confirm_password already exists.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
