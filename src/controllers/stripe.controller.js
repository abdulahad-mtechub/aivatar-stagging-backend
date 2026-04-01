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

/**
 * GET /api/stripe/customer-portal
 * Query: ?return_url=https://your-app/account
 * Returns Stripe customer portal URL where user can cancel subscription
 * and update payment method.
 */
exports.getCustomerPortal = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const return_url = req.query?.return_url || null;
  const result = await StripeService.createPortalSession({ userId, return_url });
  return apiResponse(res, 200, "Customer portal link created successfully", result);
});

/**
 * POST /api/stripe/cancel-subscription
 * Body: { reason, cancel_immediately? }
 */
exports.cancelSubscription = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { reason, cancel_immediately } = req.body || {};
  const result = await StripeService.cancelSubscription({
    userId,
    reason,
    cancel_immediately,
  });
  return apiResponse(res, 200, "Subscription cancellation submitted successfully", result);
});

/**
 * POST /api/stripe/upgrade-subscription
 * Body: { lookup_key? | price_id?, plan_id? }
 */
exports.upgradeSubscription = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { lookup_key, price_id, plan_id } = req.body || {};
  const result = await StripeService.upgradeSubscription({
    userId,
    lookup_key,
    price_id,
    plan_id,
  });
  return apiResponse(res, 200, "Subscription upgraded successfully", result);
});

/**
 * POST /api/stripe/upgrade-preview
 * Body: { lookup_key? | price_id?, plan_id? }
 */
exports.upgradePreview = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { lookup_key, price_id, plan_id } = req.body || {};
  const result = await StripeService.getUpgradePreview({
    userId,
    lookup_key,
    price_id,
    plan_id,
  });
  return apiResponse(res, 200, "Upgrade preview fetched successfully", result);
});

