// Minimal Stripe Checkout for Cloudflare Workers
// Scenario B: no existing Checkout Session call — this file adds one.
// Uses fixed_by_ui values exactly as configured in Checkout Studio.

import Stripe from "stripe";

const json = (data, status = 200, headers = {}) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });

const error = (message, status) => json({ error: message }, status);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/create-checkout-session" && request.method === "POST") {
      if (!env.STRIPE_SECRET_KEY) return error("Stripe is not configured", 500);

      // Stripe SDK 18.x is below 21.0.0, so ui_mode is "hosted" (see STRIPE_INTEGRATION_TODO.md)
      const stripe = new Stripe(env.STRIPE_SECRET_KEY);

      let body = {};
      try {
        const text = await request.text();
        if (text) body = JSON.parse(text);
      } catch {
        return error("Invalid JSON", 400);
      }

      // sample_only: mode, success_url, cancel_url, line_items are placeholders
      // For one-time services we use "payment". Switch to "subscription" for recurring.
      const mode = "payment";

      // In production replace the price below with your real Price ID from
      // https://dashboard.stripe.com/prices
      const price =
        typeof body.price === "string" && body.price.startsWith("price_")
          ? body.price
          : "price_...";

      const origin = url.origin;

      const sessionParams = {
        ui_mode: "hosted",
        mode,
        billing_address_collection: "auto",
        phone_number_collection: { enabled: false },
        automatic_tax: { enabled: false },
        allow_promotion_codes: false,
        submit_type: "auto",
        integration_identifier: "hosted_web_0001",
        origin_context: "web",
        success_url: `${origin}/thanks?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/services`,
        line_items: [{ price, quantity: 1 }],
      };

      try {
        const session = await stripe.checkout.sessions.create(sessionParams);
        // 303 redirect is the classic Checkout pattern; also return JSON for fetch clients
        if (request.headers.get("Accept")?.includes("application/json")) {
          return json({ url: session.url });
        }
        return Response.redirect(session.url, 303);
      } catch (cause) {
        const message = cause?.message || "Checkout failed";
        return error(message, 500);
      }
    }

    // Fallback to static assets (portfolio)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return error("Not found", 404);
  },
};
