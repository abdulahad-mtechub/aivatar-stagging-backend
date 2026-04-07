/**
 * Simple logger utility
 * This can be replaced with a more robust logging solution like Winston in the future
 
 */
const logger = {
  info: (message) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
  },

  error: (message, error) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
    if (error) {
      console.error(error);
    }
  },

  warn: (message) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
  },

  debug: (message) => {
    if (process.env.NODE_ENV === "development") {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`);
    }
  },
};

module.exports = logger;

