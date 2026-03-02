const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

// Create a connection pool
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "your_password",
  database: process.env.DB_NAME || "reusable_backend_db",
  max: 20, // Max number of clients in the pool
  idleTimeoutMillis: 30000, // Close & remove clients which have been idle > 30 seconds
  connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection not established
  // Set timezone to UTC for all connections
  options: '-c timezone=UTC'
});

// Pool error handling
pool.on("error", (err) => {
  logger.error("Unexpected error on idle client", err);
  // Don't exit process in production, just log the error
  if (process.env.NODE_ENV !== "production") {
    process.exit(-1);
  }
});

// Function to initialize database schema
async function initializeDatabase() {
  try {
    // Read the init.sql file
    const initSqlPath = path.join(__dirname, "../models/init.sql");
    const initSql = fs.readFileSync(initSqlPath, "utf8");

    // Split SQL statements by semicolon and filter out empty/comment-only statements
    const statements = initSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await pool.query(statement);
        } catch (err) {
          // If tables/indexes already exist, that's okay - just log a warning
          if (err.message && (err.message.includes("already exists") || err.message.includes("duplicate"))) {
            logger.warn(`⚠️  ${err.message.split('\n')[0]}`);
          } else {
            // Log other errors but continue
            logger.error(`❌ Error executing SQL statement: ${err.message.split('\n')[0]}`);
          }
        }
      }
    }
    logger.info("✅ Database schema initialization completed");
  } catch (err) {
    logger.error("❌ Error reading or initializing database schema:", err.message);
    // Don't exit - let the app continue, but log the error
  }
}

// Test connection and initialize schema on startup
(async () => {
  try {
    await pool.query('SELECT NOW()');
    logger.info("Database connection pool initialized successfully");
    // Initialize database schema after connection is established
    await initializeDatabase();
  } catch (err) {
    logger.error("Database connection error:", err);
  }
})();

// Export a simplified query interface
module.exports = {
  pool,
  query: (text, params) =>
    pool.query(text, params).catch((err) => {
      logger.error("Database query error:", err);
      throw err;
    }),
};

