// The portfolio is static assets with a small blog API beside them.
//
// D1 stores post records, R2 stores the media bytes. Blog content is a validated
// list of blocks, never HTML; the browser renders every text value with
// textContent. The admin API is password protected with a short lived signed
// cookie, and every write checks its Origin.

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

function getCookie(request) {
  const cookies = request.headers.get("Cookie") || "";
  const entry = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`));
  return entry ? entry.slice(COOKIE.length + 1) : "";
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
  let blocks = [];
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
      "SELECT created_at, published_at FROM blog_posts WHERE id = ?",
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/blog/admin" || url.pathname.startsWith("/api/blog/admin/")) {
        return await handleAdminApi(request, env, url);
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
