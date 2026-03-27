const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const StripeService = require("../services/stripe.service");
const { apiResponse } = require("../utils/apiResponse");

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
  return apiResponse(res, 200, "Checkout session created", result);
});

/**
 * GET /api/stripe/session/:id
 * Debug endpoint: fetch checkout session from Stripe.
 */
exports.getSession = asyncHandler(async (req, res, next) => {
  const sessionId = req.params.id;
  if (!sessionId) return next(new AppError("session id is required", 400));

  const result = await StripeService.getCheckoutSession(sessionId);
  return apiResponse(res, 200, "Session retrieved successfully", result);
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
  return apiResponse(res, 200, "Subscription verified successfully", result);
});

/**
 * GET /api/stripe/my-last-subscription
 */
exports.getMyLastSubscription = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const result = await StripeService.getMyLastSubscription(userId);
  return apiResponse(res, 200, "Last subscription retrieved successfully", result);
});

/**
 * POST /api/stripe/create-portal-session
 * Body: { return_url? }
 */
exports.createPortalSession = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { return_url } = req.body || {};
  const result = await StripeService.createPortalSession({ userId, return_url });
  return apiResponse(res, 200, "Portal session created successfully", result);
});

