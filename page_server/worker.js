// The portfolio is static assets with a small blog API and Stripe Checkout.
//
// D1 stores post records, R2 stores the media bytes. Blog content is a validated
// list of blocks, never HTML; the browser renders every text value with
// textContent. The admin API is password protected with a short lived signed
// cookie, and every write checks its Origin. Payments use Stripe hosted Checkout.

import Stripe from "stripe";

const encoder = new TextEncoder();
const COOKIE = "blog_admin";
const SESSION_SECONDS = 8 * 60 * 60;
const MAX_JSON_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_BYTES = 32 * 1024 * 1024;
const MEDIA_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
]);
const MEDIA_KEY = /^blog-media\/[0-9a-f-]{36}\.(?:jpg|png|webp|gif|mp4|webm)$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TEMPLATES = new Set(["article", "project", "photo-story"]);

// Accounts: readers and customers, not the blog writing desk.
const USER_COOKIE = "user_session";
const USER_SESSION_SECONDS = 30 * 24 * 60 * 60;
// Cloudflare Workers refuses PBKDF2 above 100,000 iterations, so this is the
// platform ceiling rather than the OWASP recommendation. It still makes each
// guess cost real work, and the format records the count for a future upgrade.
const PASSWORD_ITERATIONS = 100000;
const PASSWORD_MIN = 10;
const PASSWORD_MAX = 200;
const COMMENT_MAX = 2000;

// The five offers, by the live Price ID that is also in services.html. Only
// these prices can be checked out, and the label travels to the webhook.
const OFFER_BY_PRICE = {
  price_1URy83FtV5oJWaqwYTOp40qz: "A website",
  price_1URy86FtV5oJWaqwD4iGGeTq: "An API",
  price_1URy83FtV5oJWaqwNlKbhAwD: "The whole website service",
  price_1URzlEFtV5oJWaqwXzKPYPXP: "Stripe implementation",
  price_1URzlPFtV5oJWaqwF1mFUifx: "AI implementation for businesses",
};

const json = (data, status = 200, headers = {}) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });

const error = (message, status) => json({ error: message }, status);

export function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/, "");
}

function boundedText(value, name, max, required = false) {
  if (typeof value !== "string") throw new TypeError(`${name} must be text`);
  const text = value.trim();
  if (required && !text) throw new TypeError(`${name} is required`);
  if (text.length > max) throw new TypeError(`${name} is too long`);
  return text;
}

function validateBlock(block, depth = 0) {
  if (!block || typeof block !== "object" || Array.isArray(block)) {
    throw new TypeError("Each section must be a block");
  }
  if (depth > 1) throw new TypeError("Columns cannot be nested");

  switch (block.type) {
    case "paragraph":
      return { type: "paragraph", text: boundedText(block.text, "Paragraph", 20000) };
    case "heading": {
      const level = Number(block.level);
      if (level !== 2 && level !== 3) throw new TypeError("A heading must be level 2 or 3");
      return { type: "heading", level, text: boundedText(block.text, "Heading", 180, true) };
    }
    case "image":
    case "video": {
      if (typeof block.key !== "string" || !MEDIA_KEY.test(block.key)) {
        throw new TypeError("Media must be uploaded through the blog editor");
      }
      return {
        type: block.type,
        key: block.key,
        alt: boundedText(block.alt || "", "Alternative text", 300, block.type === "image"),
        caption: boundedText(block.caption || "", "Caption", 500),
      };
    }
    case "columns": {
      if (!Array.isArray(block.columns) || block.columns.length < 2 || block.columns.length > 3) {
        throw new TypeError("A columns section needs two or three columns");
      }
      return {
        type: "columns",
        columns: block.columns.map((column) => {
          if (!column || typeof column !== "object") throw new TypeError("Invalid column");
          return {
            heading: boundedText(column.heading || "", "Column heading", 120),
            text: boundedText(column.text || "", "Column text", 12000),
          };
        }),
      };
    }
    default:
      throw new TypeError("Unsupported content block");
  }
}

export function validatePost(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Post data must be an object");
  }
  const title = boundedText(input.title, "Title", 140, true);
  const slug = boundedText(input.slug || slugify(title), "Slug", 80, true);
  if (!SLUG.test(slug))
    throw new TypeError("Slug may only contain lowercase letters, numbers and hyphens");
  const excerpt = boundedText(input.excerpt || "", "Summary", 400);
  const status = input.status === "published" ? "published" : "draft";
  const template = TEMPLATES.has(input.template) ? input.template : "article";
  if (!Array.isArray(input.blocks) || input.blocks.length > 100) {
    throw new TypeError("A post needs up to 100 content blocks");
  }
  const blocks = input.blocks.map((block) => validateBlock(block));
  const coverKey = input.coverKey || null;
  if (coverKey && (typeof coverKey !== "string" || !MEDIA_KEY.test(coverKey))) {
    throw new TypeError("Cover image must be uploaded through the blog editor");
  }
  if (status === "published" && blocks.length === 0) {
    throw new TypeError("Add some content before publishing");
  }

  return {
    id:
      typeof input.id === "string" && /^[0-9a-f-]{36}$/i.test(input.id)
        ? input.id
        : crypto.randomUUID(),
    slug,
    title,
    excerpt,
    status,
    template,
    coverKey,
    blocks,
  };
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function sameSecret(candidate, expected) {
  const [left, right] = await Promise.all([digest(candidate), digest(expected)]);
  let different = 0;
  for (let i = 0; i < left.length; i += 1) different |= left[i] ^ right[i];
  return different === 0;
}

function toHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function loginIsLimited(db, address, secret, now = Date.now()) {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(secret),
    encoder.encode(address || "unknown"),
  );
  const addressHash = toHex(new Uint8Array(signature));
  const cutoff = Math.floor((now - 15 * 60 * 1000) / 1000);
  await db.prepare("DELETE FROM blog_login_attempts WHERE attempted_at < ?").bind(cutoff).run();
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS attempts FROM blog_login_attempts WHERE address_hash = ? AND attempted_at >= ?",
    )
    .bind(addressHash, cutoff)
    .first();
  if (Number(row?.attempts || 0) >= 8) return true;
  await db
    .prepare("INSERT INTO blog_login_attempts (address_hash, attempted_at) VALUES (?, ?)")
    .bind(addressHash, Math.floor(now / 1000))
    .run();
  return false;
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromBase64Url(value) {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function signingKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function issueSession(secret, now = Date.now()) {
  const payload = `${now + SESSION_SECONDS * 1000}.${crypto.randomUUID()}`;
  const key = await signingKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${toBase64Url(encoder.encode(payload))}.${toBase64Url(new Uint8Array(signature))}`;
}

function cookieValue(request, name) {
  const cookies = request.headers.get("Cookie") || "";
  const entry = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : "";
}

function getCookie(request) {
  return cookieValue(request, COOKIE);
}

async function hasSession(request, secret, now = Date.now()) {
  if (!secret) return false;
  const [encodedPayload, encodedSignature, extra] = getCookie(request).split(".");
  if (!encodedPayload || !encodedSignature || extra) return false;
  try {
    const payload = new TextDecoder().decode(fromBase64Url(encodedPayload));
    const [expires, nonce, rest] = payload.split(".");
    if (!expires || !nonce || rest || Number(expires) <= now) return false;
    return crypto.subtle.verify(
      "HMAC",
      await signingKey(secret),
      fromBase64Url(encodedSignature),
      encoder.encode(payload),
    );
  } catch {
    return false;
  }
}

function setSessionCookie(value) {
  return `${COOKIE}=${value}; Path=/api/blog; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

function clearSessionCookie() {
  return `${COOKIE}=; Path=/api/blog; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

// --- accounts -------------------------------------------------------------

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function validEmail(email) {
  return email.length > 3 && email.length <= 254 && EMAIL.test(email);
}

function userCookie(value, maxAge = USER_SESSION_SECONDS) {
  return `${USER_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearUserCookie() {
  return `${USER_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

async function derivePassword(password, salt, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return new Uint8Array(bits);
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt);
  return `pbkdf2_sha256$${PASSWORD_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

async function verifyPassword(password, stored) {
  const [scheme, iterations, salt, hash] = String(stored || "").split("$");
  if (scheme !== "pbkdf2_sha256" || !iterations || !salt || !hash) return false;
  const rounds = Number(iterations);
  if (!Number.isInteger(rounds) || rounds !== PASSWORD_ITERATIONS) return false;
  const expected = fromBase64Url(hash);
  const actual = await derivePassword(password, fromBase64Url(salt), rounds);
  if (actual.length !== expected.length) return false;
  let different = 0;
  for (let i = 0; i < actual.length; i += 1) different |= actual[i] ^ expected[i];
  return different === 0;
}

async function tokenHash(token) {
  return toHex(await digest(token));
}

/** The signed in reader, or null. Never returns the password hash. */
async function sessionUser(request, env) {
  if (!env.DB) return null;
  const token = cookieValue(request, USER_COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(
    "SELECT u.id, u.email, u.name, u.created_at FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
  )
    .bind(await tokenHash(token), new Date().toISOString())
    .first()
    .catch(() => null);
  return row || null;
}

async function createUserSession(db, userId) {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const now = new Date();
  const expires = new Date(now.getTime() + USER_SESSION_SECONDS * 1000);
  await db
    .prepare(
      "INSERT INTO user_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    )
    .bind(await tokenHash(token), userId, now.toISOString(), expires.toISOString())
    .run();
  await db
    .prepare("DELETE FROM user_sessions WHERE expires_at <= ?")
    .bind(now.toISOString())
    .run()
    .catch(() => {});
  return token;
}

/** A hash of the network address, so the table never holds it in the clear. */
async function attemptKey(kind, value) {
  return toHex(await digest(`${kind}:${String(value || "unknown")}`));
}

async function attemptCount(db, kind, value, limit, windowSeconds, now = Date.now()) {
  if (!db) return 0;
  const cutoff = Math.floor((now - windowSeconds * 1000) / 1000);
  await db
    .prepare("DELETE FROM account_attempts WHERE kind = ? AND attempted_at < ?")
    .bind(kind, cutoff)
    .run()
    .catch(() => {});
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS attempts FROM account_attempts WHERE kind = ? AND address_hash = ? AND attempted_at >= ?",
    )
    .bind(kind, await attemptKey(kind, value), cutoff)
    .first()
    .catch(() => null);
  return Number(row?.attempts || 0) >= limit;
}

async function recordAttempt(db, kind, value, now = Date.now()) {
  if (!db) return;
  await db
    .prepare("INSERT INTO account_attempts (kind, address_hash, attempted_at) VALUES (?, ?, ?)")
    .bind(kind, await attemptKey(kind, value), Math.floor(now / 1000))
    .run()
    .catch(() => {});
}

function stripeClient(env) {
  return env.STRIPE_CLIENT || new Stripe(env.STRIPE_SECRET_KEY);
}

async function recordOrder(env, session) {
  if (!env.DB || !session?.id) return;
  const userId = session.client_reference_id || session.metadata?.user_id || null;
  const owner = userId
    ? await env.DB.prepare("SELECT id, email FROM users WHERE id = ?")
        .bind(userId)
        .first()
        .catch(() => null)
    : null;
  await env.DB.prepare(
    `INSERT INTO orders (id, user_id, email, amount_total, currency, offer, payment_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       payment_status = excluded.payment_status,
       user_id = COALESCE(orders.user_id, excluded.user_id),
       email = COALESCE(orders.email, excluded.email)`,
  )
    .bind(
      session.id,
      owner?.id || null,
      session.customer_details?.email || session.customer_email || owner?.email || null,
      Number(session.amount_total || 0),
      String(session.currency || "eur"),
      String(session.metadata?.offer || ""),
      String(session.payment_status || "paid"),
      new Date(Number(session.created || Date.now() / 1000) * 1000).toISOString(),
    )
    .run()
    .catch((cause) => {
      console.error("order record failed", String(cause?.message || cause));
    });
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name || "" };
}

function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  return origin !== null && origin === new URL(request.url).origin;
}

async function requireAdmin(request, env) {
  if (!env.BLOG_SESSION_SECRET || !env.BLOG_ADMIN_PASSWORD)
    return error("Blog authoring is not configured", 503);
  if (!(await hasSession(request, env.BLOG_SESSION_SECRET)))
    return error("Sign in to write posts", 401);
  return null;
}

async function readJson(request) {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > MAX_JSON_BYTES) throw new RangeError("Request is too large");
  const text = await request.text();
  if (encoder.encode(text).byteLength > MAX_JSON_BYTES)
    throw new RangeError("Request is too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new TypeError("Request body must be valid JSON");
  }
}

function postFromRow(row) {
  if (!row) return null;
  let blocks;
  try {
    blocks = JSON.parse(row.blocks_json || "[]");
  } catch {
    blocks = [];
  }
  return { ...row, blocks, blocks_json: undefined };
}

function decodeSlug(pathname) {
  try {
    const slug = decodeURIComponent(pathname);
    return SLUG.test(slug) ? slug : null;
  } catch {
    return null;
  }
}

async function handleAdminApi(request, env, url) {
  const path = url.pathname;

  if (path === "/api/blog/admin/login" && request.method === "POST") {
    if (!sameOrigin(request)) return error("Request origin could not be verified", 403);
    if (
      !env.BLOG_ADMIN_PASSWORD ||
      env.BLOG_ADMIN_PASSWORD.length < 20 ||
      !env.BLOG_SESSION_SECRET ||
      env.BLOG_SESSION_SECRET.length < 32 ||
      !env.DB
    )
      return error("Blog authoring is not configured", 503);
    const address = request.headers.get("CF-Connecting-IP") || "local development";
    if (await loginIsLimited(env.DB, address, env.BLOG_SESSION_SECRET)) {
      return error("Too many sign in attempts. Wait fifteen minutes and try again.", 429);
    }
    let input;
    try {
      input = await readJson(request);
    } catch (cause) {
      return error(cause.message, cause instanceof RangeError ? 413 : 400);
    }
    if (
      typeof input.password !== "string" ||
      !(await sameSecret(input.password, env.BLOG_ADMIN_PASSWORD))
    ) {
      return error("The password was not accepted", 401);
    }
    const token = await issueSession(env.BLOG_SESSION_SECRET);
    return json({ authenticated: true }, 200, { "Set-Cookie": setSessionCookie(token) });
  }

  if (path === "/api/blog/admin/logout" && request.method === "POST") {
    if (!sameOrigin(request)) return error("Request origin could not be verified", 403);
    return json({ authenticated: false }, 200, { "Set-Cookie": clearSessionCookie() });
  }

  if (path === "/api/blog/admin/session" && request.method === "GET") {
    const configured = Boolean(env.BLOG_ADMIN_PASSWORD && env.BLOG_SESSION_SECRET);
    return json({
      authenticated: configured && (await hasSession(request, env.BLOG_SESSION_SECRET)),
      configured,
    });
  }

  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  if (!env.DB) return error("Blog database is not configured", 503);

  if (path === "/api/blog/admin/posts" && request.method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT id, slug, title, excerpt, status, template, cover_key, blocks_json, created_at, updated_at, published_at FROM blog_posts ORDER BY updated_at DESC LIMIT 200",
    ).all();
    return json({ posts: (results || []).map(postFromRow) });
  }

  if (path === "/api/blog/admin/posts" && request.method === "POST") {
    if (!sameOrigin(request)) return error("Request origin could not be verified", 403);
    let post;
    try {
      post = validatePost(await readJson(request));
    } catch (cause) {
      return error(cause.message, cause instanceof RangeError ? 413 : 400);
    }

    const existing = await env.DB.prepare(
      "SELECT slug, created_at, published_at FROM blog_posts WHERE id = ?",
    )
      .bind(post.id)
      .first();
    const now = new Date().toISOString();
    const publishedAt = post.status === "published" ? existing?.published_at || now : null;
    try {
      await env.DB.prepare(
        `
        INSERT INTO blog_posts
          (id, slug, title, excerpt, status, template, cover_key, blocks_json, created_at, updated_at, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          slug = excluded.slug,
          title = excluded.title,
          excerpt = excluded.excerpt,
          status = excluded.status,
          template = excluded.template,
          cover_key = excluded.cover_key,
          blocks_json = excluded.blocks_json,
          updated_at = excluded.updated_at,
          published_at = excluded.published_at
      `,
      )
        .bind(
          post.id,
          post.slug,
          post.title,
          post.excerpt,
          post.status,
          post.template,
          post.coverKey,
          JSON.stringify(post.blocks),
          existing?.created_at || now,
          now,
          publishedAt,
        )
        .run();
    } catch {
      return error("That address is already used by another post", 409);
    }
    if (existing?.slug && existing.slug !== post.slug) {
      await env.DB.prepare("UPDATE blog_comments SET post_slug = ? WHERE post_slug = ?")
        .bind(post.slug, existing.slug)
        .run();
    }
    return json(
      {
        post: {
          ...post,
          cover_key: post.coverKey,
          created_at: existing?.created_at || now,
          updated_at: now,
          published_at: publishedAt,
        },
      },
      201,
    );
  }

  const deleteMatch = path.match(/^\/api\/blog\/admin\/posts\/([^/]+)$/);
  if (deleteMatch && request.method === "DELETE") {
    if (!sameOrigin(request)) return error("Request origin could not be verified", 403);
    const slug = decodeSlug(deleteMatch[1]);
    if (!slug) return error("Invalid post address", 400);
    await env.DB.prepare("DELETE FROM blog_comments WHERE post_slug = ?").bind(slug).run();
    await env.DB.prepare("DELETE FROM blog_posts WHERE slug = ?").bind(slug).run();
    return json({ deleted: slug });
  }

  if (path === "/api/blog/admin/media" && request.method === "POST") {
    if (!sameOrigin(request)) return error("Request origin could not be verified", 403);
    if (!env.MEDIA)
      return error(
        "Media storage is not configured. Enable R2 and bind the blog media bucket.",
        503,
      );
    const type = (request.headers.get("Content-Type") || "").split(";")[0].toLowerCase();
    const ext = MEDIA_TYPES.get(type);
    if (!ext) return error("Choose a JPEG, PNG, WebP or GIF image, or an MP4 or WebM video", 415);
    const max = type.startsWith("video/") ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    const length = Number(request.headers.get("Content-Length") || 0);
    if (!length) return error("Upload size is required", 411);
    if (length > max)
      return error(`This file is too large. The limit is ${Math.floor(max / 1024 / 1024)} MB`, 413);
    if (!request.body) return error("No file was sent", 400);

    const key = `blog-media/${crypto.randomUUID()}.${ext}`;
    try {
      // Keep the original request stream intact. R2 and workerd require a
      // known-length stream; wrapping it in a TransformStream loses that length.
      // Content-Length is checked above before the bounded stream reaches R2.
      await env.MEDIA.put(key, request.body, {
        httpMetadata: { contentType: type, cacheControl: "public, max-age=31536000, immutable" },
      });
    } catch (cause) {
      console.error(
        JSON.stringify({
          event: "blog_media_upload_failed",
          name: cause?.name || "Error",
          message: cause?.message || "unknown",
        }),
      );
      if (env.BLOG_DEBUG === "1")
        return error(`Media upload failed: ${cause?.message || cause}`, 502);
      return error("Media upload failed", 502);
    }
    return json({ key, url: `/blog/media/${key}`, type, size: length }, 201);
  }

  return error("Blog admin route not found", 404);
}

async function handlePublicApi(request, env, url) {
  if (!env.DB) return error("Blog database is not configured", 503);
  if (request.method !== "GET") return error("Method not allowed", 405, { Allow: "GET" });

  if (url.pathname === "/api/blog/posts") {
    const { results } = await env.DB.prepare(
      "SELECT slug, title, excerpt, template, cover_key, published_at FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 100",
    ).all();
    return json({ posts: results || [] }, 200, { "Cache-Control": "public, max-age=60" });
  }

  const match = url.pathname.match(/^\/api\/blog\/posts\/([^/]+)$/);
  if (match) {
    const slug = decodeSlug(match[1]);
    if (!slug) return error("Post not found", 404);
    const row = await env.DB.prepare(
      "SELECT slug, title, excerpt, template, cover_key, blocks_json, created_at, updated_at, published_at FROM blog_posts WHERE slug = ? AND status = 'published'",
    )
      .bind(slug)
      .first();
    if (!row) return error("Post not found", 404);
    return json({ post: postFromRow(row) }, 200, { "Cache-Control": "public, max-age=60" });
  }

  return error("Blog route not found", 404);
}

async function serveMedia(request, env, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD")
    return error("Method not allowed", 405, { Allow: "GET, HEAD" });
  if (!env.MEDIA) return error("Media storage is not configured", 503);
  let key;
  try {
    key = decodeURIComponent(pathname.slice("/blog/media/".length));
  } catch {
    return error("Media not found", 404);
  }
  if (!MEDIA_KEY.test(key)) return error("Media not found", 404);
  const object = await env.MEDIA.get(key, {
    onlyIf: request.headers,
    range: request.headers,
  });
  if (!object) return error("Media not found", 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
  if (!("body" in object)) return new Response(null, { status: 412, headers });
  let status = 200;
  if (request.headers.has("Range") && object.range) {
    const start = object.range.offset;
    const end = start + object.range.length - 1;
    headers.set("Content-Range", `bytes ${start}-${end}/${object.size}`);
    headers.set("Content-Length", String(object.range.length));
    status = 206;
  } else {
    headers.set("Content-Length", String(object.size));
  }
  return new Response(request.method === "HEAD" ? null : object.body, { status, headers });
}

function assetUrl(request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url, {
    method: request.method,
    headers: request.headers,
    redirect: request.redirect,
  });
}

async function handleAccountApi(request, env, url) {
  if (!env.DB) return error("Accounts are not configured", 503);
  const path = url.pathname;

  if (path === "/api/account/session" && request.method === "GET") {
    const user = await sessionUser(request, env);
    return json({ authenticated: Boolean(user), user: user ? publicUser(user) : null });
  }

  if (path === "/api/account/register" && request.method === "POST") {
    if (!sameOrigin(request)) return error("Request origin could not be verified", 403);
    const address = request.headers.get("CF-Connecting-IP") || "local";
    if (await attemptCount(env.DB, "register", address, 5, 60 * 60))
      return error("Too many accounts were created from here. Try again in an hour.", 429);

    let input;
    try {
      input = await readJson(request);
    } catch (cause) {
      return error(cause.message, cause instanceof RangeError ? 413 : 400);
    }

    const email = normalizeEmail(input.email);
    const name = typeof input.name === "string" ? input.name.trim().slice(0, 80) : "";
    const password = typeof input.password === "string" ? input.password : "";
    if (!validEmail(email)) return error("Enter an email address that works", 400);
    if (password.length < PASSWORD_MIN)
      return error(`Use at least ${PASSWORD_MIN} characters for the password`, 400);
    if (password.length > PASSWORD_MAX) return error("That password is too long", 400);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await env.DB.prepare(
        "INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
        .bind(id, email, name, await hashPassword(password), now, now)
        .run();
    } catch (cause) {
      const message = String(cause?.message || "");
      if (/unique/i.test(message)) {
        return error("An account with that email already exists", 409);
      }
      console.error("account register failed", message);
      return error("The account could not be created", 500);
    }

    await recordAttempt(env.DB, "register", address);
    const token = await createUserSession(env.DB, id);
    return json({ user: { id, email, name } }, 201, { "Set-Cookie": userCookie(token) });
  }

  if (path === "/api/account/login" && request.method === "POST") {
    if (!sameOrigin(request)) return error("Request origin could not be verified", 403);
    const address = request.headers.get("CF-Connecting-IP") || "local";
    if (await attemptCount(env.DB, "login", address, 10, 15 * 60))
      return error("Too many sign in attempts. Wait fifteen minutes and try again.", 429);

    let input;
    try {
      input = await readJson(request);
    } catch (cause) {
      return error(cause.message, cause instanceof RangeError ? 413 : 400);
    }

    const email = normalizeEmail(input.email);
    const password = typeof input.password === "string" ? input.password : "";
    const user = await env.DB.prepare(
      "SELECT id, email, name, password_hash FROM users WHERE email = ?",
    )
      .bind(email)
      .first();

    let accepted = false;
    if (user?.password_hash) {
      accepted = await verifyPassword(password, user.password_hash);
    } else {
      // Spend the same work on an unknown address, so timing does not answer
      // the question "is this email registered?".
      await derivePassword(password, crypto.getRandomValues(new Uint8Array(16))).catch(() => {});
    }

    if (!accepted) {
      await recordAttempt(env.DB, "login", address);
      return error("Email or password is not correct", 401);
    }

    const token = await createUserSession(env.DB, user.id);
    return json({ user: publicUser(user) }, 200, { "Set-Cookie": userCookie(token) });
  }

  if (path === "/api/account/logout" && request.method === "POST") {
    if (!sameOrigin(request)) return error("Request origin could not be verified", 403);
    const token = cookieValue(request, USER_COOKIE);
    if (token) {
      await env.DB.prepare("DELETE FROM user_sessions WHERE token_hash = ?")
        .bind(await tokenHash(token))
        .run();
    }
    return json({ authenticated: false }, 200, { "Set-Cookie": clearUserCookie() });
  }

  if (path === "/api/account/orders" && request.method === "GET") {
    const user = await sessionUser(request, env);
    if (!user) return error("Sign in to see your orders", 401);
    const { results } = await env.DB.prepare(
      "SELECT id, amount_total, currency, offer, payment_status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100",
    )
      .bind(user.id)
      .all();
    return json({ orders: results || [] });
  }

  if (path === "/api/account/orders/reconcile" && request.method === "POST") {
    if (!sameOrigin(request)) return error("Request origin could not be verified", 403);
    const user = await sessionUser(request, env);
    if (!user) return error("Sign in to see your orders", 401);
    if (!env.STRIPE_SECRET_KEY && !env.STRIPE_CLIENT) return error("Stripe is not configured", 500);

    let input;
    try {
      input = await readJson(request);
    } catch (cause) {
      return error(cause.message, cause instanceof RangeError ? 413 : 400);
    }
    const sessionId =
      typeof input.sessionId === "string" && input.sessionId.startsWith("cs_")
        ? input.sessionId
        : "";
    if (!sessionId) return error("Missing checkout session", 400);

    let checkout;
    try {
      checkout = await stripeClient(env).checkout.sessions.retrieve(sessionId);
    } catch {
      return error("That payment could not be found", 404);
    }
    if (checkout.client_reference_id !== user.id)
      return error("That payment belongs to another account", 403);
    if (checkout.payment_status !== "paid") return error("That payment has not completed", 409);

    await recordOrder(env, checkout);
    const { results } = await env.DB.prepare(
      "SELECT id, amount_total, currency, offer, payment_status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100",
    )
      .bind(user.id)
      .all();
    return json({ orders: results || [] });
  }

  if (path === "/api/account/password" && request.method === "POST") {
    if (!sameOrigin(request)) return error("Request origin could not be verified", 403);
    const user = await sessionUser(request, env);
    if (!user) return error("Sign in to change your password", 401);

    let input;
    try {
      input = await readJson(request);
    } catch (cause) {
      return error(cause.message, cause instanceof RangeError ? 413 : 400);
    }

    const row = await env.DB.prepare("SELECT password_hash FROM users WHERE id = ?")
      .bind(user.id)
      .first();
    if (
      typeof input.currentPassword !== "string" ||
      !(await verifyPassword(input.currentPassword, row?.password_hash))
    ) {
      return error("The current password was not accepted", 401);
    }

    const next = typeof input.newPassword === "string" ? input.newPassword : "";
    if (next.length < PASSWORD_MIN)
      return error(`Use at least ${PASSWORD_MIN} characters for the new password`, 400);
    if (next.length > PASSWORD_MAX) return error("That password is too long", 400);

    await env.DB.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
      .bind(await hashPassword(next), new Date().toISOString(), user.id)
      .run();
    const token = cookieValue(request, USER_COOKIE);
    if (token) {
      await env.DB.prepare("DELETE FROM user_sessions WHERE user_id = ? AND token_hash <> ?")
        .bind(user.id, await tokenHash(token))
        .run();
    }
    return json({ changed: true });
  }

  if (path === "/api/account" && request.method === "DELETE") {
    if (!sameOrigin(request)) return error("Request origin could not be verified", 403);
    const user = await sessionUser(request, env);
    if (!user) return error("Sign in to delete your account", 401);

    let input;
    try {
      input = await readJson(request);
    } catch (cause) {
      return error(cause.message, cause instanceof RangeError ? 413 : 400);
    }
    const row = await env.DB.prepare("SELECT password_hash FROM users WHERE id = ?")
      .bind(user.id)
      .first();
    if (
      typeof input.password !== "string" ||
      !(await verifyPassword(input.password, row?.password_hash))
    ) {
      return error("The password was not accepted", 401);
    }

    await env.DB.prepare("DELETE FROM blog_comments WHERE user_id = ?").bind(user.id).run();
    // Orders stay for accounting, without the account attached.
    await env.DB.prepare("UPDATE orders SET user_id = NULL WHERE user_id = ?").bind(user.id).run();
    await env.DB.prepare("DELETE FROM user_sessions WHERE user_id = ?").bind(user.id).run();
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id).run();
    return json({ deleted: true }, 200, { "Set-Cookie": clearUserCookie() });
  }

  return error("Account route not found", 404);
}

async function handleCommentsApi(request, env, url) {
  if (!env.DB) return error("Blog database is not configured", 503);

  const onPost = url.pathname.match(/^\/api\/blog\/posts\/([^/]+)\/comments$/);
  if (onPost) {
    const slug = decodeSlug(onPost[1]);
    if (!slug) return error("Post not found", 404);
    const post = await env.DB.prepare(
      "SELECT slug FROM blog_posts WHERE slug = ? AND status = 'published'",
    )
      .bind(slug)
      .first();
    if (!post) return error("Post not found", 404);

    if (request.method === "GET") {
      const user = await sessionUser(request, env);
      const { results } = await env.DB.prepare(
        "SELECT c.id, c.user_id, c.body, c.created_at, u.name FROM blog_comments c JOIN users u ON u.id = c.user_id WHERE c.post_slug = ? ORDER BY c.created_at ASC LIMIT 200",
      )
        .bind(slug)
        .all();
      return json({
        comments: (results || []).map((row) => ({
          id: row.id,
          body: row.body,
          created_at: row.created_at,
          author: String(row.name || "").trim() || "Reader",
          mine: Boolean(user && row.user_id === user.id),
        })),
      });
    }

    if (request.method === "POST") {
      if (!sameOrigin(request)) return error("Request origin could not be verified", 403);
      const user = await sessionUser(request, env);
      if (!user) return error("Sign in to comment", 401);
      if (await attemptCount(env.DB, "comment", user.id, 5, 10 * 60))
        return error("That is a lot of comments at once. Wait ten minutes and try again.", 429);

      let input;
      try {
        input = await readJson(request);
      } catch (cause) {
        return error(cause.message, cause instanceof RangeError ? 413 : 400);
      }
      let body;
      try {
        body = boundedText(input.body, "Comment", COMMENT_MAX, true);
      } catch (cause) {
        return error(cause.message, 400);
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await env.DB.prepare(
        "INSERT INTO blog_comments (id, post_slug, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
      )
        .bind(id, slug, user.id, body, now)
        .run();
      await recordAttempt(env.DB, "comment", user.id);
      return json(
        {
          comment: {
            id,
            body,
            created_at: now,
            author: String(user.name || "").trim() || "Reader",
            mine: true,
          },
        },
        201,
      );
    }

    return error("Method not allowed", 405);
  }

  const own = url.pathname.match(/^\/api\/blog\/comments\/([0-9a-f-]{36})$/i);
  if (own) {
    if (request.method !== "DELETE") return error("Method not allowed", 405);
    if (!sameOrigin(request)) return error("Request origin could not be verified", 403);
    const user = await sessionUser(request, env);
    if (!user) return error("Sign in to delete a comment", 401);
    const result = await env.DB.prepare("DELETE FROM blog_comments WHERE id = ? AND user_id = ?")
      .bind(own[1], user.id)
      .run();
    if (!result?.meta?.changes) return error("Comment not found", 404);
    return json({ deleted: own[1] });
  }

  return error("Comment route not found", 404);
}

async function handleStripeWebhook(request, env) {
  if (!env.STRIPE_WEBHOOK_SECRET) return error("Webhook is not configured", 503);
  if (!env.STRIPE_SECRET_KEY && !env.STRIPE_CLIENT) return error("Stripe is not configured", 500);
  if (request.method !== "POST") return error("Method not allowed", 405);

  const signature = request.headers.get("Stripe-Signature");
  if (!signature) return error("Missing signature", 400);
  const payload = await request.text();

  let event;
  try {
    event = await stripeClient(env).webhooks.constructEventAsync(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return error("Invalid signature", 400);
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    await recordOrder(env, event.data?.object);
  }
  return json({ received: true });
}

async function createCheckoutSession(request, env, url) {
  if (!env.STRIPE_SECRET_KEY && !env.STRIPE_CLIENT) return error("Stripe is not configured", 500);

  let body = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return error("Invalid JSON", 400);
  }

  const price = typeof body.price === "string" ? body.price : "";
  if (!OFFER_BY_PRICE[price]) return error("That is not one of the services", 400);

  const origin = url.origin;
  const user = await sessionUser(request, env);

  const params = {
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
    metadata: { offer: OFFER_BY_PRICE[price] },
  };

  if (user) {
    params.client_reference_id = user.id;
    params.customer_email = user.email;
    params.metadata.user_id = user.id;
  }

  try {
    const session = await stripeClient(env).checkout.sessions.create(params);

    if (request.headers.get("Accept")?.includes("application/json")) {
      return json({ url: session.url });
    }
    return Response.redirect(session.url, 303);
  } catch (cause) {
    return error(cause?.message || "Checkout failed", 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/account")) return await handleAccountApi(request, env, url);
      if (url.pathname === "/api/stripe/webhook") return await handleStripeWebhook(request, env);
      if (url.pathname === "/api/create-checkout-session" && request.method === "POST") {
        return await createCheckoutSession(request, env, url);
      }
      if (url.pathname === "/api/blog/admin" || url.pathname.startsWith("/api/blog/admin/")) {
        return await handleAdminApi(request, env, url);
      }
      if (
        url.pathname.startsWith("/api/blog/comments/") ||
        /^\/api\/blog\/posts\/[^/]+\/comments$/.test(url.pathname)
      ) {
        return await handleCommentsApi(request, env, url);
      }
      if (url.pathname === "/api/blog" || url.pathname.startsWith("/api/blog/")) {
        return await handlePublicApi(request, env, url);
      }
      if (url.pathname.startsWith("/blog/media/"))
        return await serveMedia(request, env, url.pathname);

      if (request.method === "GET" || request.method === "HEAD") {
        if (url.pathname === "/blog" || url.pathname === "/blog/") {
          return env.ASSETS.fetch(assetUrl(request, "/blog-shell"));
        }
        if (url.pathname === "/blog/write" || url.pathname === "/blog/write/") {
          return env.ASSETS.fetch(assetUrl(request, "/blog-editor"));
        }
        if (url.pathname.startsWith("/blog/")) {
          return env.ASSETS.fetch(assetUrl(request, "/blog-shell"));
        }
      }

      return env.ASSETS.fetch(request);
    } catch {
      return error("The blog service could not complete that request", 500);
    }
  },
};
