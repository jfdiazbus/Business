# Stripe Integration TODO

> Scenario B — no existing `stripe.checkout.sessions.create` was found, so a minimal
> hosted Checkout endpoint was added. This file is the single source of truth for
> remaining setup.

## Values to Replace

The following values are placeholders and must be updated before going live.

**Files containing placeholders:**

- [page_server/worker.js](page_server/worker.js)
- [page_server/index.js](page_server/index.js)
- [page_server/services.html](page_server/services.html)

| Field              | Current Value                                       | What to Set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| mode               | `payment`                                           | Set to `payment` for one-time charges or `subscription` for recurring billing. Currently set to `payment` for the five one-time services.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| success_url        | `${origin}/thanks?session_id={CHECKOUT_SESSION_ID}` | Your actual post-payment success page URL. Keep the `{CHECKOUT_SESSION_ID}` template. Currently `https://portfolio.jfdiazbus.workers.dev/thanks` (and `http://localhost:3000/thanks` locally). Keep as `/thanks` on your domain.                                                                                                                                                                                                                                                                                                                                                                                      |
| cancel_url         | `${origin}/services`                                | Your actual cancel/return page URL. Currently `https://portfolio.jfdiazbus.workers.dev/services`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| line_items[].price | `price_...` (fallback)                              | Your actual Stripe Price ID from the Dashboard (https://dashboard.stripe.com/prices) or API. The five services already use real test prices via `data-price` in `services.html`: `price_1URDljGLxtix6XhLHXvgnpg4` (€100 website), `price_1URDm0GLxtix6XhLP8C2FmGH` (€200 API), `price_1URDm0GLxtix6XhLsQ0QqBDw` (€500 full), `price_1URya1GLxtix6XhLd0PgBuNM` (€20 Stripe), `price_1URymoGLxtix6XhLrGuJxo5F` (€300 AI). Replace these with live Price IDs when you go live (`price_...` live). The fallback `price_...` in `worker.js`/`index.js` must also be replaced — requests without a valid `price` will fail. |

## Configured Parameters

These parameters were configured in Checkout Studio and are already set correctly.

**Files containing these parameters:**

- [page_server/worker.js](page_server/worker.js)
- [page_server/index.js](page_server/index.js)

| Parameter                  | Value                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ui_mode                    | `hosted` — Stripe SDK `stripe@18.0.0` is below 21.0.0, so `hosted` is used. SDK 21.0.0+ uses `hosted_page`. If you upgrade `stripe` to 21+, change to `hosted_page` (see note below). |
| billing_address_collection | `auto`                                                                                                                                                                                |
| phone_number_collection    | `{"enabled": false}`                                                                                                                                                                  |
| automatic_tax              | `{"enabled": false}`                                                                                                                                                                  |
| allow_promotion_codes      | `false`                                                                                                                                                                               |
| submit_type                | `auto`                                                                                                                                                                                |
| integration_identifier     | `hosted_web_0001`                                                                                                                                                                     |
| origin_context             | `web`                                                                                                                                                                                 |
| payment_method_collection  | `always` — **not set** because `mode` is `payment`. Only include when `mode` is `subscription`. The code conditionally adds it only for `subscription`.                               |

## Setup and Next Steps

### 1. Environment variables

Add these to your environment. For Cloudflare Workers, add as secrets; for local `page_server/index.js`, put in `.env` or `.dev.vars` or export in shell.

```env
# Don't put keys in code. See https://docs.stripe.com/keys-best-practices.
STRIPE_SECRET_KEY=sk_test_...
# PUBLISHABLE_KEY is only needed if you add Stripe.js on the client (not required for hosted Checkout)
STRIPE_PUBLISHABLE_KEY=pk_test_...
# Only if you add webhooks later
STRIPE_WEBHOOK_SECRET=whsec_...
```

Cloudflare Worker (production):

```bash
# from page_server/
pnpm exec wrangler secret put STRIPE_SECRET_KEY
# paste sk_test_... or sk_live_...
```

Local dev (Node `index.js`):

```bash
# create page_server/.env from the sample and fill it
STRIPE_SECRET_KEY=sk_test_... pnpm start
# or
echo "STRIPE_SECRET_KEY=sk_test_..." > page_server/.dev.vars
pnpm dev
```

Variable names are consistent: code reads `env.STRIPE_SECRET_KEY` (Worker) and `process.env.STRIPE_SECRET_KEY` (Node). No `VITE_` prefix is used — this project has no Vite.

### 2. Install dependencies

```bash
cd page_server
pnpm install
```

This installs `stripe@18.0.0` (see `package.json:dependencies`). No API version is pinned when constructing `new Stripe(key)` — leave the second argument empty per instructions.

### 3. Project structure of new files

- `page_server/worker.js` — Cloudflare Worker: `POST /api/create-checkout-session` → `stripe.checkout.sessions.create(...)` with fixed_by_ui params, `302→303` redirect to `session.url`, fallback to `env.ASSETS` for static site. Uses `stripe@18.0.0` → `ui_mode: "hosted"`.
- `page_server/index.js` — same endpoint for `pnpm start` / `pnpm dev` local server (reads `process.env.STRIPE_SECRET_KEY`, same params, same redirect logic).
- `page_server/services.html` — each `.buy` link now carries `data-price="price_..."` (real test Price IDs) and a small `type="module"` script that `POST`s to `/api/create-checkout-session` and redirects to `session.url`. Falls back to the original Payment Link (`https://buy.stripe.com/test_...`) if JS is off or Stripe is not configured.
- `page_server/wrangler.toml` / `wrangler.toml` — added `main = "./worker.js"` and `[assets] binding = "ASSETS"` with `run_worker_first = ["/api/*"]` so `/api/*` hits the Worker and everything else serves static.
- `STRIPE_INTEGRATION_TODO.md` — this file.

### 4. How the integration works

1. Visitor clicks **Buy** on `/services` (e.g., AI implementation €300). The `data-price` for that offer is sent.
2. Browser `fetch` → `POST /api/create-checkout-session` with `{"price":"price_1URymoGLxtix6XhLrGuJxo5F"}`.
3. Server builds `sessionParams` with the 7 fixed_by_ui values plus `mode`, `success_url`, `cancel_url`, `line_items` (sample_only, now set to the requested `price`), and for `payment` mode omits `payment_method_collection`.
4. `stripe.checkout.sessions.create(sessionParams)` → returns `session.url` (Stripe-hosted page, `ui_mode: hosted`).
5. Browser is redirected `303` to Stripe. After payment Stripe redirects to `success_url` (`/thanks?session_id={CHECKOUT_SESSION_ID}`) or `cancel_url` (`/services`).

Hosted Checkout means you never handle card data; Stripe does.

### 5. Testing

- Use Stripe test keys (`sk_test_...`) and test card numbers: `4242 4242 4242 4242` (visa success), `4000 0025 0000 3155` (requires 3DS), `4000 0000 0000 9995` (fails). See https://docs.stripe.com/testing
- Keep `mode` as `payment` for these one-time services. For subscriptions, change to `subscription` and the server will then include `payment_method_collection: "always"`.
- Test both flows:
  - With JS enabled (Checkout Session via `/api/create-checkout-session`)
  - With JS disabled (fallback Payment Links `buy.stripe.com/test_...` still work)
- Check `success_url` lands on `/thanks` and `cancel_url` returns to `/services`.

### 6. Next steps before going live

- [ ] Replace the five test Price IDs in `services.html:data-price` with live Price IDs (Dashboard → Prices → copy `price_...` live).
- [ ] Set `STRIPE_SECRET_KEY` live (`sk_live_...`) as Worker secret and remove test keys from `.env`/`.dev.vars`.
- [ ] Switch Payment Links to live (`buy.stripe.com/live_...`) or remove fallback hrefs once Checkout Sessions are verified.
- [ ] If you upgrade `stripe` to `>=21.0.0`, change `ui_mode` from `hosted` to `hosted_page` in both `worker.js` and `index.js` (or keep `hosted` — both work but `hosted_page` is the new name).
- [ ] Add `STRIPE_WEBHOOK_SECRET` and a `POST /api/webhook` handler only if you need fulfillment (grant access, emails). Current code has no webhook — add only when you have a datastore pattern for `customer_id`/`subscription_id`.
- [ ] Verify `automatic_tax`, `phone_number_collection`, `billing_address_collection`, etc., still match your Checkout Studio UI before each deploy.

### 7. Resources

- https://support.stripe.com
- https://docs.stripe.com/mcp
- https://docs.stripe.com/checkout/quickstart
- https://docs.stripe.com/keys-best-practices

### 8. ui_mode versioning note

`stripe@18.0.0` (< 21.0.0) uses `ui_mode: "hosted"`. If `package.json:stripe` is upgraded to `21.0.0+`, change to `hosted_page`. If you cannot determine the version, default to `hosted_page` (current code documents the version).
