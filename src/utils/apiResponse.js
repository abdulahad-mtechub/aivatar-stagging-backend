const { getTranslations } = require('./translations');

/**
 * Standardized API response format with bilingual support
 * Automatically includes English and Spanish translations
 */
function apiResponse(res, status, message, data = null) {
  const isError = status >= 400;
  const translations = getTranslations(message);
  
  return res.status(status).json({
    error: isError,
    message: translations.en,  // Default message in English
    message_en: translations.en,
    message_es: translations.es,
    ...(data !== null ? { data } : {}),
  });
}

/**
 * Success response helper with bilingual support
 */
function successResponse(res, { message, data = null }, status = 200) {
  const translations = getTranslations(message);
  
  return res.status(status).json({
    error: false,
    message: translations.en,
    message_en: translations.en,
    message_es: translations.es,
    ...(data !== null ? { data } : {}),
  });
}

/**
 * Error response helper with bilingual support
 */
function errorResponse(res, message, status = 500) {
  const translations = getTranslations(message);
  
  return res.status(status).json({
    error: true,
    message: translations.en,
    message_en: translations.en,
    message_es: translations.es,
  });
}

module.exports = {
  apiResponse,
  successResponse,
  errorResponse,
};

