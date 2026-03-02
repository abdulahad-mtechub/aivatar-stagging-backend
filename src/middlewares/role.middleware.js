const AppError = require("../utils/appError");

/**
 * Require specific role
 * @param {string} role - Required role
 * @returns {Function} Express middleware
 */
exports.requireRole = (role) => {
  return (req, res, next) => {
    // Check if user is authenticated
    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }

    // Normalize role comparison (handle different case formats)
    const userRole = (req.user.role || "").toLowerCase();
    const requiredRole = role.toLowerCase();

    if (userRole !== requiredRole) {
      return next(
        new AppError(`Access denied. ${role} role required.`, 403)
      );
    }

    next();
  };
};

/**
 * Allow multiple roles
 * @param {...string} roles - Allowed roles
 * @returns {Function} Express middleware
 */
exports.allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }

    const userRole = (req.user.role || "").toLowerCase();
    const allowedRoles = roles.map((role) => role.toLowerCase());

    if (!allowedRoles.includes(userRole)) {
      return next(
        new AppError(
          `Access denied. One of these roles required: ${allowedRoles.join(", ")}`,
          403
        )
      );
    }

    next();
  };
};

