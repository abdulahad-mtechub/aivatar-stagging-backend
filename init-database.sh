#!/bin/bash

# Database initialization script
# This script will create the necessary tables in your PostgreSQL database

echo "🚀 Initializing database schema..."
echo ""

# Database connection details
DB_HOST="postgres-testing.cp.mtechub.org"
DB_PORT="5432"
DB_USER="eventopia-user"
DB_NAME="eventopia-db"
SQL_FILE="src/models/init.sql"

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql command not found. Please install PostgreSQL client tools."
    echo ""
    echo "On macOS, you can install with:"
    echo "  brew install postgresql"
    echo ""
    echo "Or you can run the SQL file manually using any PostgreSQL client."
    exit 1
fi

# Run the SQL file
echo "📝 Running SQL schema file: $SQL_FILE"
echo "🔗 Connecting to: $DB_HOST:$DB_PORT"
echo "📊 Database: $DB_NAME"
echo "👤 User: $DB_USER"
echo ""

PGPASSWORD="Mtechub@123" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SQL_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database schema initialized successfully!"
    echo ""
    echo "Tables created:"
    echo "  - users"
    echo "  - posts"
    echo ""
    echo "You can now test the API endpoints in Postman."
else
    echo ""
    echo "❌ Error: Failed to initialize database schema."
    echo ""
    echo "Please check:"
    echo "  1. Database credentials are correct"
    echo "  2. Database exists: $DB_NAME"
    echo "  3. User has CREATE TABLE permissions"
    echo "  4. Network connection to database server"
    exit 1
fi

