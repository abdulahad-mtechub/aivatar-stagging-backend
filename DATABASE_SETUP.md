# Database Setup Guide

## ❌ Error: "relation 'users' does not exist"

This error means the database tables haven't been created yet. Follow these steps to initialize the database.

---

## 🚀 Quick Setup (Automated)

### Option 1: Using the Script (Recommended)

```bash
cd new-backend-project
./init-database.sh
```

This script will automatically:
- Connect to your database
- Run the SQL schema file
- Create all necessary tables

---

## 📝 Manual Setup

### Option 2: Using psql Command Line

```bash
cd new-backend-project

# Set password as environment variable (for security)
export PGPASSWORD="Mtechub@123"

# Run the SQL file
psql -h postgres-testing.cp.mtechub.org \
     -p 5432 \
     -U eventopia-user \
     -d eventopia-db \
     -f src/models/init.sql
```

### Option 3: Using psql Interactive Mode

```bash
# Connect to database
psql -h postgres-testing.cp.mtechub.org -p 5432 -U eventopia-user -d eventopia-db

# When prompted, enter password: Mtechub@123

# Then run:
\i src/models/init.sql

# Or copy and paste the SQL from src/models/init.sql
```

### Option 4: Using pgAdmin or DBeaver

1. Connect to your database:
   - Host: `postgres-testing.cp.mtechub.org`
   - Port: `5432`
   - Database: `eventopia-db`
   - Username: `eventopia-user`
   - Password: `Mtechub@123`

2. Open the SQL file: `src/models/init.sql`

3. Execute the SQL script

---

## ✅ Verify Tables Were Created

After running the initialization, verify the tables exist:

```sql
-- Connect to database
psql -h postgres-testing.cp.mtechub.org -p 5432 -U eventopia-user -d eventopia-db

-- List all tables
\dt

-- You should see:
--   users
--   posts
```

Or run this query:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';
```

---

## 🔍 Troubleshooting

### Error: "password authentication failed"
- Double-check the password: `Mtechub@123`
- Verify the username: `eventopia-user`
- Make sure you're connecting to the correct database

### Error: "database does not exist"
- Verify the database name: `eventopia-db`
- Contact your database administrator if the database needs to be created

### Error: "permission denied"
- The user might not have CREATE TABLE permissions
- Contact your database administrator to grant necessary permissions

### Error: "could not connect to server"
- Check if the host is correct: `postgres-testing.cp.mtechub.org`
- Verify network connectivity
- Check if port 5432 is accessible
- Check firewall settings

### Error: "relation already exists"
- Tables already exist - this is fine!
- You can drop and recreate if needed:
  ```sql
  DROP TABLE IF EXISTS posts CASCADE;
  DROP TABLE IF EXISTS users CASCADE;
  ```
  Then run `init.sql` again

---

## 📋 What Gets Created

The `init.sql` file creates:

1. **users table**
   - id (Primary Key)
   - name, email, password
   - role (user/admin)
   - phone_number, profile_image
   - block_status
   - created_at, updated_at, deleted_at

2. **posts table**
   - id (Primary Key)
   - title, content
   - user_id (Foreign Key to users)
   - created_at, updated_at, deleted_at

3. **Indexes**
   - For faster queries on email, role, user_id, etc.

---

## 🎯 After Setup

Once the tables are created:

1. ✅ Restart your server (if running)
2. ✅ Try the "Register User" request in Postman again
3. ✅ You should get a successful response with a token

---

## 📞 Need Help?

If you continue to have issues:

1. Check server logs for detailed error messages
2. Verify database connection in `src/config/database.js`
3. Test database connection manually:
   ```bash
   psql -h postgres-testing.cp.mtechub.org -p 5432 -U eventopia-user -d eventopia-db
   ```

---

## ✅ Success Checklist

- [ ] Database connection successful
- [ ] SQL file executed without errors
- [ ] `users` table exists
- [ ] `posts` table exists
- [ ] Server restarted
- [ ] Postman request works

Once all checked, you're ready to go! 🚀

