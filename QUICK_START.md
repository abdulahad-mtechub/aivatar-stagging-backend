# Quick Start Guide

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd new-backend-project
npm install
```

### 2. Set Up Environment Variables
```bash
# Copy the example file
cp env.example .env

# The .env file should already have the correct database credentials:
# DB_HOST=postgres-testing.cp.mtechub.org
# DB_USER=eventopia-user
# DB_PASSWORD=Mtechub@123
# DB_NAME=eventopia-db
```

### 3. Initialize Database
```bash
# Connect to your PostgreSQL database and run:
psql -h postgres-testing.cp.mtechub.org -U eventopia-user -d eventopia-db -f src/models/init.sql

# Or using psql directly:
psql -h postgres-testing.cp.mtechub.org -U eventopia-user -d eventopia-db
# Then in psql:
\i src/models/init.sql
```

### 4. Start the Server
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000` (or the PORT specified in .env)

### 5. Test with Postman

1. **Import Postman Collection:**
   - Open Postman
   - Click Import
   - Select `Postman_Collection.json`

2. **Set Up Environment:**
   - Create a new environment in Postman
   - Add variable: `base_url` = `http://localhost:3000`
   - Select the environment from dropdown

3. **Start Testing:**
   - Run "Health Check" to verify server is running
   - Run "Register User" to create a test user
   - Token will be automatically saved
   - Continue with other endpoints

See `POSTMAN_GUIDE.md` for detailed testing instructions.

---

## 📋 Database Configuration

Your database is already configured in `env.example`:

```
DB_HOST=postgres-testing.cp.mtechub.org
DB_PORT=5432
DB_USER=eventopia-user
DB_PASSWORD=Mtechub@123
DB_NAME=eventopia-db
```

Make sure to copy these to your `.env` file.

---

## 🔑 Default JWT Configuration

Update these in your `.env` file for production:

```
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRE=7d
```

**⚠️ Important:** Change `JWT_SECRET` to a strong random string in production!

---

## 📚 Documentation Files

- **README.md** - Project overview and setup
- **PROJECT_DOCUMENTATION.md** - Detailed file-by-file documentation
- **POSTMAN_GUIDE.md** - Complete Postman testing guide
- **Postman_Collection.json** - Import this into Postman

---

## ✅ Verify Installation

1. Server starts without errors
2. Health check returns: `GET http://localhost:3000/health`
3. Database connection successful (check server logs)
4. Can register a user via Postman

---

## 🆘 Troubleshooting

### Database Connection Issues
- Verify database credentials in `.env`
- Check if database server is accessible
- Ensure database exists: `eventopia-db`
- Check firewall/network settings

### Port Already in Use
- Change `PORT` in `.env` file
- Or kill the process using port 3000

### Module Not Found Errors
- Run `npm install` again
- Delete `node_modules` and `package-lock.json`, then `npm install`

---

## 🎯 Next Steps

1. ✅ Install dependencies
2. ✅ Set up environment variables
3. ✅ Initialize database
4. ✅ Start server
5. ✅ Import Postman collection
6. ✅ Test API endpoints
7. 🚀 Start building your features!

Happy Coding! 🎉

