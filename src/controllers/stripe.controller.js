const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const StripeService = require("../services/stripe.service");
const { getTranslations } = require("../utils/translations");

/**
 * POST /api/stripe/create-session
 * Body: { mode?, quantity?, success_url, cancel_url, price_id?, lookup_key?, plan_id? }
 */
exports.createSession = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const payload = req.body || {};

  if (!payload.success_url || !payload.cancel_url) {
    return next(new AppError("success_url and cancel_url are required", 400));
  }

  const result = await StripeService.createCheckoutSession({ ...payload, userId });
  const translations = getTranslations("Checkout session created");
  return res.status(200).json({
    success: true,
    error: false,
    message: translations.en,
    message_en: translations.en,
    message_es: translations.es,
    data: result,
  });
});

/**
 * GET /api/stripe/session/:id
 * Debug endpoint: fetch checkout session from Stripe.
 */
exports.getSession = asyncHandler(async (req, res, next) => {
  const sessionId = req.params.id;
  if (!sessionId) return next(new AppError("session id is required", 400));

  const result = await StripeService.getCheckoutSession(sessionId);
  const translations = getTranslations("Session retrieved successfully");
  return res.status(200).json({
    success: true,
    error: false,
    message: translations.en,
    message_en: translations.en,
    message_es: translations.es,
    data: result,
  });
});

/**
 * POST /api/stripe/verify
 * Body: { session_id, plan_id? }
 * No webhooks: verifies after checkout using session_id.
 */
exports.verify = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { session_id, plan_id } = req.body || {};

  const result = await StripeService.verifySession({ userId, session_id, plan_id });
  const translations = getTranslations("Subscription verified successfully");
  return res.status(200).json({
    success: true,
    error: false,
    message: translations.en,
    message_en: translations.en,
    message_es: translations.es,
    data: result,
  });
});

/**
 * GET /api/stripe/my-last-subscription
 */
exports.getMyLastSubscription = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const result = await StripeService.getMyLastSubscription(userId);
  const translations = getTranslations("Last subscription retrieved successfully");
  return res.status(200).json({
    success: true,
    error: false,
    message: translations.en,
    message_en: translations.en,
    message_es: translations.es,
    data: result,
  });
});

/**
 * POST /api/stripe/create-portal-session
 * Body: { return_url? }
 */
exports.createPortalSession = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { return_url } = req.body || {};
  const result = await StripeService.createPortalSession({ userId, return_url });
  const translations = getTranslations("Portal session created successfully");
  return res.status(200).json({
    success: true,
    error: false,
    message: translations.en,
    message_en: translations.en,
    message_es: translations.es,
    data: result,
  });
});

