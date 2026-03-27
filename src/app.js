const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bodyParser = require("body-parser");
const path = require("path");
const routes = require("./routes");
const errorMiddleware = require("./middlewares/error.middleware");
const logger = require("./utils/logger");
const { pool } = require("./config/database");

// Initialize express app
const app = express();

// Security middleware
app.use(helmet());

// Configure CORS properly
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Content-Length",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// Handle JSON parsing errors specifically
app.use((err, req, res, next) => {
  // Catch JSON parsing errors from body-parser
  if (err instanceof SyntaxError && err.message && err.message.includes("JSON")) {
    logger.error(`JSON parsing error on ${req.method} ${req.originalUrl}:`, {
      error: err.message,
      body: err.body || "Unable to parse body",
      headers: req.headers,
      method: req.method,
      stack: err.stack,
    });

    const { getTranslations } = require("./utils/translations");
    const translations = getTranslations("Invalid JSON in request body. Please check your request format.");

    return res.status(400).json({
      error: true,
      message: translations.en,
      message_en: translations.en,
      message_es: translations.es,
      details:
        process.env.NODE_ENV === "development"
          ? {
              error: err.message,
              position: err.message.match(/position (\d+)/)?.[1] || "unknown",
              receivedBody: err.body ? (typeof err.body === 'string' ? err.body.substring(0, 200) : err.body) : undefined,
            }
          : undefined,
    });
  }
  next(err);
});

// Static file serving for uploads (if needed)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Request logging for development
if (process.env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.originalUrl}`);
    next();
  });
}

// Middleware to attach database to requests
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    timestamp: new Date(),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
    uptime: process.uptime(),
  });
});

// API routes
app.use("/api", routes);

// Root route
app.get("/", (req, res) => {
  res.json({
    error: false,
    message: "Reusable Backend Starter API is running.",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      api: "/api",
      auth: "/api/auth",
      users: "/api/users",
    },
  });
});

// Handle 404 - Route not found (must be after all valid routes)
app.all("*", (req, res, next) => {
  const AppError = require("./utils/appError");
  const err = new AppError(
    `Cannot find ${req.originalUrl} on this server`,
    404
  );
  next(err);
});

// Error handling middleware (should be last)
app.use(errorMiddleware);

module.exports = app;

