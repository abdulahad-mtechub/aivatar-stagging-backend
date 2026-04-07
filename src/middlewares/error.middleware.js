const AppError = require("../utils/appError");
const logger = require("../utils/logger");
const { getTranslations } = require("../utils/translations");

/**
 * Handle specific database errors
 */
const handleDatabaseError = (err) => {
  // PostgreSQL UUID validation error
  if (
    err.message &&
    err.message.includes("invalid input syntax for type uuid")
  ) {
    return new AppError("Invalid ID format provided", 400);
  }

  // PostgreSQL constraint violation
  if (err.code === "23505") {
    return new AppError("Duplicate entry detected", 409);
  }

  // PostgreSQL foreign key violation
  if (err.code === "23503") {
    return new AppError("Referenced record not found", 404);
  }

  // PostgreSQL not null violation
  if (err.code === "23502") {
    return new AppError("Required field is missing", 400);
  }

  return err;
};

/**
 * Global error handling middleware
 * Returns consistent JSON error responses instead of HTML
 */
const errorMiddleware = (err, req, res, next) => {
  // Handle database-specific errors
  err = handleDatabaseError(err);

  // Set default error values
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Log the error for debugging
  logger.error(`${err.statusCode} - ${err.message}`, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    stack: err.stack,
  });

  // Get translations for the error message
  // Use stored translations if available (for dynamic messages), otherwise get from message
  const translations = err.message_en && err.message_es
    ? { en: err.message_en, es: err.message_es }
    : getTranslations(err.message);

  // Development error response (more details)
  if (process.env.NODE_ENV === "development") {
    return res.status(err.statusCode).json({
      error: true,
      message: translations.en,
      message_en: translations.en,
      message_es: translations.es,
      stack: err.stack,
      details: {
        url: req.originalUrl,
        method: req.method,
        statusCode: err.statusCode,
        status: err.status,
      },
    });
  }

  // Production error response (less details)
  // Operational errors (AppError instances) can be sent to the client
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      error: true,
      message: translations.en,
      message_en: translations.en,
      message_es: translations.es,
    });
  }

  // Programming or unknown errors should hide details in production
  const internalErrorTranslations = getTranslations("Internal server error");
  return res.status(500).json({
    error: true,
    message: internalErrorTranslations.en,
    message_en: internalErrorTranslations.en,
    message_es: internalErrorTranslations.es,
  });
};

module.exports = errorMiddleware;
