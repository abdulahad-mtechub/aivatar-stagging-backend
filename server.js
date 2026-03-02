require("dotenv").config();
const http = require("http");
const app = require("./src/app");
const logger = require("./src/utils/logger");

// Get port from environment or use default
const port = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Start the server
server.listen(port, () => {
  logger.info(`🚀 Server running on port ${port}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  logger.info(`📅 Started at: ${new Date().toISOString()}`);
  logger.info(`📖 API Documentation: http://localhost:${port}/api`);
});

// Handle server errors
server.on("error", (error) => {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

  switch (error.code) {
    case "EACCES":
      logger.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      logger.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Rejection:", err);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception:", err);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});

