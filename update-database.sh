#!/bin/bash

# Idempotent update script to add OTP-related columns to users table
echo "🔁 Running DB update: add OTP columns if missing"

# Database connection details (override via env or edit below)
DB_HOST="postgres-testing.cp.mtechub.org"
DB_PORT="5432"
DB_USER="eventopia-user"
DB_NAME="eventopia-db"
SQL_COMMANDS=$(cat <<'SQL'
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP;
SQL
)

if ! command -v psql &> /dev/null; then
  echo "❌ psql not found. Install PostgreSQL client tools or run the SQL manually."
  exit 1
fi

echo "Connecting to $DB_HOST:$DB_PORT database $DB_NAME as $DB_USER"

PGPASSWORD="Mtechub@123" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$SQL_COMMANDS"

if [ $? -eq 0 ]; then
  echo "✅ Database updated successfully (OTP columns ensured)."
else
  echo "❌ Failed to update database. Check connection and permissions."
  exit 1
fi
