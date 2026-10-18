// Minimal Stripe Checkout for Cloudflare Workers
// Matches the snippet provided by the user — hosted Checkout via Stripe SDK.

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

      const stripe = new Stripe(env.STRIPE_SECRET_KEY);

      let body = {};
      try {
        const text = await request.text();
        if (text) body = JSON.parse(text);
      } catch {
        return error("Invalid JSON", 400);
      }

      const price =
        typeof body.price === "string" && body.price.startsWith("price_")
          ? body.price
          : "price_...";

      const origin = url.origin;

      try {
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          ui_mode: "hosted_page",
          success_url: `${origin}/thanks?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/services`,
          line_items: [{ price, quantity: 1 }],
          billing_address_collection: "auto",
          allow_promotion_codes: false,
          submit_type: "auto",
          integration_identifier: "hosted_web_0001",
          origin_context: "web",
        });

        if (request.headers.get("Accept")?.includes("application/json")) {
          return json({ url: session.url });
        }
        return Response.redirect(session.url, 303);
      } catch (cause) {
        const message = cause?.message || "Checkout failed";
        return error(message, 500);
      }
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return error("Not found", 404);
  },
};
