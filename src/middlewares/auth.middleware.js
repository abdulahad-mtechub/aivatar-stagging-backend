const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");
const AppError = require("../utils/appError");

/**
 * Middleware to protect routes - verify JWT token
 */
exports.protect = async (req, res, next) => {
  try {
    // 1) Get token from header
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next(
        new AppError("You are not logged in. Please log in to access.", 401)
      );
    }

    // 2) Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-fallback-secret-key-change-in-production"
    );

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
 * Middleware to restrict access to certain roles
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }
    next();
  };
};

