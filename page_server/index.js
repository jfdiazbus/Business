// page_server — a zero-dependency static server for the portfolio.
//
// Serves this folder at /, plus the two client sites and the business plans
// that live next to it, so every link on the page resolves without a build.
// This is the local development server; production is a static build
// (see scripts/build.mjs) served by Docker or Cloudflare.

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import Stripe from "stripe";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const WORKSPACE = path.resolve(HERE, "..");
export const DEFAULT_PORT = Number(process.env.PORT) || 3000;
export const INDEX_FILES = ["index.html", "home.html"];

// The built site serves the scroll world at / and the deck at /home; in the
// source they are world.html and home.html, so the dev server maps both.
export const REWRITES = {
  "/": "world.html",
  "/home": "home.html",
  "/school": "school.html",
  "/services": "services.html",
  "/thanks": "thanks.html",
  "/terms": "terms.html",
  "/blog": "blog.html",
  "/blog/write": "blog-write.html",
};

export const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
};

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

// The same paper-and-monospace look as the portfolio, so an error still
// feels like part of the site.
export function errorPageHtml({ heading, message, detail = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(heading)}</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #cdc9ba; color: #1b1b18;
         font: 16px/1.65 ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace; }
  .card { max-width: 52ch; margin: 24px; padding: 26px 28px; background: #f0eee6; border: 1px solid rgba(27, 27, 24, 0.3); }
  h1 { margin: 0 0 12px; font-size: 19px; }
  p { margin: 0 0 12px; }
  p:last-child { margin-bottom: 0; }
  .detail { color: #5f5c52; font-size: 14px; overflow-wrap: anywhere; }
  a { color: #b03024; }
</style>
</head>
<body>
<div class="card">
<h1>${escapeHtml(heading)}</h1>
<p>${escapeHtml(message)}</p>
${detail ? `<p class="detail">I looked for ${escapeHtml(detail)}</p>\n` : ""}<p><a href="/">[ back to the portfolio ]</a></p>
</div>
</body>
</html>
`;
}

// Longest prefix wins, so "/projects/..." is matched before "/".
export function buildMounts({ root = HERE, workspace = WORKSPACE } = {}) {
  return [
    { prefix: "/projects/promptops-ai", root: path.join(workspace, "promptops-ai") },
    {
      prefix: "/projects/omniprompt-marketing",
      root: path.join(workspace, "omniprompt-marketing"),
    },
    { prefix: "/docs/ai_business_plan.md", file: path.join(workspace, "ai_business_plan.md") },
    {
      prefix: "/docs/ai_marketing_automation_business_plan.md",
      file: path.join(workspace, "ai_marketing_automation_business_plan.md"),
    },
    // The scroll world: the built site keeps the film and the engine in one
    // folder (dist/world), but in the source they live apart — so the engine
    // gets its own exact mount and the prefix below serves the generated film.
    { prefix: "/world/engine.js", file: path.join(root, "world", "engine.js") },
    { prefix: "/world/", root: path.join(root, "world", "out") },
    { prefix: "/", root },
  ].sort((a, b) => b.prefix.length - a.prefix.length);
}

// Turns a URL path into a file inside one of the mounts, or a redirect/error.
export function locate(urlPath, { mounts = buildMounts() } = {}) {
  for (const mount of mounts) {
    if (!urlPath.startsWith(mount.prefix)) continue;

    if (mount.file) {
      if (urlPath === mount.prefix) return { file: mount.file };
      continue;
    }

    const rest = urlPath.slice(mount.prefix.length);
    if (rest === "" && mount.prefix !== "/") return { redirect: `${mount.prefix}/` };

    let rel;
    try {
      rel = decodeURIComponent(rest);
    } catch {
      return { error: 400 };
    }

    const target = path.resolve(mount.root, rel.replace(/^\/+/, ""));
    // Refuse anything that climbs out of the folder it is mounted from.
    if (target !== mount.root && !target.startsWith(mount.root + path.sep)) return { error: 403 };
    return { file: target };
  }
  return null;
}

function sendPage(res, status, html, extraHeaders = {}) {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8", ...extraHeaders });
  res.end(html);
}

function sendError(res, status, { heading, message, detail, headers = {} }) {
  sendPage(res, status, errorPageHtml({ heading, message, detail }), headers);
}

async function serveFile(res, file, method) {
  const info = await stat(file);
  res.writeHead(200, {
    "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
    "content-length": info.size,
    "cache-control": "no-cache",
  });

  if (method === "HEAD") {
    res.end();
    return;
  }

  const stream = createReadStream(file);
  stream.on("error", () => res.destroy());
  stream.pipe(res);
}

async function firstExisting(candidates) {
  for (const candidate of candidates) {
    const found = await stat(candidate).then(
      (info) => (info.isFile() ? candidate : null),
      () => null,
    );
    if (found) return found;
  }
  return null;
}

export function createAppServer({
  mounts = buildMounts(),
  indexFiles = INDEX_FILES,
  rewrites = REWRITES,
} = {}) {
  return createServer(async (req, res) => {
    const method = req.method ?? "GET";
    const apiUrl = new URL(req.url ?? "/", "http://localhost");

    if (apiUrl.pathname === "/api/create-checkout-session" && method === "POST") {
      const secret = process.env.STRIPE_SECRET_KEY;
      if (!secret) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Stripe is not configured" }));
        return;
      }
      let body = {};
      try {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const text = Buffer.concat(chunks).toString();
        if (text) body = JSON.parse(text);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }
      const stripe = new Stripe(secret);
      const price =
        typeof body.price === "string" && body.price.startsWith("price_")
          ? body.price
          : "price_...";
      const origin = `http://${req.headers.host || "localhost:" + (process.env.PORT || 3000)}`;
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
        const accept = req.headers.accept || "";
        if (accept.includes("application/json")) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ url: session.url }));
        } else {
          res.writeHead(303, { Location: session.url });
          res.end();
        }
      } catch (cause) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: cause?.message || "Checkout failed" }));
      }
      return;
    }

    if (method !== "GET" && method !== "HEAD") {
      sendError(res, 405, {
        heading: "That request isn't supported",
        message: "This little server only answers GET and HEAD requests.",
        headers: { allow: "GET, HEAD" },
      });
      return;
    }

    const requested = new URL(req.url ?? "/", "http://localhost").pathname;
    const blogPost =
      requested.startsWith("/blog/") &&
      requested !== "/blog/write" &&
      !requested.startsWith("/blog/media/");
    const urlPath = rewrites[requested]
      ? `/${rewrites[requested]}`
      : blogPost
        ? "/blog.html"
        : requested;

    try {
      const found = locate(urlPath, { mounts });

      if (!found) {
        sendError(res, 404, {
          heading: "Sorry, this page isn't here.",
          message: "The link may be old, or the address may have a typo.",
          detail: urlPath,
        });
        return;
      }

      if (found.error === 400) {
        sendError(res, 400, {
          heading: "That address doesn't look right.",
          message: "Some characters in the link couldn't be read.",
        });
        return;
      }

      if (found.error === 403) {
        sendError(res, 403, {
          heading: "That page is off limits.",
          message: "This server only shares the portfolio and the projects linked from it.",
          detail: urlPath,
        });
        return;
      }

      if (found.redirect) {
        res.writeHead(301, { location: found.redirect });
        res.end();
        return;
      }

      let target = found.file;
      let info = await stat(target).catch(() => null);

      // A path with no extension finds its .html, the way Cloudflare and nginx
      // do it, so /projects/x/pitch works locally as well as deployed.
      if (!info && path.extname(target) === "") {
        const withExtension = `${target}.html`;
        const found = await stat(withExtension).catch(() => null);
        if (found?.isFile()) {
          target = withExtension;
          info = found;
        }
      }

      if (!info) {
        sendError(res, 404, {
          heading: "Sorry, this page isn't here.",
          message: "The link may be old, or the address may have a typo.",
          detail: urlPath,
        });
        return;
      }

      if (info.isDirectory()) {
        if (!urlPath.endsWith("/")) {
          res.writeHead(301, { location: `${urlPath}/` });
          res.end();
          return;
        }
        // The built site serves the world as index.html and the deck as home.html;
        const index = await firstExisting(indexFiles.map((name) => path.join(target, name)));
        if (!index) {
          sendError(res, 404, {
            heading: "Sorry, this page isn't here.",
            message: "There is no page inside that folder.",
            detail: urlPath,
          });
          return;
        }
        target = index;
      }

      await serveFile(res, target, method);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) {
        sendError(res, 500, {
          heading: "Something went wrong on my side.",
          message: "Please try again in a moment.",
        });
      } else {
        res.end();
      }
    }
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const server = createAppServer();

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`port ${DEFAULT_PORT} is already in use — try PORT=3001 pnpm start`);
      process.exit(1);
    }
    throw error;
  });

  server.listen(DEFAULT_PORT, () => {
    console.log(`portfolio ready — http://localhost:${DEFAULT_PORT}`);
    console.log("  /                             the page");
    console.log("  /projects/promptops-ai        ../promptops-ai");
    console.log("  /projects/omniprompt-marketing");
    console.log("  /docs/*.md                    the business plans");
  });
}
