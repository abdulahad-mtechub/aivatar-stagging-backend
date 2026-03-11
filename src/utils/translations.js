/**
 * Bilingual Translation System
 * Provides English and Spanish translations for API responses
 */

const translations = {
  // Authentication messages
  "Login successful": {
    en: "Login successful",
    es: "Inicio de sesión exitoso"
  },
  "User registered successfully": {
    en: "User registered successfully",
    es: "Usuario registrado con éxito"
  },
  "Password changed successfully": {
    en: "Password changed successfully",
    es: "Contraseña cambiada con éxito"
  },
  "Invalid credentials": {
    en: "Invalid credentials",
    es: "Credenciales inválidas"
  },
  "Email already in use": {
    en: "Email already in use",
    es: "El correo electrónico ya está en uso"
  },
  "You are not logged in. Please log in to access.": {
    en: "You are not logged in. Please log in to access.",
    es: "No has iniciado sesión. Por favor inicia sesión para acceder."
  },
  "The user belonging to this token no longer exists or is blocked.": {
    en: "The user belonging to this token no longer exists or is blocked.",
    es: "El usuario perteneciente a este token ya no existe o está bloqueado."
  },
  "Invalid token. Please log in again.": {
    en: "Invalid token. Please log in again.",
    es: "Token inválido. Por favor inicia sesión nuevamente."
  },
  "Your token has expired. Please log in again.": {
    en: "Your token has expired. Please log in again.",
    es: "Tu token ha expirado. Por favor inicia sesión nuevamente."
  },
  "You do not have permission to perform this action": {
    en: "You do not have permission to perform this action",
    es: "No tienes permiso para realizar esta acción"
  },
  "Please provide email and password": {
    en: "Please provide email and password",
    es: "Por favor proporciona correo electrónico y contraseña"
  },
  "Please provide name, email and password": {
    en: "Please provide name, email and password",
    es: "Por favor proporciona nombre, correo electrónico y contraseña"
  },
  "Please provide current password and new password": {
    en: "Please provide current password and new password",
    es: "Por favor proporciona la contraseña actual y la nueva contraseña"
  },
  "Current password is incorrect": {
    en: "Current password is incorrect",
    es: "La contraseña actual es incorrecta"
  },
  "Your account has been blocked": {
    en: "Your account has been blocked",
    es: "Tu cuenta ha sido bloqueada"
  },
  "Your account has been deleted": {
    en: "Your account has been deleted",
    es: "Tu cuenta ha sido eliminada"
  },

  // CRUD messages
  "Resource created successfully": {
    en: "Resource created successfully",
    es: "Recurso creado con éxito"
  },
  "Resource updated successfully": {
    en: "Resource updated successfully",
    es: "Recurso actualizado con éxito"
  },
  "Resource deleted successfully": {
    en: "Resource deleted successfully",
    es: "Recurso eliminado con éxito"
  },
  "Resource retrieved successfully": {
    en: "Resource retrieved successfully",
    es: "Recurso obtenido con éxito"
  },
  "Resources retrieved successfully": {
    en: "Resources retrieved successfully",
    es: "Recursos obtenidos con éxito"
  },
  "Resource not found": {
    en: "Resource not found",
    es: "Recurso no encontrado"
  },
  "Missing required fields": {
    en: "Missing required fields",
    es: "Faltan campos requeridos"
  },

  // General messages
  "Internal server error": {
    en: "Internal server error",
    es: "Error interno del servidor"
  },
  "Invalid JSON in request body. Please check your request format.": {
    en: "Invalid JSON in request body. Please check your request format.",
    es: "JSON inválido en el cuerpo de la solicitud. Por favor verifica el formato de tu solicitud."
  },
  "Cannot find {url} on this server": {
    en: "Cannot find {url} on this server",
    es: "No se puede encontrar {url} en este servidor"
  }
};

/**
 * Get translations for a message
 * @param {string} message - Message key
 * @returns {object} Object with en and es translations
 */
function getTranslations(message) {
  // If exact match exists, return it
  if (translations[message]) {
    return translations[message];
  }

  // Try to find partial matches or return default
  const keys = Object.keys(translations);
  const match = keys.find(key => message.includes(key) || key.includes(message));

  if (match) {
    return translations[match];
  }

  // Default: return the message in both languages
  return {
    en: message,
    es: message
  };
}

module.exports = {
  getTranslations,
  translations
};

