const db = require("../config/database");
const AppError = require("../utils/appError");
const logger = require("../utils/logger");

const STRIPE_API_BASE = "https://api.stripe.com/v1";

function assertStripeConfig() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new AppError("Stripe is not configured (STRIPE_SECRET_KEY missing)", 500);
  }
}

async function stripeRequest(method, path, { params, form } = {}) {
  assertStripeConfig();

  const url = (() => {
    const base = `${STRIPE_API_BASE}${path}`;
    if (!params || Object.keys(params).length === 0) return base;
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      qs.append(k, String(v));
    });
    return `${base}?${qs.toString()}`;
  })();
  const secretKey = process.env.STRIPE_SECRET_KEY;

  const headers = {};
  let data = undefined;
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    data = form.toString();
  }

  try {
    const res = await fetch(url, {
      method,
      headers: { ...(headers || {}), Authorization: `Bearer ${secretKey}` },
      body: data,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (e) {
      json = null;
    }

    if (!res.ok) {
      const msg =
        json?.error?.message ||
        json?.error?.reason ||
        json?.message ||
        `Stripe request failed (${res.status})`;
      throw new AppError(msg, res.status);
    }

    return json;
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(`Stripe request failed: ${err?.message || err}`);
    throw new AppError(err?.message || "Stripe request failed", 400);
  }
}

async function findPriceIdByLookupKey(lookupKey) {
  const lookup = String(lookupKey || "");
  if (!lookup) return null;

  // Stripe supports filtering prices by lookup_keys.
  // Example: GET /v1/prices?lookup_keys[]=pro&active=true&limit=1
  const res = await stripeRequest("GET", "/prices", {
    params: {
      "lookup_keys[]": lookup,
      active: true,
      limit: 1,
    },
  });

  return res?.data?.[0]?.id || null;
}

function normalizeMoneyCents(n) {
  if (n === undefined || n === null) return null;
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.round(x);
}

class StripeService {
  /**
   * Create Stripe Checkout session (subscription mode).
   * Payload expected from frontend (see twitershots reference):
   * {
   *   mode, quantity, success_url, cancel_url,
   *   price_id?, lookup_key?, plan_id?
   * }
   */
  static async createCheckoutSession(payload = {}) {
    const {
      mode = "subscription",
      quantity = 1,
      success_url,
      cancel_url,
      price_id,
      lookup_key,
      plan_id,
      userId,
    } = payload;

    if (!success_url || !cancel_url) {
      throw new AppError("success_url and cancel_url are required", 400);
    }

    let finalPriceId = price_id ? String(price_id) : null;
    let finalLookupKey = lookup_key ? String(lookup_key) : null;
    let finalPlanId = plan_id ? String(plan_id) : null;

    if (!finalPriceId && finalLookupKey) {
      finalPriceId = await findPriceIdByLookupKey(finalLookupKey);
    }

    if (!finalPriceId) {
      throw new AppError("Invalid plan: missing price_id for checkout", 400);
    }

    // Plan_key we save in profile is the lookup key coming from frontend.
    // If frontend also sends plan_id, we keep it for backward compatibility.
    const planKeyToStore = finalLookupKey || finalPlanId || "plan";
    const planIdToReturn = finalPlanId || planKeyToStore;

    const params = new URLSearchParams();
    params.append("mode", mode);
    params.append("success_url", success_url);
    params.append("cancel_url", cancel_url);

    params.append(`line_items[0][price]`, finalPriceId);
    params.append(`line_items[0][quantity]`, String(quantity));

    // Save metadata so verify can pick plan info by session_id.
    if (userId) params.append("metadata[user_id]", String(userId));
    params.append("metadata[plan_key]", planKeyToStore);
    params.append("metadata[plan_id]", planIdToReturn);
    if (finalLookupKey) {
      params.append("metadata[lookup_key]", finalLookupKey);
    }

    // Optional: allows promo codes if you want it in future.
    params.append("allow_promotion_codes", "true");

    const out = await stripeRequest("POST", "/checkout/sessions", {
      form: params,
    });

    return {
      session_id: out.id,
      checkout_url: out.url,
      plan_id: planIdToReturn,
    };
  }

  /**
   * Verify payment from Stripe checkout session id (no webhooks).
   * Request body: { session_id, plan_id? }
   */
  static async verifySession({ userId, session_id, plan_id }) {
    if (!session_id) {
      throw new AppError("session_id is required", 400);
    }

    // Expand subscription so we can read subscription id + metadata.
    const session = await stripeRequest(
      "GET",
      `/checkout/sessions/${encodeURIComponent(session_id)}`,
      { params: { "expand[]": "subscription" } }
    );

    const paymentOk =
      session?.status === "complete" &&
      (session?.payment_status === "paid" || !session?.payment_status);

    if (!paymentOk) {
      throw new AppError("Payment not completed yet", 400);
    }

    const subscription = session.subscription || null;
    const stripeSubscriptionId = typeof subscription === "string" ? subscription : subscription?.id;
    const stripeCustomerId = session.customer || subscription?.customer || null;

    if (!stripeSubscriptionId) {
      throw new AppError("Stripe subscription missing for this session", 400);
    }

    const planIdFromBody = plan_id ? String(plan_id) : null;
    // Use EXACT lookup key string from Stripe metadata (if present).
    // Reference frontend passes plan_id, but we trust Stripe metadata as source of truth.
    const metaLookupKey =
      session?.metadata?.lookup_key ||
      session?.metadata?.plan_key ||
      null;
    const metaPlanId =
      session?.metadata?.plan_id ||
      session?.metadata?.plan_key ||
      null;

    const planKeyToSave = metaLookupKey || metaPlanId || null;

    if (!planKeyToSave) {
      throw new AppError("Unable to determine plan for this session", 400);
    }

    // Optional strict check: if frontend sent `plan_id`, ensure it matches Stripe metadata exactly.
    // No trimming/lowercasing: lookup keys are case-sensitive.
    if (planIdFromBody) {
      if (metaLookupKey && planIdFromBody !== metaLookupKey) {
        throw new AppError("Plan lookup_key mismatch", 400);
      }
      if (!metaLookupKey && metaPlanId && planIdFromBody !== metaPlanId) {
        throw new AppError("Plan mismatch", 400);
      }
    }

    const amountTotal = normalizeMoneyCents(session.amount_total);
    const currency = session.currency || null;

    // Idempotent upserts.
    const txRes = await db.query(
      `INSERT INTO stripe_transactions
          (user_id, session_id, plan_key, stripe_customer_id, stripe_payment_intent_id, amount_total, currency, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (session_id) DO UPDATE
        SET user_id = EXCLUDED.user_id,
            plan_key = EXCLUDED.plan_key,
            stripe_customer_id = EXCLUDED.stripe_customer_id,
            stripe_payment_intent_id = EXCLUDED.stripe_payment_intent_id,
            amount_total = EXCLUDED.amount_total,
            currency = EXCLUDED.currency,
            status = EXCLUDED.status
        RETURNING *`,
      [
        userId,
        String(session_id),
        String(planKeyToSave),
        stripeCustomerId || null,
        session?.payment_intent || null,
        amountTotal,
        currency,
        session?.payment_status || session?.status,
      ]
    );

    const txRow = txRes.rows[0];

    await db.query(
      `INSERT INTO stripe_subscriptions
          (transaction_id, stripe_subscription_id, plan_key, status, current_period_end)
        VALUES ($1, $2, $3, $4, to_timestamp($5))
        ON CONFLICT (stripe_subscription_id) DO UPDATE
        SET transaction_id = EXCLUDED.transaction_id,
            plan_key = EXCLUDED.plan_key,
            status = EXCLUDED.status,
            current_period_end = EXCLUDED.current_period_end,
            updated_at = NOW()`,
      [
        txRow.id,
        stripeSubscriptionId,
        String(planKeyToSave),
        subscription?.status || session?.status,
        subscription?.current_period_end || null,
      ]
    );

    // Keep profile in sync by lookup key (plan_key).
    // Per requirement: store ONLY plan_key in profiles (no Stripe IDs there).
    await db.query(
      `UPDATE profiles
         SET plan_key = $1,
             updated_at = NOW()
       WHERE user_id = $2`,
      [planKeyToSave, userId]
    );

    return {
      subscription: {
        subscription_id: stripeSubscriptionId,
        provider_transaction_id: stripeSubscriptionId,
        plan_id: planKeyToSave,
        plan: planKeyToSave,
        lookup_key: planKeyToSave,
        status: subscription?.status || session?.status,
        current_period_end: subscription?.current_period_end || null,
        // Compatibility fields used by the reference frontend
        start_date: subscription?.current_period_start || null,
        expires_at: subscription?.current_period_end || null,
        // Minimal shape used by reference frontend to read lookup_key.
        items: {
          data: [
            {
              price: {
                lookup_key: planKeyToSave,
                // Kept for completeness; not required by current UI checks.
                product: { lookup_key: planKeyToSave },
              },
            },
          ],
        },
      },
    };
  }

  static async getMyLastSubscription(userId) {
    // Prefer local record, then refresh with Stripe.
    const local = await db.query(
      `SELECT s.*
         FROM stripe_subscriptions s
         JOIN stripe_transactions t ON t.id = s.transaction_id
        WHERE t.user_id = $1
        ORDER BY s.created_at DESC
        LIMIT 1`,
      [userId]
    );

    const row = local.rows[0];
    if (!row) {
      return { subscription: null };
    }

    // Try to refresh from Stripe using stored subscription id.
    let subscription = row;
    try {
      const s = await stripeRequest(
        "GET",
        `/subscriptions/${encodeURIComponent(row.stripe_subscription_id)}`,
        {}
      );
      subscription = {
        ...row,
        ...s,
      };
    } catch (e) {
      // If Stripe fails, still return local data.
    }

    // Keep profile in sync with latest stored subscription plan.
    await db.query(
      `UPDATE profiles
         SET plan_key = $1,
             updated_at = NOW()
       WHERE user_id = $2`,
      [subscription.plan_key, userId]
    );

    return {
      subscription: {
        subscription_id: subscription.stripe_subscription_id,
        provider_transaction_id: subscription.stripe_subscription_id,
        plan_id: subscription.plan_key,
        plan: subscription.plan_key,
        lookup_key: subscription.plan_key,
        status: subscription.status,
        current_period_end: subscription.current_period_end || null,
        // Compatibility fields used by reference frontend
        start_date: subscription.current_period_start || null,
        expires_at: subscription.current_period_end || null,
        created_at: row.created_at || null,
      },
    };
  }

  static async createPortalSession({ userId, return_url = null }) {
    // Find latest stored Stripe subscription for the user.
    const subRes = await db.query(
      `SELECT s.stripe_subscription_id
         FROM stripe_subscriptions s
         JOIN stripe_transactions t ON t.id = s.transaction_id
        WHERE t.user_id = $1
        ORDER BY s.created_at DESC
        LIMIT 1`,
      [userId]
    );

    const stripeSubscriptionId = subRes.rows[0]?.stripe_subscription_id;
    if (!stripeSubscriptionId) {
      throw new AppError("Active Stripe subscription not found for this user", 400);
    }

    // Fetch subscription from Stripe to get customer id.
    const stripeSub = await stripeRequest(
      "GET",
      `/subscriptions/${encodeURIComponent(stripeSubscriptionId)}`,
      {}
    );

    const customerId = stripeSub?.customer;
    if (!customerId) {
      throw new AppError("Stripe customer not found for this subscription", 400);
    }

    const params = new URLSearchParams();
    params.append("customer", customerId);
    if (return_url) params.append("return_url", return_url);

    const out = await stripeRequest("POST", "/billing_portal/sessions", {
      form: params,
    });

    return { url: out.url };
  }

  static async getCheckoutSession(sessionId) {
    const session = await stripeRequest(
      "GET",
      `/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { params: { "expand[]": "subscription" } }
    );
    return { session };
  }
}

module.exports = StripeService;

