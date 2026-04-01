const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");
const AppError = require("../utils/appError");

/**
 * Middleware to protect routes - verify JWT token
 */
const JWT_SECRET =
  process.env.JWT_SECRET || "your-fallback-secret-key-change-in-production";

exports.protect = async (req, res, next) => {
  try {
    // Require a real JWT string after "Bearer" (not empty / not only whitespace)
    const raw = req.headers.authorization?.trim();
    const bearerMatch = raw?.match(/^Bearer\s+(\S+)/i);
    const token = bearerMatch?.[1];

    if (!token) {
      return next(
        new AppError("You are not logged in. Please log in to access.", 401)
      );
    }

    // 2) Verify token (explicit algorithm — blocks "none" / unexpected alg tokens)
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    });

    // 3) Check if user still exists and is not blocked
    const result = await pool.query(
      "SELECT * FROM users WHERE id = $1 AND block_status = false",
      [decoded.id]
    );

    const currentUser = result.rows[0];

    if (!currentUser) {
      return next(
        new AppError(
          "The user belonging to this token no longer exists or is blocked.",
          401
        )
      );
    }

    // 4) Add user to request
    req.user = currentUser;
    next();
  } catch (error) {
    console.log(
      "Auth middleware error:",
      error.message,
      "Route:",
      req.originalUrl
    );
    if (error.name === "JsonWebTokenError") {
      return next(new AppError("Invalid token. Please log in again.", 401));
    }
    if (error.name === "TokenExpiredError") {
      return next(
        new AppError("Your token has expired. Please log in again.", 401)
      );
    }
    return next(error);
  }
};

/**
 * For POST /change-password: allow unauthenticated body { email, newPassword }
 * after verify-otp (forgot-password flow); otherwise require JWT like protect.
 */
exports.changePasswordGate = async (req, res, next) => {
  const { email, newPassword } = req.body || {};
  if (email && newPassword) {
    return next();
  }
  return exports.protect(req, res, next);
};

/**
 * Middleware to restrict access to certain roles
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError("You are not logged in. Please log in to access.", 401)
      );
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }
    next();
  };
};

