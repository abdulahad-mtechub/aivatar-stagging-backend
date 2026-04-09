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
  static async touchLastLogin(userId) {
    try {
      const result = await db.query(
        `UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
        [userId]
      );
      return result.rows[0] || null;
    } catch (error) {
      // Backward-compatibility for databases not yet migrated with last_login column
      if (error?.code === "42703") return null;
      throw error;
    }
  }

  /**
   * Authenticate a user and generate tokens
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<object>} User info and tokens
   */
  static async login(email, password) {
    try {
      // Find user by email (including soft-deleted)
      const user = await UserService.findAnyByEmail(email);

      if (!user) {
        throw new Error("Invalid credentials");
      }

      // Check if user is deleted
      if (user.deleted_at) {
        throw new Error("Your account has been deleted");
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

      // Check if user is verified
      if (!user.is_verified) {
        throw new Error("Please verify your account first");
      }

      const userAfterLogin = (await this.touchLastLogin(user.id)) || user;

      // Generate tokens
      const accessToken = this.generateAccessToken(userAfterLogin);

      // Remove password from user object
      const { password: _, ...userWithoutPassword } = userAfterLogin;

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
   * Authenticate an admin and generate tokens
   * @param {string} email - Admin email
   * @param {string} password - Admin password
   * @returns {Promise<object>} Admin info and tokens
   */
  static async adminLogin(email, password) {
    try {
      // Find user by email (including soft-deleted)
      const user = await UserService.findAnyByEmail(email);

      if (!user) {
        throw new Error("Invalid credentials");
      }

      // Check if user is deleted
      if (user.deleted_at) {
        throw new Error("Your account has been deleted");
      }

      // Check if user is admin
      if (user.role !== "admin") {
        throw new Error("Access denied. Admin privileges required.");
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

      // Check if user is verified
      if (!user.is_verified) {
        throw new Error("Please verify your account first");
      }

      const userAfterLogin = (await this.touchLastLogin(user.id)) || user;

      // Generate tokens
      const accessToken = this.generateAccessToken(userAfterLogin);

      // Remove password from user object
      const { password: _, ...userWithoutPassword } = userAfterLogin;

      return {
        user: userWithoutPassword,
        token: accessToken,
      };
    } catch (error) {
      logger.error(`Admin login error: ${error.message}`);
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
      const { name, email, password, confirm_password, role = "user" } = userData;

      // Validate passwords match
      if (password !== confirm_password) {
        throw new Error("Passwords do not match");
      }

      // Check if email already exists (including soft-deleted)
      const anyUser = await UserService.findAnyByEmail(email);

      if (anyUser) {
        if (!anyUser.deleted_at) {
          throw new Error("Email already in use");
        }

        // Check if deleted within 90 days
        const deletedAt = new Date(anyUser.deleted_at);
        const now = new Date();
        const diffTime = Math.abs(now - deletedAt);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const daysRemaining = 90 - diffDays;

        if (daysRemaining > 0) {
          throw new Error(`You cannot register. Account was recently deleted. ${daysRemaining} days remaining until permanent deletion.`);
        }

        // If more than 90 days, we should theoretically have cleaned it up, 
        // but if not, we can either re-activate or let the previous code handle it.
        // For simplicity, we'll assume the cleanup handles it or just treat it as "Email already in use" if not cleaned.
        throw new Error("Email already in use (pending permanent deletion)");
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const newUser = await UserService.create({
        name,
        email,
        password: hashedPassword,
        confirm_password: hashedPassword, // Store hashed version for consistency
        role,
      });

      // Generate OTP and set on user (expires in 10 minutes)
      const otp = generateOtp(4);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Set OTP on user and get the updated user row
      const updatedUser = await UserService.setOtp(
        newUser.id,
        otp,
        expiresAt,
        "registration"
      );

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
   * @param {string} [purpose] - use "password_reset" after forgot-password so verify-otp opens reset session
   */
  static async resendOtp(email, purpose = "registration") {
    try {
      const user = await UserService.findByEmail(email);

      if (!user) {
        throw new Error("User not found");
      }

      const otp = generateOtp(4);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const otpPurpose =
        String(purpose || "registration").trim().toLowerCase() === "password_reset"
          ? "password_reset"
          : "registration";

      await UserService.setOtp(user.id, otp, expiresAt, otpPurpose);
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

      const purpose = String(user.otp_purpose || "").trim().toLowerCase();
      const forPasswordReset = purpose === "password_reset";

      await UserService.verifyAfterOtp(user.id, forPasswordReset);

      return {
        success: true,
        ...(forPasswordReset ? { password_reset_session: true } : {}),
      };
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

      await UserService.setOtp(user.id, otp, expiresAt, "password_reset");
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

  static getPasswordResetSessionMinutes() {
    const mins = Number(process.env.PASSWORD_RESET_SESSION_MINUTES);
    return Number.isFinite(mins) && mins > 0 ? mins : 60;
  }

  /**
   * Set new password after forgot-password OTP was verified via verify-otp.
   * Expiry is enforced in SQL with NOW() so it matches the DB clock and avoids
   * node-pg / JS Date mis-parsing timestamp without time zone.
   * @param {string} email
   * @param {string} newPassword
   */
  static async resetPasswordWithVerifiedOtp(email, newPassword) {
    try {
      const user = await UserService.findByEmail(email);

      if (!user) {
        throw new Error("User not found");
      }

      const sessionMins = this.getPasswordResetSessionMinutes();
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      const result = await db.query(
        `UPDATE users SET password = $1, otp = NULL, otp_expires_at = NULL,
         otp_purpose = NULL, password_reset_verified_at = NULL, updated_at = NOW()
         WHERE id = $2
         AND deleted_at IS NULL
         AND password_reset_verified_at IS NOT NULL
         AND password_reset_verified_at > NOW() - ($3::integer * INTERVAL '1 minute')
         RETURNING id`,
        [hashedPassword, user.id, sessionMins]
      );

      if (result.rowCount === 0) {
        if (!user.password_reset_verified_at) {
          throw new Error(
            'Please verify the OTP first. After forgot-password, if you call resend-otp, send "purpose": "password_reset" in the body.'
          );
        }
        throw new Error(
          "Password reset session has expired. Please request a new code and verify the OTP again."
        );
      }

      return { success: true };
    } catch (error) {
      logger.error(`Reset password (post-OTP) error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AuthService;

