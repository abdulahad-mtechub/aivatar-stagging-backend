/**
 * Validation utilities for request data
 */

/**
 * Validate required fields
 * @param {object} data - Data to validate
 * @param {array} fields - Array of required field names (optional)
 * @returns {object} Validation result
 */
function validateRequired(data, fields = null) {
  if (fields) {
    // Validate specific fields
    const missing = fields.filter((field) => !data[field] && data[field] !== 0);
    if (missing.length > 0) {
      return {
        isValid: false,
        message: `Missing required fields: ${missing.join(", ")}`,
      };
    }
  } else {
    // Validate all non-null/undefined fields in data
    const missing = Object.keys(data).filter(
      (key) => !data[key] && data[key] !== 0
    );
    if (missing.length > 0) {
      return {
        isValid: false,
        message: `Missing required fields: ${missing.join(", ")}`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid email
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} Is valid phone
 */
function validatePhone(phone) {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate GPS coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {object} Validation result
 */
function validateGPS(lat, lng) {
  if (lat < -90 || lat > 90) {
    return {
      isValid: false,
      message: "Invalid latitude. Must be between -90 and 90",
    };
  }

  if (lng < -180 || lng > 180) {
    return {
      isValid: false,
      message: "Invalid longitude. Must be between -180 and 180",
    };
  }

  return { isValid: true };
}

/**
 * Validate date format (YYYY-MM-DD)
 * @param {string} date - Date string to validate
 * @returns {object} Validation result
 */
function validateDate(date) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return {
      isValid: false,
      message: "Invalid date format. Use YYYY-MM-DD",
    };
  }

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    return {
      isValid: false,
      message: "Invalid date",
    };
  }

  return { isValid: true };
}

/**
 * Sanitize string input
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(str) {
  if (typeof str !== "string") return str;
  return str.trim().replace(/[<>]/g, "");
}

module.exports = {
  validateRequired,
  validateEmail,
  validatePhone,
  validateGPS,
  validateDate,
  sanitizeString,
};

