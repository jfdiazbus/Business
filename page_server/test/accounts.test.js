// Accounts, orders and comments.
//
// The Worker talks to D1 with a handful of prepared statements, so this file
// carries a small in memory stand in for D1 rather than a live database. It is
// deliberately literal: every query the Worker runs has a branch here, and a
// query that is not understood fails loudly instead of returning nothing.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../worker.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const servicesHtml = readFileSync(path.join(PROJECT_ROOT, "services.html"), "utf8");

function normalize(query) {
  return query.replace(/\s+/g, " ").trim();
}

function makeDb() {
  const state = {
    users: [],
    sessions: [],
    attempts: [],
    orders: [],
    comments: [],
    posts: [],
  };

  return {
    state,
    prepare(query) {
      const sql = normalize(query);
      let values = [];

      const api = {
        bind(...bound) {
          values = bound;
          return api;
        },

        async first() {
          if (sql.startsWith("SELECT u.id, u.email, u.name, u.created_at FROM user_sessions")) {
            const [hash, now] = values;
            const session = state.sessions.find(
              (item) => item.token_hash === hash && item.expires_at > now,
            );
            if (!session) return null;
            const user = state.users.find((item) => item.id === session.user_id);
            return user
              ? {
                  id: user.id,
                  email: user.email,
                  name: user.name,
                  created_at: user.created_at,
                }
              : null;
          }

          if (sql.startsWith("SELECT id, email, name, password_hash FROM users WHERE email = ?")) {
            return state.users.find((item) => item.email === values[0]) || null;
          }

          if (sql === "SELECT password_hash FROM users WHERE id = ?") {
            const user = state.users.find((item) => item.id === values[0]);
            return user ? { password_hash: user.password_hash } : null;
          }

          if (sql === "SELECT id, email FROM users WHERE id = ?") {
            const user = state.users.find((item) => item.id === values[0]);
            return user ? { id: user.id, email: user.email } : null;
          }

          if (sql.includes("COUNT(*) AS attempts FROM account_attempts")) {
            const [kind, hash, cutoff] = values;
            return {
              attempts: state.attempts.filter(
                (item) =>
                  item.kind === kind && item.address_hash === hash && item.attempted_at >= cutoff,
              ).length,
            };
          }

          if (sql.startsWith("SELECT slug FROM blog_posts WHERE slug = ?")) {
            return (
              state.posts.find((post) => post.slug === values[0] && post.status === "published") ||
              null
            );
          }

          throw new Error(`Unexpected first(): ${sql}`);
        },

        async all() {
          if (sql.startsWith("SELECT id, amount_total, currency, offer, payment_status")) {
            return {
              results: state.orders
                .filter((order) => order.user_id === values[0])
                .sort((a, b) => b.created_at.localeCompare(a.created_at)),
            };
          }

          if (sql.startsWith("SELECT c.id, c.user_id, c.body, c.created_at, u.name")) {
            return {
              results: state.comments
                .filter((comment) => comment.post_slug === values[0])
                .sort((a, b) => a.created_at.localeCompare(b.created_at))
                .map((comment) => {
                  const user = state.users.find((item) => item.id === comment.user_id);
                  return { ...comment, name: user ? user.name : "" };
                }),
            };
          }

          throw new Error(`Unexpected all(): ${sql}`);
        },

        async run() {
          if (sql.startsWith("INSERT INTO users")) {
            const [id, email, name, password_hash, created_at, updated_at] = values;
            if (state.users.some((item) => item.email === email)) {
              throw new Error("UNIQUE constraint failed: users.email");
            }
            state.users.push({ id, email, name, password_hash, created_at, updated_at });
            return { meta: { changes: 1 } };
          }

          if (sql.startsWith("INSERT INTO user_sessions")) {
            const [token_hash, user_id, created_at, expires_at] = values;
            state.sessions.push({ token_hash, user_id, created_at, expires_at });
            return { meta: { changes: 1 } };
          }

          if (sql === "DELETE FROM user_sessions WHERE expires_at <= ?") {
            const before = state.sessions.length;
            state.sessions = state.sessions.filter((item) => item.expires_at > values[0]);
            return { meta: { changes: before - state.sessions.length } };
          }

          if (sql === "DELETE FROM user_sessions WHERE token_hash = ?") {
            const before = state.sessions.length;
            state.sessions = state.sessions.filter((item) => item.token_hash !== values[0]);
            return { meta: { changes: before - state.sessions.length } };
          }

          if (sql === "DELETE FROM user_sessions WHERE user_id = ? AND token_hash <> ?") {
            const before = state.sessions.length;
            state.sessions = state.sessions.filter(
              (item) => !(item.user_id === values[0] && item.token_hash !== values[1]),
            );
            return { meta: { changes: before - state.sessions.length } };
          }

          if (sql === "DELETE FROM user_sessions WHERE user_id = ?") {
            const before = state.sessions.length;
            state.sessions = state.sessions.filter((item) => item.user_id !== values[0]);
            return { meta: { changes: before - state.sessions.length } };
          }

          if (sql.startsWith("DELETE FROM account_attempts")) {
            const [kind, cutoff] = values;
            const before = state.attempts.length;
            state.attempts = state.attempts.filter(
              (item) => !(item.kind === kind && item.attempted_at < cutoff),
            );
            return { meta: { changes: before - state.attempts.length } };
          }

          if (sql.startsWith("INSERT INTO account_attempts")) {
            const [kind, address_hash, attempted_at] = values;
            state.attempts.push({ kind, address_hash, attempted_at });
            return { meta: { changes: 1 } };
          }

          if (sql.startsWith("INSERT INTO orders")) {
            const [id, user_id, email, amount_total, currency, offer, payment_status, created_at] =
              values;
            const existing = state.orders.find((item) => item.id === id);
            if (existing) {
              existing.payment_status = payment_status;
              existing.user_id = existing.user_id ?? user_id;
              existing.email = existing.email ?? email;
            } else {
              state.orders.push({
                id,
                user_id,
                email,
                amount_total,
                currency,
                offer,
                payment_status,
                created_at,
              });
            }
            return { meta: { changes: 1 } };
          }

          if (sql === "UPDATE orders SET user_id = NULL WHERE user_id = ?") {
            let changed = 0;
            for (const order of state.orders) {
              if (order.user_id === values[0]) {
                order.user_id = null;
                changed += 1;
              }
            }
            return { meta: { changes: changed } };
          }

          if (sql.startsWith("UPDATE users SET password_hash")) {
            const user = state.users.find((item) => item.id === values[2]);
            if (!user) return { meta: { changes: 0 } };
            user.password_hash = values[0];
            user.updated_at = values[1];
            return { meta: { changes: 1 } };
          }

          if (sql === "DELETE FROM blog_comments WHERE user_id = ?") {
            const before = state.comments.length;
            state.comments = state.comments.filter((item) => item.user_id !== values[0]);
            return { meta: { changes: before - state.comments.length } };
          }

          if (sql.startsWith("INSERT INTO blog_comments")) {
            const [id, post_slug, user_id, body, created_at] = values;
            state.comments.push({ id, post_slug, user_id, body, created_at });
            return { meta: { changes: 1 } };
          }

          if (sql === "DELETE FROM blog_comments WHERE id = ? AND user_id = ?") {
            const before = state.comments.length;
            state.comments = state.comments.filter(
              (item) => !(item.id === values[0] && item.user_id === values[1]),
            );
            return { meta: { changes: before - state.comments.length } };
          }

          if (sql === "DELETE FROM users WHERE id = ?") {
            const before = state.users.length;
            state.users = state.users.filter((item) => item.id !== values[0]);
            return { meta: { changes: before - state.users.length } };
          }

          throw new Error(`Unexpected run(): ${sql}`);
        },
      };

      return api;
    },
  };
}

function request(url, method = "GET", body, headers = {}) {
  return new Request(`https://portfolio.test${url}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

function makeEnv() {
  const db = makeDb();
  const calls = { create: [], retrieve: [], events: [] };
  let paidSession = null;

  const env = {
    DB: db,
    ASSETS: { fetch: async (request) => new Response(new URL(request.url).pathname) },
    BLOG_ADMIN_PASSWORD: "correct horse battery staple, kept outside source",
    BLOG_SESSION_SECRET: "a different signing secret kept outside source and longer than 32 bytes",
    STRIPE_SECRET_KEY: "sk_test_not_a_real_key",
    STRIPE_WEBHOOK_SECRET: "whsec_test_not_a_real_secret",
    STRIPE_CLIENT: {
      checkout: {
        sessions: {
          async create(params) {
            calls.create.push(params);
            return { url: "https://checkout.stripe.test/session" };
          },
          async retrieve(id) {
            calls.retrieve.push(id);
            return paidSession;
          },
        },
      },
      webhooks: {
        async constructEventAsync(payload) {
          if (payload === "not from stripe") throw new Error("bad signature");
          calls.events.push(payload);
          return JSON.parse(payload);
        },
      },
    },
    calls,
    setPaidSession(session) {
      paidSession = session;
    },
  };

  return env;
}

const cookieFrom = (response) => response.headers.get("Set-Cookie").split(";")[0];

async function register(env, overrides = {}) {
  const response = await worker.fetch(
    request(
      "/api/account/register",
      "POST",
      {
        name: "Ana Reader",
        email: "Ana@Example.com",
        password: "a long enough password",
        ...overrides,
      },
      { Origin: "https://portfolio.test" },
    ),
    env,
  );
  return { response, cookie: response.ok ? cookieFrom(response) : "" };
}

async function signedInUser(env, overrides = {}) {
  const { response, cookie } = await register(env, overrides);
  const body = await response.json();
  return { cookie, user: body.user };
}

describe("creating an account", () => {
  it("creates one, signs the reader in, and never returns the password", async () => {
    const env = makeEnv();
    const { response, cookie } = await register(env);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.user.email).toBe("ana@example.com");
    expect(body.user.name).toBe("Ana Reader");
    expect(JSON.stringify(body)).not.toContain("password");
    expect(env.DB.state.users[0].password_hash).toMatch(/^pbkdf2_sha256\$100000\$/);
    expect(env.DB.state.users[0].password_hash).not.toContain("a long enough password");

    expect(response.headers.get("Set-Cookie")).toMatch(/HttpOnly; Secure; SameSite=Lax/);
    expect(cookie).toMatch(/^user_session=/);

    const session = await worker.fetch(
      request("/api/account/session", "GET", undefined, { Cookie: cookie }),
      env,
    );
    const result = await session.json();
    expect(result.authenticated).toBe(true);
    expect(result.user.email).toBe("ana@example.com");
    expect(result.user.password_hash).toBeUndefined();
  });

  it("says no to a duplicate email, a short password, and a bad address", async () => {
    const env = makeEnv();
    await register(env);

    const duplicate = await register(env, { email: "ana@example.com" });
    expect(duplicate.response.status).toBe(409);

    const short = await register(env, { email: "short@example.com", password: "short" });
    expect(short.response.status).toBe(400);

    const bad = await register(env, { email: "not an email" });
    expect(bad.response.status).toBe(400);

    const crossOrigin = await worker.fetch(
      request(
        "/api/account/register",
        "POST",
        { email: "other@example.com", password: "a long enough password" },
        { Origin: "https://attacker.example" },
      ),
      env,
    );
    expect(crossOrigin.status).toBe(403);
  });

  it("slows down repeated registrations from one address", async () => {
    const env = makeEnv();
    let last;

    for (let i = 0; i < 6; i += 1) {
      last = await register(env, { email: `reader${i}@example.com` });
    }

    expect(last.response.status).toBe(429);
  });

  it("keeps each limit's history when another limit is checked", async () => {
    const env = makeEnv();
    const first = await register(env);
    expect(first.response.status).toBe(201);

    // A registration from half an hour ago still counts: the window is an hour.
    const attempt = env.DB.state.attempts.find((item) => item.kind === "register");
    attempt.attempted_at -= 30 * 60;

    // A failed sign in checks and prunes only the sign in history.
    await worker.fetch(
      request(
        "/api/account/login",
        "POST",
        { email: "nobody@example.com", password: "not the password" },
        { Origin: "https://portfolio.test" },
      ),
      env,
    );

    for (let i = 0; i < 4; i += 1) {
      await register(env, { email: `later${i}@example.com` });
    }

    const sixth = await register(env, { email: "sixth@example.com" });
    expect(sixth.response.status).toBe(429);
  });
});

describe("signing in", () => {
  it("accepts the right password and refuses the wrong one", async () => {
    const env = makeEnv();
    const { user } = await signedInUser(env);

    const wrong = await worker.fetch(
      request(
        "/api/account/login",
        "POST",
        { email: user.email, password: "not the password" },
        { Origin: "https://portfolio.test" },
      ),
      env,
    );
    expect(wrong.status).toBe(401);

    const right = await worker.fetch(
      request(
        "/api/account/login",
        "POST",
        { email: "ANA@example.com", password: "a long enough password" },
        { Origin: "https://portfolio.test" },
      ),
      env,
    );
    expect(right.status).toBe(200);
    expect(right.headers.get("Set-Cookie")).toMatch(/^user_session=/);
  });

  it("does not say whether an email is registered", async () => {
    const env = makeEnv();
    const response = await worker.fetch(
      request(
        "/api/account/login",
        "POST",
        { email: "nobody@example.com", password: "a long enough password" },
        { Origin: "https://portfolio.test" },
      ),
      env,
    );

    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe("Email or password is not correct");
  });

  it("signs out by deleting the session and clearing the cookie", async () => {
    const env = makeEnv();
    const { cookie } = await signedInUser(env);

    const logout = await worker.fetch(
      request(
        "/api/account/logout",
        "POST",
        {},
        { Cookie: cookie, Origin: "https://portfolio.test" },
      ),
      env,
    );
    expect(logout.status).toBe(200);
    expect(logout.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(env.DB.state.sessions).toHaveLength(0);

    const session = await worker.fetch(
      request("/api/account/session", "GET", undefined, { Cookie: cookie }),
      env,
    );
    expect((await session.json()).authenticated).toBe(false);
  });
});

describe("orders", () => {
  it("marks a checkout as belonging to the signed in reader", async () => {
    const env = makeEnv();
    const { user, cookie } = await signedInUser(env);

    const response = await worker.fetch(
      request(
        "/api/create-checkout-session",
        "POST",
        { price: "price_1URy83FtV5oJWaqwYTOp40qz" },
        { Cookie: cookie, Accept: "application/json" },
      ),
      env,
    );

    expect(response.status).toBe(200);
    expect(env.calls.create[0].client_reference_id).toBe(user.id);
    expect(env.calls.create[0].customer_email).toBe(user.email);
    expect(env.calls.create[0].metadata.offer).toBe("A website");
  });

  it("accepts every price the services page offers, and only those", async () => {
    const prices = [...servicesHtml.matchAll(/data-price="([^"]+)"/g)].map((match) => match[1]);
    expect(prices).toHaveLength(5);

    for (const price of prices) {
      const env = makeEnv();
      const response = await worker.fetch(
        request("/api/create-checkout-session", "POST", { price }, { Accept: "application/json" }),
        env,
      );
      expect(response.status, price).toBe(200);
      expect(env.calls.create[0].metadata.offer, price).toBeTruthy();
    }
  });

  it("leaves a checkout anonymous when nobody is signed in, and rejects other prices", async () => {
    const env = makeEnv();

    const anonymous = await worker.fetch(
      request(
        "/api/create-checkout-session",
        "POST",
        { price: "price_1URzlPFtV5oJWaqwF1mFUifx" },
        { Accept: "application/json" },
      ),
      env,
    );
    expect(anonymous.status).toBe(200);
    expect(env.calls.create[0].client_reference_id).toBeUndefined();

    const unknown = await worker.fetch(
      request(
        "/api/create-checkout-session",
        "POST",
        { price: "price_made_up" },
        { Accept: "application/json" },
      ),
      env,
    );
    expect(unknown.status).toBe(400);
  });

  it("saves a paid checkout once, and only for the reader who owns it", async () => {
    const env = makeEnv();
    const { user, cookie } = await signedInUser(env);

    env.setPaidSession({
      id: "cs_test_123",
      client_reference_id: user.id,
      customer_details: { email: user.email },
      amount_total: 10000,
      currency: "eur",
      payment_status: "paid",
      metadata: { offer: "A website" },
      created: 1792351703,
    });

    const first = await worker.fetch(
      request(
        "/api/account/orders/reconcile",
        "POST",
        { sessionId: "cs_test_123" },
        { Cookie: cookie, Origin: "https://portfolio.test" },
      ),
      env,
    );
    expect(first.status).toBe(200);
    expect((await first.json()).orders).toHaveLength(1);

    const again = await worker.fetch(
      request(
        "/api/account/orders/reconcile",
        "POST",
        { sessionId: "cs_test_123" },
        { Cookie: cookie, Origin: "https://portfolio.test" },
      ),
      env,
    );
    expect((await again.json()).orders).toHaveLength(1);
    expect(env.DB.state.orders).toHaveLength(1);
    expect(env.DB.state.orders[0].offer).toBe("A website");

    const other = await signedInUser(env, { email: "other@example.com", name: "Other" });
    const stolen = await worker.fetch(
      request(
        "/api/account/orders/reconcile",
        "POST",
        { sessionId: "cs_test_123" },
        { Cookie: other.cookie, Origin: "https://portfolio.test" },
      ),
      env,
    );
    expect(stolen.status).toBe(403);
  });

  it("records a webhook event and refuses a bad signature", async () => {
    const env = makeEnv();
    const { user } = await signedInUser(env);

    const good = await worker.fetch(
      request(
        "/api/stripe/webhook",
        "POST",
        {
          type: "checkout.session.completed",
          data: {
            object: {
              id: "cs_live_webhook",
              client_reference_id: user.id,
              amount_total: 20000,
              currency: "eur",
              payment_status: "unpaid",
              metadata: { offer: "An API" },
              created: 1792351703,
            },
          },
        },
        { "Stripe-Signature": "t=1,v1=test" },
      ),
      env,
    );
    expect(good.status).toBe(200);
    expect(env.DB.state.orders[0].id).toBe("cs_live_webhook");
    expect(env.DB.state.orders[0].payment_status).toBe("unpaid");

    const settled = await worker.fetch(
      request(
        "/api/stripe/webhook",
        "POST",
        {
          type: "checkout.session.async_payment_succeeded",
          data: {
            object: {
              id: "cs_live_webhook",
              client_reference_id: user.id,
              amount_total: 20000,
              currency: "eur",
              payment_status: "paid",
              metadata: { offer: "An API" },
              created: 1792351703,
            },
          },
        },
        { "Stripe-Signature": "t=1,v1=test" },
      ),
      env,
    );
    expect(settled.status).toBe(200);
    expect(env.DB.state.orders).toHaveLength(1);
    expect(env.DB.state.orders[0].payment_status).toBe("paid");

    const bad = await worker.fetch(
      request("/api/stripe/webhook", "POST", "not from stripe", {
        "Stripe-Signature": "t=1,v1=test",
      }),
      env,
    );
    expect(bad.status).toBe(400);
  });
});

describe("comments", () => {
  function withPost(env, slug = "a-post") {
    env.DB.state.posts.push({ slug, status: "published" });
    return slug;
  }

  it("asks anonymous readers to sign in, and takes a comment from a reader", async () => {
    const env = makeEnv();
    const slug = withPost(env);

    const anonymous = await worker.fetch(
      request(
        `/api/blog/posts/${slug}/comments`,
        "POST",
        { body: "No account." },
        { Origin: "https://portfolio.test" },
      ),
      env,
    );
    expect(anonymous.status).toBe(401);

    const { user, cookie } = await signedInUser(env);
    const posted = await worker.fetch(
      request(
        `/api/blog/posts/${slug}/comments`,
        "POST",
        { body: "A useful note." },
        { Cookie: cookie, Origin: "https://portfolio.test" },
      ),
      env,
    );
    expect(posted.status).toBe(201);
    expect((await posted.json()).comment.author).toBe("Ana Reader");

    const listed = await worker.fetch(
      request(`/api/blog/posts/${slug}/comments`, "GET", undefined, { Cookie: cookie }),
      env,
    );
    const result = await listed.json();
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].body).toBe("A useful note.");
    expect(result.comments[0].mine).toBe(true);
    expect(result.comments[0].user_id).toBeUndefined();
    expect(result.comments[0].email).toBeUndefined();

    const { cookie: otherCookie } = await signedInUser(env, {
      email: "other@example.com",
      name: "Other",
    });
    const seenByOther = await worker.fetch(
      request(`/api/blog/posts/${slug}/comments`, "GET", undefined, { Cookie: otherCookie }),
      env,
    );
    expect((await seenByOther.json()).comments[0].mine).toBe(false);
    expect(user.id).toBeTruthy();
  });

  it("only deletes your own comment, and only on a published post", async () => {
    const env = makeEnv();
    const slug = withPost(env);
    const { cookie } = await signedInUser(env);

    const posted = await worker.fetch(
      request(
        `/api/blog/posts/${slug}/comments`,
        "POST",
        { body: "Mine." },
        { Cookie: cookie, Origin: "https://portfolio.test" },
      ),
      env,
    );
    const { comment } = await posted.json();

    const { cookie: otherCookie } = await signedInUser(env, {
      email: "other@example.com",
      name: "Other",
    });
    const stolen = await worker.fetch(
      request(
        `/api/blog/comments/${comment.id}`,
        "DELETE",
        {},
        {
          Cookie: otherCookie,
          Origin: "https://portfolio.test",
        },
      ),
      env,
    );
    expect(stolen.status).toBe(404);

    const own = await worker.fetch(
      request(
        `/api/blog/comments/${comment.id}`,
        "DELETE",
        {},
        {
          Cookie: cookie,
          Origin: "https://portfolio.test",
        },
      ),
      env,
    );
    expect(own.status).toBe(200);

    const draftOnly = await worker.fetch(
      request(
        "/api/blog/posts/not-published/comments",
        "POST",
        { body: "Should not land." },
        { Cookie: cookie, Origin: "https://portfolio.test" },
      ),
      env,
    );
    expect(draftOnly.status).toBe(404);
  });
});

describe("changing and deleting an account", () => {
  it("changes the password, signs out the other devices and keeps this one", async () => {
    const env = makeEnv();
    const { user, cookie } = await signedInUser(env);

    const second = await worker.fetch(
      request(
        "/api/account/login",
        "POST",
        { email: user.email, password: "a long enough password" },
        { Origin: "https://portfolio.test" },
      ),
      env,
    );
    expect(second.status).toBe(200);
    expect(env.DB.state.sessions).toHaveLength(2);

    const wrong = await worker.fetch(
      request(
        "/api/account/password",
        "POST",
        { currentPassword: "not it", newPassword: "an even longer password" },
        { Cookie: cookie, Origin: "https://portfolio.test" },
      ),
      env,
    );
    expect(wrong.status).toBe(401);

    const changed = await worker.fetch(
      request(
        "/api/account/password",
        "POST",
        { currentPassword: "a long enough password", newPassword: "an even longer password" },
        { Cookie: cookie, Origin: "https://portfolio.test" },
      ),
      env,
    );
    expect(changed.status).toBe(200);
    expect(env.DB.state.sessions).toHaveLength(1);

    const oldPassword = await worker.fetch(
      request(
        "/api/account/login",
        "POST",
        { email: user.email, password: "a long enough password" },
        { Origin: "https://portfolio.test" },
      ),
      env,
    );
    expect(oldPassword.status).toBe(401);

    const newPassword = await worker.fetch(
      request(
        "/api/account/login",
        "POST",
        { email: user.email, password: "an even longer password" },
        { Origin: "https://portfolio.test" },
      ),
      env,
    );
    expect(newPassword.status).toBe(200);
  });

  it("deletes the account, its comments and its sessions, and keeps the order", async () => {
    const env = makeEnv();
    const slug = "a-post";
    env.DB.state.posts.push({ slug, status: "published" });
    const { user, cookie } = await signedInUser(env);

    await worker.fetch(
      request(
        `/api/blog/posts/${slug}/comments`,
        "POST",
        { body: "A comment that goes with the account." },
        { Cookie: cookie, Origin: "https://portfolio.test" },
      ),
      env,
    );

    env.setPaidSession({
      id: "cs_test_delete",
      client_reference_id: user.id,
      amount_total: 30000,
      currency: "eur",
      payment_status: "paid",
      metadata: { offer: "AI implementation for businesses" },
      created: 1792351703,
    });

    const saved = await worker.fetch(
      request(
        "/api/account/orders/reconcile",
        "POST",
        { sessionId: "cs_test_delete" },
        { Cookie: cookie, Origin: "https://portfolio.test" },
      ),
      env,
    );
    expect(saved.status).toBe(200);

    const removed = await worker.fetch(
      request(
        "/api/account",
        "DELETE",
        { password: "a long enough password" },
        {
          Cookie: cookie,
          Origin: "https://portfolio.test",
        },
      ),
      env,
    );
    expect(removed.status).toBe(200);
    expect(removed.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(env.DB.state.users).toHaveLength(0);
    expect(env.DB.state.sessions).toHaveLength(0);
    expect(env.DB.state.comments).toHaveLength(0);
    expect(env.DB.state.orders[0].user_id).toBeNull();
  });
});
