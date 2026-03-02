# Reusable Backend Starter - Complete Project Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Project Structure](#project-structure)
3. [File-by-File Documentation](#file-by-file-documentation)
4. [Architecture Patterns](#architecture-patterns)
5. [Data Flow](#data-flow)
6. [Extension Guide](#extension-guide)

---

## Project Overview

This is a production-ready backend starter template built with Node.js, Express.js, and PostgreSQL. It provides a solid foundation with authentication, authorization, CRUD operations, and reusable utility modules. The project follows best practices including separation of concerns, middleware composition, error handling, and standardized API responses.

**Key Technologies:**
- Node.js & Express.js (Web Framework)
- PostgreSQL (Database)
- JWT (JSON Web Tokens for Authentication)
- bcryptjs (Password Hashing)
- Helmet (Security Headers)
- CORS (Cross-Origin Resource Sharing)

---

## Project Structure

```
new-backend-project/
├── server.js                    # Application entry point
├── package.json                  # Dependencies and scripts
├── .gitignore                   # Git ignore rules
├── env.example                  # Environment variables template
├── README.md                     # Quick start guide
├── PROJECT_DOCUMENTATION.md     # This file - detailed documentation
└── src/
    ├── app.js                   # Express application setup
    ├── config/
    │   └── database.js          # Database connection configuration
    ├── controllers/
    │   ├── auth.controller.js   # Authentication endpoints handler
    │   ├── user.controller.js   # User management endpoints handler
    │   └── post.controller.js    # Post CRUD endpoints handler
    ├── middlewares/
    │   ├── auth.middleware.js   # JWT authentication middleware
    │   ├── error.middleware.js  # Global error handling middleware
    │   └── role.middleware.js   # Role-based access control middleware
    ├── models/
    │   └── init.sql             # Database schema definitions
    ├── routes/
    │   ├── index.js             # Route aggregator
    │   ├── auth.routes.js       # Authentication routes
    │   ├── user.routes.js       # User management routes
    │   └── post.routes.js       # Post CRUD routes
    ├── services/
    │   ├── auth.service.js      # Authentication business logic
    │   └── user.service.js      # User business logic
    └── utils/
        ├── apiResponse.js       # Standardized API response helper
        ├── appError.js          # Custom error class
        ├── asyncHandler.js      # Async error wrapper
        ├── logger.js            # Logging utility
        ├── pagination.js        # Pagination helper functions
        ├── translations.js      # Bilingual message support
        └── validation.js        # Input validation utilities
```

---

## File-by-File Documentation

### Root Level Files

#### `server.js`
**Purpose:** Application entry point and server initialization

**Responsibilities:**
- Loads environment variables using `dotenv`
- Creates HTTP server instance
- Starts the Express application
- Handles server errors and graceful shutdown
- Sets up process event listeners for unhandled rejections and exceptions

**Key Features:**
- Environment-based configuration
- Graceful shutdown handling (SIGTERM)
- Error logging for unhandled promise rejections
- Port configuration from environment variables

**Code Flow:**
1. Load `.env` file
2. Import Express app from `src/app.js`
3. Create HTTP server
4. Start listening on configured port
5. Set up error handlers

---

#### `package.json`
**Purpose:** Node.js project configuration and dependency management

**Key Sections:**
- **name:** Project identifier
- **version:** Project version
- **scripts:** NPM commands
  - `start`: Production server
  - `dev`: Development server with nodemon (auto-reload)
- **dependencies:** Production packages
  - `express`: Web framework
  - `pg`: PostgreSQL client
  - `jsonwebtoken`: JWT token generation/verification
  - `bcryptjs`: Password hashing
  - `helmet`: Security headers
  - `cors`: Cross-origin resource sharing
  - `dotenv`: Environment variable management
  - `body-parser`: Request body parsing
  - `express-rate-limit`: Rate limiting (ready to use)
- **devDependencies:** Development packages
  - `nodemon`: Auto-restart on file changes

---

#### `.gitignore`
**Purpose:** Specifies files and directories to exclude from version control

**Ignored Items:**
- `node_modules/`: Dependencies (should be installed via npm)
- `.env`: Environment variables (contains sensitive data)
- `uploads/`: User-uploaded files
- `*.log`: Log files
- `.DS_Store`: macOS system files
- IDE configuration directories

---

#### `env.example`
**Purpose:** Template for environment variables

**Variables Explained:**
- `DB_HOST`: PostgreSQL server hostname
- `DB_PORT`: PostgreSQL server port
- `DB_USER`: Database username
- `DB_PASSWORD`: Database password
- `DB_NAME`: Database name
- `JWT_SECRET`: Secret key for signing JWT tokens (MUST be changed in production)
- `JWT_EXPIRE`: Token expiration time (e.g., "7d", "24h")
- `PORT`: Server listening port
- `NODE_ENV`: Environment mode (development/production)
- `FRONTEND_URL`: Frontend application URL for CORS

**Usage:** Copy to `.env` and fill in actual values

---

### Source Files (`src/`)

#### `src/app.js`
**Purpose:** Express application configuration and middleware setup

**Key Responsibilities:**
- Initialize Express application
- Configure security middleware (Helmet)
- Set up CORS (Cross-Origin Resource Sharing)
- Configure body parsers (JSON and URL-encoded)
- Handle JSON parsing errors
- Serve static files (uploads directory)
- Attach database pool to requests
- Mount API routes
- Set up global error handler
- Provide health check endpoint

**Middleware Order (Critical):**
1. Security (Helmet)
2. CORS
3. Body parsers
4. JSON error handler
5. Static file serving
6. Request logging (development only)
7. Database attachment
8. API routes
9. 404 handler
10. Error handler (must be last)

**Key Features:**
- Request size limits (10MB JSON, 50MB form data)
- Development mode request logging
- Health check endpoint at `/health`
- Root endpoint with API information

---

#### `src/config/database.js`
**Purpose:** PostgreSQL database connection pool configuration

**Key Features:**
- Connection pooling (max 20 connections)
- Automatic connection timeout handling
- UTC timezone configuration
- Error handling and logging
- Connection test on module load

**Configuration:**
- **max:** Maximum number of clients in pool (20)
- **idleTimeoutMillis:** Close idle connections after 30 seconds
- **connectionTimeoutMillis:** Fail connection attempts after 5 seconds
- **options:** Set timezone to UTC for all connections

**Exports:**
- `pool`: PostgreSQL connection pool instance
- `query`: Wrapper function for executing queries with error handling

**Usage Pattern:**
```javascript
const { pool, query } = require('./config/database');
// Use pool.query() or query() helper
```

---

### Controllers (`src/controllers/`)

Controllers handle HTTP requests and responses. They use services for business logic and return standardized API responses.

#### `src/controllers/auth.controller.js`
**Purpose:** Handle authentication-related HTTP requests

**Endpoints Handled:**
1. **POST /api/auth/login**
   - Validates email and password
   - Calls `AuthService.login()`
   - Returns user data and JWT token

2. **POST /api/auth/register**
   - Validates name, email, password
   - Calls `AuthService.register()`
   - Returns new user data and JWT token

3. **GET /api/auth/profile** (Protected)
   - Returns current authenticated user's profile
   - Uses `protect` middleware

4. **POST /api/auth/change-password** (Protected)
   - Validates current and new password
   - Calls `AuthService.changePassword()`
   - Returns success message

**Pattern Used:**
- `asyncHandler` wrapper to catch async errors
- `AppError` for custom error handling
- `apiResponse` for standardized responses
- Input validation before service calls

---

#### `src/controllers/user.controller.js`
**Purpose:** Handle user management HTTP requests (Admin only)

**Endpoints Handled:**
1. **GET /api/users** (Admin only)
   - Returns paginated list of all users
   - Uses `UserService.findAll()`

2. **GET /api/users/:id** (Admin only)
   - Returns specific user by ID
   - Uses `UserService.findById()`

3. **PUT /api/users/:id** (Admin only)
   - Updates user information
   - Uses `UserService.update()`

4. **DELETE /api/users/:id** (Admin only)
   - Soft deletes a user
   - Uses `UserService.delete()`

**Security:**
- All routes protected with `protect` middleware
- All routes restricted to `admin` role using `restrictTo` middleware
- Passwords are never returned in responses

---

#### `src/controllers/post.controller.js`
**Purpose:** Handle post CRUD operations (Example resource)

**Endpoints Handled:**
1. **GET /api/posts**
   - Returns paginated list of all posts
   - Public endpoint (no authentication required for reading)

2. **GET /api/posts/:id**
   - Returns specific post by ID
   - Public endpoint

3. **POST /api/posts** (Protected)
   - Creates a new post
   - Associates post with authenticated user
   - Requires authentication

4. **PUT /api/posts/:id** (Protected)
   - Updates a post
   - Only post owner or admin can update
   - Ownership check included

5. **DELETE /api/posts/:id** (Protected)
   - Soft deletes a post
   - Only post owner or admin can delete
   - Ownership check included

**Features:**
- Pagination support
- Ownership validation
- Admin override for updates/deletes
- Soft delete pattern

---

### Middlewares (`src/middlewares/`)

Middlewares are functions that execute during the request-response cycle. They can modify requests, responses, or terminate the cycle.

#### `src/middlewares/auth.middleware.js`
**Purpose:** JWT token verification and user authentication

**Functions:**

1. **`protect` (Middleware Function)**
   - Extracts JWT token from `Authorization` header
   - Verifies token signature and expiration
   - Queries database to ensure user still exists and is not blocked
   - Attaches authenticated user to `req.user`
   - Calls `next()` if successful, or passes error to error handler

   **Token Format:** `Bearer <token>`

   **Error Cases:**
   - No token provided → 401 Unauthorized
   - Invalid token → 401 Unauthorized
   - Expired token → 401 Unauthorized
   - User not found or blocked → 401 Unauthorized

2. **`restrictTo(...roles)` (Middleware Factory)**
   - Checks if authenticated user's role matches required roles
   - Returns 403 Forbidden if role doesn't match
   - Must be used after `protect` middleware

**Usage:**
```javascript
router.get('/protected', protect, controller.handler);
router.post('/admin-only', protect, restrictTo('admin'), controller.handler);
```

---

#### `src/middlewares/error.middleware.js`
**Purpose:** Global error handling middleware

**Key Features:**
- Catches all errors from route handlers
- Maps database errors to user-friendly messages
- Provides different error details in development vs production
- Supports bilingual error messages
- Logs errors for debugging

**Error Handling Flow:**
1. Receives error from previous middleware/route
2. Handles database-specific errors (PostgreSQL error codes)
3. Sets default status code (500 if not set)
4. Gets translations for error message
5. Returns appropriate response based on environment

**Database Error Mapping:**
- `23505`: Duplicate entry → 409 Conflict
- `23503`: Foreign key violation → 404 Not Found
- `23502`: Not null violation → 400 Bad Request
- UUID syntax errors → 400 Bad Request

**Response Format:**
- Development: Includes stack trace and request details
- Production: Hides internal errors, shows only operational errors

**Must be last middleware** in the middleware chain.

---

#### `src/middlewares/role.middleware.js`
**Purpose:** Role-based access control middleware

**Functions:**

1. **`requireRole(role)` (Middleware Factory)**
   - Returns middleware that checks for specific role
   - Case-insensitive role comparison
   - Returns 403 if role doesn't match

2. **`allowRoles(...roles)` (Middleware Factory)**
   - Returns middleware that checks if user has one of the allowed roles
   - Accepts multiple roles as arguments
   - Returns 403 if user role not in allowed list

**Usage:**
```javascript
router.get('/admin', protect, requireRole('admin'), controller.handler);
router.get('/staff', protect, allowRoles('admin', 'manager'), controller.handler);
```

**Note:** These are alternative to `restrictTo` in `auth.middleware.js`. Both can be used.

---

### Routes (`src/routes/`)

Routes define API endpoints and connect HTTP methods to controller functions.

#### `src/routes/index.js`
**Purpose:** Central route aggregator

**Responsibilities:**
- Imports all route modules
- Mounts them under `/api` prefix (handled in `app.js`)
- Provides single entry point for all routes

**Route Structure:**
- `/api/auth/*` → Authentication routes
- `/api/users/*` → User management routes
- `/api/posts/*` → Post CRUD routes

**Benefits:**
- Single file to manage route organization
- Easy to add new route modules
- Clear API structure

---

#### `src/routes/auth.routes.js`
**Purpose:** Define authentication endpoints

**Routes:**
- `POST /api/auth/login` → `authController.login`
- `POST /api/auth/register` → `authController.register`
- `GET /api/auth/profile` → `authController.getProfile` (protected)
- `POST /api/auth/change-password` → `authController.changePassword` (protected)

**Middleware:**
- Public routes: No authentication required
- Protected routes: Use `protect` middleware

---

#### `src/routes/user.routes.js`
**Purpose:** Define user management endpoints (Admin only)

**Routes:**
- `GET /api/users` → `userController.getAllUsers` (admin only)
- `GET /api/users/:id` → `userController.getUserById` (admin only)
- `PUT /api/users/:id` → `userController.updateUser` (admin only)
- `DELETE /api/users/:id` → `userController.deleteUser` (admin only)

**Middleware:**
- All routes use `protect` middleware
- All routes use `restrictTo('admin')` middleware

---

#### `src/routes/post.routes.js`
**Purpose:** Define post CRUD endpoints

**Routes:**
- `GET /api/posts` → `postController.getAllPosts`
- `GET /api/posts/:id` → `postController.getPostById`
- `POST /api/posts` → `postController.createPost` (protected)
- `PUT /api/posts/:id` → `postController.updatePost` (protected)
- `DELETE /api/posts/:id` → `postController.deletePost` (protected)

**Middleware:**
- Read operations: No authentication required
- Write operations: Use `protect` middleware
- Ownership checks handled in controller

---

### Services (`src/services/`)

Services contain business logic and database operations. They are called by controllers.

#### `src/services/auth.service.js`
**Purpose:** Authentication business logic

**Class Methods (Static):**

1. **`login(email, password)`**
   - Finds user by email using `UserService`
   - Checks if user is blocked
   - Compares password with bcrypt
   - Generates JWT token
   - Returns user data (without password) and token

2. **`register(userData)`**
   - Checks if email already exists
   - Hashes password with bcrypt (12 rounds)
   - Creates new user via `UserService`
   - Generates JWT token
   - Returns user data and token

3. **`generateAccessToken(user)`**
   - Creates JWT payload (id, role, email)
   - Signs token with JWT_SECRET
   - Sets expiration from JWT_EXPIRE env variable
   - Returns JWT token string

4. **`changePassword(userId, currentPassword, newPassword)`**
   - Retrieves user by ID
   - Verifies current password
   - Hashes new password
   - Updates password in database

**Error Handling:**
- Throws descriptive errors for invalid credentials
- Logs errors using logger utility

---

#### `src/services/user.service.js`
**Purpose:** User data access and business logic

**Class Methods (Static):**

1. **`findByEmail(email)`**
   - Queries database for user by email
   - Excludes soft-deleted users
   - Returns user object or null

2. **`findById(id)`**
   - Queries database for user by ID
   - Excludes soft-deleted users
   - Returns user object or null

3. **`create(userData)`**
   - Inserts new user into database
   - Returns created user object
   - Handles database errors

4. **`update(id, updateData)`**
   - Validates allowed fields (name, email, phone_number, profile_image, block_status)
   - Builds dynamic UPDATE query
   - Updates only provided fields
   - Returns updated user object

5. **`delete(id)`**
   - Performs soft delete (sets deleted_at timestamp)
   - Does not permanently remove record
   - Returns success status

6. **`findAll(options)`**
   - Retrieves paginated list of users
   - Calculates total count
   - Returns users array and pagination metadata
   - Excludes soft-deleted users

**Features:**
- Soft delete pattern (deleted_at column)
- Field whitelisting for updates
- Pagination support
- Error logging

---

### Utilities (`src/utils/`)

Utility modules provide reusable helper functions used throughout the application.

#### `src/utils/apiResponse.js`
**Purpose:** Standardized API response formatting

**Functions:**

1. **`apiResponse(res, status, message, data)`**
   - Main response function
   - Automatically determines if response is error (status >= 400)
   - Gets bilingual translations for message
   - Returns consistent JSON format

2. **`successResponse(res, {message, data}, status)`**
   - Helper for success responses
   - Default status: 200
   - Includes bilingual messages

3. **`errorResponse(res, message, status)`**
   - Helper for error responses
   - Default status: 500
   - Includes bilingual messages

**Response Format:**
```json
{
  "error": false,
  "message": "English message",
  "message_en": "English message",
  "message_es": "Spanish message",
  "data": { /* optional data */ }
}
```

**Benefits:**
- Consistent API responses
- Automatic bilingual support
- Easy to use across all controllers

---

#### `src/utils/appError.js`
**Purpose:** Custom error class for application errors

**Class: `AppError` extends Error**

**Properties:**
- `statusCode`: HTTP status code
- `status`: "fail" (4xx) or "error" (5xx)
- `isOperational`: Boolean flag (true for AppError instances)
- `message_en`, `message_es`: Optional translations

**Features:**
- Captures stack trace
- Distinguishes operational errors from programming errors
- Supports bilingual error messages
- Used by error middleware to determine response format

**Usage:**
```javascript
throw new AppError("User not found", 404);
```

---

#### `src/utils/asyncHandler.js`
**Purpose:** Wrapper to handle async route handler errors

**Function: `asyncHandler(fn)`**

**How it works:**
- Takes an async function as parameter
- Returns a new function that wraps the async function
- Catches any errors and passes them to Express error handler
- Eliminates need for try-catch blocks in route handlers

**Usage:**
```javascript
// Without asyncHandler (needs try-catch):
exports.handler = async (req, res, next) => {
  try {
    const result = await someAsyncOperation();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// With asyncHandler (cleaner):
exports.handler = asyncHandler(async (req, res, next) => {
  const result = await someAsyncOperation();
  res.json(result);
  // Errors automatically passed to error middleware
});
```

---

#### `src/utils/logger.js`
**Purpose:** Simple logging utility

**Methods:**

1. **`logger.info(message)`**
   - Logs informational messages
   - Includes timestamp

2. **`logger.error(message, error)`**
   - Logs error messages
   - Optionally includes error object

3. **`logger.warn(message)`**
   - Logs warning messages
   - Includes timestamp

4. **`logger.debug(message)`**
   - Logs debug messages
   - Only in development mode

**Features:**
- Timestamp formatting (ISO format)
- Environment-aware (debug only in development)
- Can be replaced with Winston or other logging libraries

**Future Enhancement:**
- File logging
- Log levels configuration
- Log rotation

---

#### `src/utils/pagination.js`
**Purpose:** Pagination helper functions

**Functions:**

1. **`generatePagination(page, limit, total)`**
   - Creates standardized pagination object
   - Calculates total pages
   - Determines if next/previous pages exist
   - Returns: `{page, limit, total, pages, has_next, has_prev}`

2. **`calculateOffset(page, limit)`**
   - Calculates SQL OFFSET value
   - Formula: `(page - 1) * limit`

3. **`validatePaginationParams(page, limit, maxLimit)`**
   - Validates and sanitizes pagination parameters
   - Ensures page >= 1
   - Ensures limit is within bounds (1 to maxLimit)
   - Returns validated `{page, limit, offset}`

4. **`generateEmptyPagination(page, limit)`**
   - Generates pagination object for empty results
   - Total is always 0

5. **`generateExtendedPagination(page, limit, total, additionalMeta)`**
   - Extended pagination with additional metadata
   - Includes `has_data`, `current_page_items`, `range` (start/end)

**Usage:**
```javascript
const { validatePaginationParams, generatePagination } = require('./utils/pagination');

const { page, limit, offset } = validatePaginationParams(req.query.page, req.query.limit);
const pagination = generatePagination(page, limit, total);
```

---

#### `src/utils/translations.js`
**Purpose:** Bilingual message support (English/Spanish)

**Structure:**
- `translations` object: Maps message keys to `{en, es}` objects
- `getTranslations(message)`: Retrieves translations for a message

**Features:**
- Exact match lookup
- Partial match fallback
- Default to original message if no translation found
- Used by `apiResponse` for automatic bilingual support

**Adding Translations:**
```javascript
translations["New message"] = {
  en: "New message",
  es: "Nuevo mensaje"
};
```

**Current Translations:**
- Authentication messages (login, register, password change)
- CRUD operation messages
- Error messages
- General messages

---

#### `src/utils/validation.js`
**Purpose:** Input validation utilities

**Functions:**

1. **`validateRequired(data, fields)`**
   - Validates required fields in data object
   - Can validate specific fields or all fields
   - Returns `{isValid: boolean, message?: string}`

2. **`validateEmail(email)`**
   - Validates email format using regex
   - Returns boolean

3. **`validatePhone(phone)`**
   - Validates phone number format
   - Supports international format with +
   - Returns boolean

4. **`validateGPS(lat, lng)`**
   - Validates GPS coordinates
   - Latitude: -90 to 90
   - Longitude: -180 to 180
   - Returns `{isValid: boolean, message?: string}`

5. **`validateDate(date)`**
   - Validates date format (YYYY-MM-DD)
   - Checks if date is valid
   - Returns `{isValid: boolean, message?: string}`

6. **`sanitizeString(str)`**
   - Removes HTML tags (< and >)
   - Trims whitespace
   - Returns sanitized string

**Usage:**
```javascript
const { validateEmail, validateRequired } = require('./utils/validation');

if (!validateEmail(email)) {
  return next(new AppError("Invalid email format", 400));
}

const validation = validateRequired(req.body, ['name', 'email']);
if (!validation.isValid) {
  return next(new AppError(validation.message, 400));
}
```

---

### Models (`src/models/`)

#### `src/models/init.sql`
**Purpose:** Database schema definitions

**Tables:**

1. **`users` Table**
   - `id`: Primary key (SERIAL)
   - `name`: User's full name (VARCHAR 255)
   - `email`: Unique email address (VARCHAR 255, UNIQUE)
   - `password`: Hashed password (VARCHAR 255)
   - `role`: User role ('user' or 'admin', default: 'user')
   - `phone_number`: Optional phone number (VARCHAR 20)
   - `profile_image`: Optional profile image URL (TEXT)
   - `block_status`: Account blocking flag (BOOLEAN, default: false)
   - `created_at`: Creation timestamp (TIMESTAMP, auto)
   - `updated_at`: Last update timestamp (TIMESTAMP, auto)
   - `deleted_at`: Soft delete timestamp (TIMESTAMP, nullable)

   **Indexes:**
   - `idx_users_email`: Fast email lookups
   - `idx_users_role`: Fast role-based queries
   - `idx_users_deleted_at`: Fast soft-delete filtering

2. **`posts` Table** (Example CRUD Resource)
   - `id`: Primary key (SERIAL)
   - `title`: Post title (VARCHAR 255)
   - `content`: Post content (TEXT)
   - `user_id`: Foreign key to users table (INTEGER)
   - `created_at`: Creation timestamp (TIMESTAMP, auto)
   - `updated_at`: Last update timestamp (TIMESTAMP, auto)
   - `deleted_at`: Soft delete timestamp (TIMESTAMP, nullable)

   **Indexes:**
   - `idx_posts_user_id`: Fast user-based queries
   - `idx_posts_deleted_at`: Fast soft-delete filtering
   - `idx_posts_created_at`: Fast date-based sorting

**Features:**
- Soft delete pattern (deleted_at column)
- Foreign key constraints with CASCADE delete
- Automatic timestamps
- Role constraint (CHECK constraint)
- Indexes for performance

**Usage:**
```bash
psql -U postgres -d database_name -f src/models/init.sql
```

---

## Architecture Patterns

### 1. **Layered Architecture**
- **Routes Layer:** HTTP endpoint definitions
- **Controller Layer:** Request/response handling
- **Service Layer:** Business logic
- **Data Access Layer:** Database queries (in services)

### 2. **Middleware Pattern**
- Request flows through middleware chain
- Each middleware can modify request/response or terminate
- Error middleware catches all errors

### 3. **Service Layer Pattern**
- Business logic separated from HTTP concerns
- Services are reusable and testable
- Controllers are thin, just handle HTTP

### 4. **Soft Delete Pattern**
- Records marked as deleted with `deleted_at` timestamp
- Records not permanently removed
- Queries filter out soft-deleted records
- Allows data recovery and audit trails

### 5. **Error Handling Pattern**
- Custom `AppError` class for operational errors
- Global error middleware catches all errors
- Consistent error response format
- Different detail levels for dev/production

### 6. **Standardized Response Pattern**
- All API responses follow same format
- Automatic bilingual support
- Consistent error/success structure

---

## Data Flow

### Request Flow Example: Creating a Post

1. **Client sends request:**
   ```
   POST /api/posts
   Authorization: Bearer <token>
   Body: { "title": "My Post", "content": "Content here" }
   ```

2. **Express App (`app.js`):**
   - CORS middleware processes request
   - Body parser extracts JSON body
   - Routes to `/api/posts`

3. **Route (`post.routes.js`):**
   - Matches POST `/api/posts`
   - Applies `protect` middleware

4. **Auth Middleware (`auth.middleware.js`):**
   - Extracts token from header
   - Verifies JWT token
   - Queries database for user
   - Attaches user to `req.user`
   - Calls `next()`

5. **Controller (`post.controller.js`):**
   - `createPost` handler receives request
   - Validates input (title, content)
   - Calls database query directly (or could use service)
   - Returns response via `apiResponse`

6. **Response (`apiResponse.js`):**
   - Formats response with bilingual messages
   - Returns JSON to client

7. **Error Handling (if error occurs):**
   - Error caught by `asyncHandler`
   - Passed to error middleware
   - Error middleware formats error response
   - Returns error JSON to client

---

## Extension Guide

### Adding a New Resource (e.g., "Comments")

1. **Create Database Table:**
   ```sql
   -- Add to src/models/init.sql
   CREATE TABLE IF NOT EXISTS comments (
     id SERIAL PRIMARY KEY,
     content TEXT NOT NULL,
     post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
     user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW(),
     deleted_at TIMESTAMP
   );
   ```

2. **Create Service:**
   ```javascript
   // src/services/comment.service.js
   class CommentService {
     static async create(commentData) { /* ... */ }
     static async findByPostId(postId) { /* ... */ }
     // ... other methods
   }
   ```

3. **Create Controller:**
   ```javascript
   // src/controllers/comment.controller.js
   exports.createComment = asyncHandler(async (req, res, next) => {
     // ... implementation
   });
   ```

4. **Create Routes:**
   ```javascript
   // src/routes/comment.routes.js
   router.post('/', protect, commentController.createComment);
   ```

5. **Mount Routes:**
   ```javascript
   // src/routes/index.js
   router.use('/comments', commentRoutes);
   ```

### Adding New Middleware

1. Create file in `src/middlewares/`
2. Export middleware function
3. Import and use in routes or `app.js`

### Adding New Utility

1. Create file in `src/utils/`
2. Export utility functions
3. Import where needed

---

## Security Considerations

1. **JWT Secret:** Must be changed in production
2. **Password Hashing:** Uses bcrypt with 12 rounds
3. **SQL Injection:** Prevented by parameterized queries
4. **CORS:** Configured for specific origins in production
5. **Rate Limiting:** Package included, configure in production
6. **Helmet:** Security headers automatically applied
7. **Input Validation:** Validate all user inputs
8. **Error Messages:** Don't expose sensitive info in production

---

## Best Practices Implemented

✅ Separation of concerns (routes → controllers → services)
✅ Error handling with custom error class
✅ Async/await with error wrapper
✅ Soft delete pattern
✅ Pagination support
✅ Input validation
✅ Security headers
✅ Connection pooling
✅ Environment-based configuration
✅ Logging
✅ Bilingual support
✅ Standardized API responses
✅ Role-based access control
✅ Middleware composition

---

## Conclusion

This project provides a solid foundation for building backend applications. All modules are reusable, well-structured, and follow industry best practices. The codebase is clean, maintainable, and ready for extension.

For questions or issues, refer to the original biometric-pro backend project or consult the README.md for quick start instructions.

