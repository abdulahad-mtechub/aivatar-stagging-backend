const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("../config/database");
const logger = require("../utils/logger");
const UserService = require("./user.service");

/**
 * Auth Service - handles authentication, token generation, and password management
 */
class AuthService {
  /**
   * Authenticate a user and generate tokens
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<object>} User info and tokens
   */
  static async login(email, password) {
    try {
      // Find user by email
      const user = await UserService.findByEmail(email);

      if (!user) {
        throw new Error("Invalid credentials");
      }

      // Check if user is blocked
      if (user.block_status) {
        throw new Error("Your account has been blocked");
      }

      // Compare passwords
      const passwordMatch = await bcrypt.compare(password, user.password);

      if (!passwordMatch) {
        throw new Error("Invalid credentials");
      }

      // Generate tokens
      const accessToken = this.generateAccessToken(user);

      // Remove password from user object
      const { password: _, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        token: accessToken,
      };
    } catch (error) {
      logger.error(`Login error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Register a new user
   * @param {object} userData - User registration data
   * @returns {Promise<object>} User info and token
   */
  static async register(userData) {
    try {
      const { name, email, password, role = "user" } = userData;

      // Check if email already exists
      const existingUser = await UserService.findByEmail(email);

      if (existingUser) {
        throw new Error("Email already in use");
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const newUser = await UserService.create({
        name,
        email,
        password: hashedPassword,
        role,
      });

      // Generate token
      const accessToken = this.generateAccessToken(newUser);

      // Remove password from user object
      const { password: _, ...userWithoutPassword } = newUser;

      return {
        user: userWithoutPassword,
        token: accessToken,
      };
    } catch (error) {
      logger.error(`Registration error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate JWT access token
   * @param {object} user - User object
   * @returns {string} JWT token
   */
  static generateAccessToken(user) {
    const payload = {
      id: user.id,
      role: user.role,
      email: user.email,
    };

    return jwt.sign(
      payload,
      process.env.JWT_SECRET || "your-fallback-secret-key-change-in-production",
      { expiresIn: process.env.JWT_EXPIRE || "7d" }
    );
  }

  /**
   * Change user password
   * @param {number} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<boolean>} Success status
   */
  static async changePassword(userId, currentPassword, newPassword) {
    try {
      // Get user
      const user = await UserService.findById(userId);

      if (!user) {
        throw new Error("User not found");
      }

      // Verify current password
      const passwordMatch = await bcrypt.compare(
        currentPassword,
        user.password
      );

      if (!passwordMatch) {
        throw new Error("Current password is incorrect");
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      await db.query(
        "UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2",
        [hashedPassword, userId]
      );

      return true;
    } catch (error) {
      logger.error(`Change password error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AuthService;

