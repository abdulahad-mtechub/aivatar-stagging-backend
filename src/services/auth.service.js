const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("../config/database");
const logger = require("../utils/logger");
const UserService = require("./user.service");
const { generateOtp, sendOtp } = require("../utils/otp");

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

      // Generate OTP and set on user (expires in 10 minutes)
      const otp = generateOtp(4);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Set OTP on user and get the updated user row
      const updatedUser = await UserService.setOtp(newUser.id, otp, expiresAt);

      // Send OTP (stubbed) and capture result
      const sendResult = await sendOtp({ to: newUser.email, otp });

      // Use the updated user (which includes otp fields) when generating token/response
      const userForResponse = updatedUser || newUser;

      // Generate token
      const accessToken = this.generateAccessToken(userForResponse);

      // Remove password from user object
      const { password: _, ...userWithoutPassword } = userForResponse;

      return {
        user: userWithoutPassword,
        token: accessToken,
        otpSent: process.env.NODE_ENV === "production" ? false : true,
        ...(sendResult && sendResult.otp ? { otp: sendResult.otp } : {}),
      };
    } catch (error) {
      logger.error(`Registration error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resend OTP to given email
   * @param {string} email
   */
  static async resendOtp(email) {
    try {
      const user = await UserService.findByEmail(email);

      if (!user) {
        throw new Error("User not found");
      }

      const otp = generateOtp(4);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await UserService.setOtp(user.id, otp, expiresAt);
      const sendResult = await sendOtp({ to: user.email, otp });

      return {
        success: true,
        otpSent: process.env.NODE_ENV === "production" ? false : true,
        ...(sendResult && sendResult.otp ? { otp: sendResult.otp } : {}),
      };
    } catch (error) {
      logger.error(`Resend OTP error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify OTP for user
   * @param {string} email
   * @param {string} otp
   */
  static async verifyOtp(email, otp) {
    try {
      const user = await UserService.findByEmail(email);

      if (!user) {
        throw new Error("User not found");
      }

      if (!user.otp || !user.otp_expires_at) {
        throw new Error("No OTP found for this user");
      }

      const now = new Date();
      const expiresAt = new Date(user.otp_expires_at);

      if (now > expiresAt) {
        throw new Error("OTP has expired");
      }

      if (String(user.otp) !== String(otp)) {
        throw new Error("Invalid OTP");
      }

      // Mark user as verified and clear otp
      await UserService.verify(user.id);

      return { success: true };
    } catch (error) {
      logger.error(`Verify OTP error: ${error.message}`);
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

  /**
   * Send forgot-password OTP to user's email
   * @param {string} email
   */
  static async forgotPassword(email) {
    try {
      const user = await UserService.findByEmail(email);

      if (!user) {
        throw new Error("User not found");
      }

      const otp = generateOtp(4);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await UserService.setOtp(user.id, otp, expiresAt);
      const sendResult = await sendOtp({ to: user.email, otp });

      return {
        success: true,
        otpSent: process.env.NODE_ENV === "production" ? false : true,
        ...(sendResult && sendResult.otp ? { otp: sendResult.otp } : {}),
      };
    } catch (error) {
      logger.error(`Forgot password error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reset password using email + otp
   * @param {string} email
   * @param {string} otp
   * @param {string} newPassword
   */
  static async resetPassword(email, otp, newPassword) {
    try {
      const user = await UserService.findByEmail(email);

      if (!user) {
        throw new Error("User not found");
      }

      if (!user.otp || !user.otp_expires_at) {
        throw new Error("No OTP found for this user");
      }

      const now = new Date();
      const expiresAt = new Date(user.otp_expires_at);

      if (now > expiresAt) {
        throw new Error("OTP has expired");
      }

      if (String(user.otp) !== String(otp)) {
        throw new Error("Invalid OTP");
      }

      // Hash new password and update
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await UserService.updatePassword(user.id, hashedPassword);

      return { success: true };
    } catch (error) {
      logger.error(`Reset password error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AuthService;

