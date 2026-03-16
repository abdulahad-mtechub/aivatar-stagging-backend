const admin = require("firebase-admin");
const logger = require("../utils/logger");

try {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    logger.info("✅ Firebase Admin SDK initialized successfully");
  } else {
    logger.warn("⚠️ Firebase environment variables missing. Notifications will be disabled.");
  }
} catch (error) {
  logger.error("❌ Firebase initialization error:", error.message);
}

module.exports = admin;
