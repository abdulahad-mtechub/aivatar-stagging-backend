/**
 * Custom error class for application errors
 */
class AppError extends Error {
  constructor(message, statusCode, translations = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    
    // Store translations if provided (for dynamic messages)
    if (translations) {
      this.message_en = translations.en;
      this.message_es = translations.es;
    }

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;

