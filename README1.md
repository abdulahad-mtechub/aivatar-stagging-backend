# Reusable Backend Starter

A comprehensive, production-ready backend starter template built with Node.js, Express, and PostgreSQL. This project reutilizes proven modules and patterns from the biometric-pro backend project.

## Features

✅ **Authentication & Authorization**
- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control (RBAC)
- Protected routes middleware

✅ **Database**
- PostgreSQL with connection pooling
- Soft delete pattern
- Migration-ready structure

✅ **Utilities**
- Standardized API responses (bilingual support)
- Error handling middleware
- Input validation utilities
- Pagination utilities
- Async handler wrapper
- Logger utility

✅ **CRUD Operations**
- User management (admin only)
- Example Post resource with full CRUD
- Pagination support

✅ **Security**
- Helmet.js for security headers
- CORS configuration
- Rate limiting ready
- Input sanitization

## Project Structure

```
new-backend-project/
├── src/
│   ├── config/
│   │   └── database.js          # PostgreSQL connection pool
│   ├── controllers/
│   │   ├── auth.controller.js   # Authentication endpoints
│   │   ├── user.controller.js   # User management
│   │   └── post.controller.js   # Example CRUD resource
│   ├── middlewares/
│   │   ├── auth.middleware.js   # JWT verification
│   │   ├── error.middleware.js  # Global error handler
│   │   └── role.middleware.js    # Role-based access control
│   ├── models/
│   │   └── init.sql             # Database schema
│   ├── routes/
│   │   ├── auth.routes.js       # Auth routes
│   │   ├── user.routes.js       # User routes
│   │   ├── post.routes.js       # Post routes
│   │   └── index.js             # Route aggregator
│   ├── services/
│   │   ├── auth.service.js      # Authentication logic
│   │   └── user.service.js      # User business logic
│   ├── utils/
│   │   ├── apiResponse.js       # Standardized responses
│   │   ├── appError.js          # Custom error class
│   │   ├── asyncHandler.js      # Async wrapper
│   │   ├── logger.js            # Logging utility
│   │   ├── pagination.js        # Pagination helpers
│   │   ├── translations.js      # Bilingual support
│   │   └── validation.js        # Input validation
│   └── app.js                   # Express app setup
├── .env.example                 # Environment variables template
├── .gitignore
├── package.json
├── README.md
└── server.js                    # Server entry point
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Database Setup

1. Create a PostgreSQL database:
```sql
CREATE DATABASE reusable_backend_db;
```

2. Update `.env` file with your database credentials:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=reusable_backend_db
```

3. Run the database schema:
```bash
psql -U postgres -d reusable_backend_db -f src/models/init.sql
```

Or using the PostgreSQL client:
```sql
\i src/models/init.sql
```

### 3. Environment Variables

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Required environment variables:
- `DB_HOST` - Database host
- `DB_PORT` - Database port
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name
- `JWT_SECRET` - Secret key for JWT tokens (change in production!)
- `JWT_EXPIRE` - JWT expiration time (e.g., "7d")
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

### 4. Run the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on `http://localhost:3000`

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get current user profile (protected)
- `POST /api/auth/change-password` - Change password (protected)

### Users (Admin Only)

- `GET /api/users` - Get all users (paginated)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (soft delete)

### Posts (Example CRUD Resource)

- `GET /api/posts` - Get all posts (paginated)
- `GET /api/posts/:id` - Get post by ID
- `POST /api/posts` - Create new post (protected)
- `PUT /api/posts/:id` - Update post (protected, owner or admin)
- `DELETE /api/posts/:id` - Delete post (protected, owner or admin)

## API Response Format

All API responses follow a standardized format:

**Success Response:**
```json
{
  "error": false,
  "message": "Resource retrieved successfully",
  "message_en": "Resource retrieved successfully",
  "message_es": "Recurso obtenido con éxito",
  "data": {
    // Response data
  }
}
```

**Error Response:**
```json
{
  "error": true,
  "message": "Error message",
  "message_en": "Error message",
  "message_es": "Mensaje de error"
}
```

## Authentication

To access protected routes, include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Example Usage

### Register a User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "role": "user"
  }'
```

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Create a Post (Protected)

```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{
    "title": "My First Post",
    "content": "This is the content of my post"
  }'
```

## Reusable Modules

This project includes the following reusable modules that can be used as a foundation for new backend projects:

1. **Authentication & Authorization Module**
   - JWT token generation and verification
   - Password hashing with bcrypt
   - Role-based access control

2. **Database Configuration**
   - PostgreSQL connection pooling
   - Error handling
   - UTC timezone configuration

3. **Utility Modules**
   - Standardized API responses
   - Error handling
   - Input validation
   - Pagination utilities
   - Bilingual support (English/Spanish)

4. **Middleware**
   - Authentication middleware
   - Error handling middleware
   - Role-based access control

5. **Service Layer Pattern**
   - Separation of concerns
   - Reusable service methods

## Extending the Project

### Adding a New Resource

1. Create a new table in `src/models/init.sql`
2. Create a service in `src/services/`
3. Create a controller in `src/controllers/`
4. Create routes in `src/routes/`
5. Mount routes in `src/routes/index.js`

### Adding New Middleware

1. Create middleware in `src/middlewares/`
2. Import and use in routes or `app.js`

### Adding New Utilities

1. Add utility functions in `src/utils/`
2. Import where needed

## Security Best Practices

- ✅ Change `JWT_SECRET` in production
- ✅ Use strong passwords
- ✅ Enable HTTPS in production
- ✅ Implement rate limiting for production
- ✅ Regularly update dependencies
- ✅ Use environment variables for sensitive data

## License

ISC

## Support

For issues or questions, please refer to the original biometric-pro backend project documentation.

