const AuthService = require("../services/auth.service");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");

/**
 * Login user and return JWT token
 */
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return next(new AppError("Please provide email and password", 400));
  }

  try {
    // Authenticate user
    const result = await AuthService.login(email, password);

    return apiResponse(res, 200, "Login successful", result);
  } catch (error) {
    return next(new AppError(error.message, 401));
  }
});

/**
 * Register a new user
 */
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  // Validate input
  if (!name || !email || !password) {
    return next(new AppError("Please provide name, email and password", 400));
  }

  try {
    // Register user
    const result = await AuthService.register({
      name,
      email,
      password,
      role,
    });

    return apiResponse(res, 201, "User registered successfully", result);
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

/**
 * Resend OTP to user email
 */
exports.resendOtp = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  if (!email) return next(new AppError("Please provide email", 400));

  try {
    const result = await AuthService.resendOtp(email);

    return apiResponse(res, 200, "OTP resent successfully", result);
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

/**
 * Verify OTP
 */
exports.verifyOtp = asyncHandler(async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) return next(new AppError("Please provide email and otp", 400));

  try {
    const result = await AuthService.verifyOtp(email, otp);

    return apiResponse(res, 200, "OTP verified successfully", result);
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

/**
 * Forgot password - send OTP
 */
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  if (!email) return next(new AppError("Please provide email", 400));

  try {
    const result = await AuthService.forgotPassword(email);

    return apiResponse(res, 200, "OTP sent for password reset", result);
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

/**
 * Reset password using OTP
 */
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword)
    return next(new AppError("Please provide email, otp and newPassword", 400));

  try {
    const result = await AuthService.resetPassword(email, otp, newPassword);

    return apiResponse(res, 200, "Password reset successfully", result);
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

/**
 * Get current user profile
 */
exports.getProfile = asyncHandler(async (req, res, next) => {
  const user = req.user;
  
  // Remove password from response
  const { password, ...userWithoutPassword } = user;

  return apiResponse(res, 200, "Profile retrieved successfully", {
    user: userWithoutPassword,
  });
});

/**
 * Change user password
 */
exports.changePassword = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(
      new AppError("Please provide current password and new password", 400)
    );
  }

  try {
    await AuthService.changePassword(userId, currentPassword, newPassword);

    return apiResponse(res, 200, "Password changed successfully");
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

