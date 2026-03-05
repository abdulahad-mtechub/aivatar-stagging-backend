# Postman API Testing Guide

This guide explains how to use the Postman collection to test all API endpoints in the Reusable Backend Starter project.

## 📋 Table of Contents
1. [Importing the Collection](#importing-the-collection)
2. [Setting Up Environment Variables](#setting-up-environment-variables)
3. [API Endpoints Overview](#api-endpoints-overview)
4. [Testing Workflow](#testing-workflow)
5. [Troubleshooting](#troubleshooting)

---

## Importing the Collection

### Step 1: Import Collection
1. Open Postman
2. Click **Import** button (top left)
3. Select **File** tab
4. Choose `Postman_Collection.json` from the project root
5. Click **Import**

### Step 2: Create Environment
1. Click **Environments** in the left sidebar
2. Click **+** to create a new environment
3. Name it: `Reusable Backend - Local` or `Reusable Backend - Production`
4. Add the following variables:

| Variable | Initial Value | Current Value |
|----------|---------------|---------------|
| `base_url` | `http://localhost:3000` | `http://localhost:3000` |
| `auth_token` | (leave empty) | (will be auto-filled) |
| `admin_token` | (leave empty) | (will be auto-filled) |
| `user_id` | (leave empty) | (will be auto-filled) |
| `admin_id` | (leave empty) | (will be auto-filled) |
| `post_id` | (leave empty) | (will be auto-filled) |

5. Click **Save**
6. Select your environment from the dropdown (top right)

---

## Setting Up Environment Variables

The collection uses environment variables for:
- **base_url**: Your server URL (default: `http://localhost:3000`)
- **auth_token**: JWT token for regular users (auto-saved after login/register)
- **admin_token**: JWT token for admin users (auto-saved after admin login/register)
- **user_id**: User ID (auto-saved)
- **admin_id**: Admin user ID (auto-saved)
- **post_id**: Post ID (auto-saved after creating a post)

**Note:** Tokens are automatically saved when you:
- Register a new user
- Login as a user
- Create a post

---

## API Endpoints Overview

### 🔐 Authentication Endpoints

#### 1. Register User
- **Method:** `POST`
- **URL:** `/api/auth/register`
- **Auth:** Not required
- **Body:**
```json
{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "role": "user"
}
```
- **Response:** User data + JWT token (token auto-saved to `auth_token`)

#### 2. Register Admin
- **Method:** `POST`
- **URL:** `/api/auth/register`
- **Auth:** Not required
- **Body:**
```json
{
    "name": "Admin User",
    "email": "admin@example.com",
    "password": "admin123",
    "role": "admin"
}
```
- **Response:** Admin data + JWT token (token auto-saved to `admin_token`)

#### 3. Login User
- **Method:** `POST`
- **URL:** `/api/auth/login`
- **Auth:** Not required
- **Body:**
```json
{
    "email": "john@example.com",
    "password": "password123"
}
```
- **Response:** User data + JWT token (token auto-saved to `auth_token`)

#### 4. Login Admin
- **Method:** `POST`
- **URL:** `/api/auth/admin/login`
- **Auth:** Not required
- **Body:**
```json
{
    "email": "admin@example.com",
    "password": "admin123"
}
```
- **Response:** Admin data + JWT token (token auto-saved to `admin_token`)

#### 5. Get Profile
- **Method:** `GET`
- **URL:** `/api/auth/profile`
- **Auth:** Required (Bearer Token)
- **Headers:** `Authorization: Bearer {{auth_token}}`
- **Response:** Current user's profile

#### 6. Change Password
- **Method:** `POST`
- **URL:** `/api/auth/change-password`
- **Auth:** Required (Bearer Token)
- **Body:**
```json
{
    "currentPassword": "password123",
    "newPassword": "newpassword123"
}
```
- **Response:** Success message

---

### 👥 Users Endpoints (Admin Only)

#### 1. Get All Users
- **Method:** `GET`
- **URL:** `/api/users?page=1&limit=10`
- **Auth:** Required (Admin Bearer Token)
- **Query Parameters:**
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 10)
- **Response:** Paginated list of users

#### 2. Get User By ID
- **Method:** `GET`
- **URL:** `/api/users/:id`
- **Auth:** Required (Admin Bearer Token)
- **Response:** User details

#### 3. Update User
- **Method:** `PUT`
- **URL:** `/api/users/:id`
- **Auth:** Required (Admin Bearer Token)
- **Body:**
```json
{
    "name": "Updated Name",
    "phone_number": "+1234567890"
}
```
- **Response:** Updated user data

#### 4. Delete User
- **Method:** `DELETE`
- **URL:** `/api/users/:id`
- **Auth:** Required (Admin Bearer Token)
- **Response:** Success message

---

### 👤 User Endpoints

#### 1. Delete My Account
- **Method:** `DELETE`
- **URL:** `/api/users/me`
- **Auth:** Required (Bearer Token)
- **Response:** Success message
- **Note:** This will soft-delete your own account.

---

### 📄 Content Management Endpoints

#### 1. Upsert Content (Admin Only)
- **Method:** `POST`
- **URL:** `/api/content`
- **Auth:** Required (Admin Bearer Token)
- **Body:**
```json
{
    "type": "privacy_policy",
    "content": "Our privacy policy text...",
    "status": true
}
```
- **Response:** Upserted content record
- **Note:** Creates record if `type` is new, updates existing if it exists.

#### 2. Get Content By Type
- **Method:** `GET`
- **URL:** `/api/content/:type`
- **Auth:** Not required (Public)
- **Example:** `/api/content/privacy_policy`
- **Response:** Content record

---

### 📝 Posts Endpoints (CRUD Example)

#### 1. Get All Posts
- **Method:** `GET`
- **URL:** `/api/posts?page=1&limit=10`
- **Auth:** Not required (Public)
- **Query Parameters:**
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 10)
- **Response:** Paginated list of posts

#### 2. Get Post By ID
- **Method:** `GET`
- **URL:** `/api/posts/:id`
- **Auth:** Not required (Public)
- **Response:** Post details

#### 3. Create Post
- **Method:** `POST`
- **URL:** `/api/posts`
- **Auth:** Required (Bearer Token)
- **Body:**
```json
{
    "title": "My First Post",
    "content": "This is the content of my first post."
}
```
- **Response:** Created post data (post ID auto-saved to `post_id`)

#### 4. Update Post
- **Method:** `PUT`
- **URL:** `/api/posts/:id`
- **Auth:** Required (Bearer Token)
- **Body:**
```json
{
    "title": "Updated Post Title",
    "content": "Updated content of the post."
}
```
- **Response:** Updated post data
- **Note:** Only post owner or admin can update

#### 5. Delete Post
- **Method:** `DELETE`
- **URL:** `/api/posts/:id`
- **Auth:** Required (Bearer Token)
- **Response:** Success message
- **Note:** Only post owner or admin can delete

---

### 🏥 Health Check Endpoints

#### 1. Health Check
- **Method:** `GET`
- **URL:** `/health`
- **Auth:** Not required
- **Response:** Server status and uptime

#### 2. Root Endpoint
- **Method:** `GET`
- **URL:** `/`
- **Auth:** Not required
- **Response:** API information and available endpoints

---

## Testing Workflow

### Recommended Testing Order

1. **Health Check**
   - Run "Health Check" to verify server is running
   - Should return status: "UP"

2. **Register Users**
   - Run "Register User" to create a regular user
   - Run "Register Admin" to create an admin user
   - Tokens are automatically saved

3. **Login (Optional)**
   - Run "Login User" or "Login Admin" if you want to test login
   - Tokens will be updated automatically

4. **Test Protected Endpoints**
   - Run "Get Profile" to verify authentication works
   - Token is automatically included from environment

5. **Test Posts (CRUD)**
   - Run "Create Post" (requires auth token)
   - Post ID is automatically saved
   - Run "Get All Posts" (public, no auth needed)
   - Run "Get Post By ID" (public)
   - Run "Update Post" (requires auth, uses saved post_id)
   - Run "Delete Post" (requires auth, uses saved post_id)

6. **Test Admin Endpoints**
   - Switch to admin token in environment or use "admin_token" variable
   - Run "Get All Users" (admin only)
   - Run other admin endpoints

---

## Response Format

All API responses follow a standardized format:

### Success Response
```json
{
    "error": false,
    "message": "Resource retrieved successfully",
    "message_en": "Resource retrieved successfully",
    "message_es": "Recurso obtenido con éxito",
    "data": {
        // Response data here
    }
}
```

### Error Response
```json
{
    "error": true,
    "message": "Error message",
    "message_en": "Error message",
    "message_es": "Mensaje de error"
}
```

### Pagination Response
```json
{
    "error": false,
    "message": "Resources retrieved successfully",
    "data": {
        "posts": [...],
        "pagination": {
            "page": 1,
            "limit": 10,
            "total": 50,
            "pages": 5,
            "has_next": true,
            "has_prev": false
        }
    }
}
```

---

## Troubleshooting

### Issue: "Cannot find base_url"
**Solution:** 
- Make sure you've created an environment
- Set the `base_url` variable in your environment
- Select the environment from the dropdown (top right)

### Issue: "401 Unauthorized"
**Solutions:**
- Make sure you've registered/logged in first
- Check that the token is saved in environment variables
- Verify the token hasn't expired (default: 7 days)
- Try logging in again to get a fresh token

### Issue: "403 Forbidden"
**Solutions:**
- Check that you're using the correct token (admin_token for admin endpoints)
- Verify your user has the required role
- Make sure you're the owner of the resource (for posts update/delete)

### Issue: "404 Not Found"
**Solutions:**
- Verify the server is running on the correct port
- Check the `base_url` in your environment
- Ensure the endpoint path is correct
- Check if the resource ID exists

### Issue: "500 Internal Server Error"
**Solutions:**
- Check server logs for detailed error messages
- Verify database connection is working
- Ensure database schema is initialized
- Check environment variables are set correctly

### Issue: Token Not Auto-Saving
**Solutions:**
- Make sure you're using the collection (not individual requests)
- Check that the test scripts are enabled in Postman settings
- Verify the response status code is 200 or 201
- Manually copy the token from response and set it in environment

---

## Manual Token Setup

If automatic token saving doesn't work:

1. Run "Register User" or "Login User"
2. Copy the token from the response:
   ```json
   {
       "data": {
           "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
       }
   }
   ```
3. Go to your environment
4. Set `auth_token` variable to the copied token
5. Save the environment

---

## Tips

1. **Use Environment Variables:** Always use `{{variable_name}}` syntax in requests
2. **Check Response Status:** Green status (2xx) = success, Red (4xx/5xx) = error
3. **Read Error Messages:** Error responses include helpful messages
4. **Test in Order:** Follow the recommended testing workflow
5. **Save Examples:** Save example responses for documentation
6. **Use Pre-request Scripts:** Add custom headers or modify requests
7. **Monitor Environment:** Keep an eye on environment variables

---

## Database Configuration

The project is configured with the following database credentials:

- **Host:** `postgres-testing.cp.mtechub.org`
- **Port:** `5432`
- **User:** `eventopia-user`
- **Password:** `Mtechub@123`
- **Database:** `eventopia-db`

Make sure your `.env` file has these values before starting the server.

---

## Next Steps

1. Import the Postman collection
2. Set up your environment variables
3. Start your server: `npm run dev`
4. Begin testing with the Health Check endpoint
5. Follow the recommended testing workflow

Happy Testing! 🚀

