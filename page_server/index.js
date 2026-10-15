// page_server — a zero-dependency static server for the ASCII portfolio.
//
// Serves this folder at /, plus two sibling projects and the business plans
// so every link on the page resolves without a build step.

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
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

// Longest prefix wins, so "/projects/..." is matched before "/".
const MOUNTS = [
  { prefix: "/projects/promptops-ai", root: path.resolve(HERE, "..", "promptops-ai") },
  { prefix: "/projects/omniprompt-marketing", root: path.resolve(HERE, "..", "omniprompt-marketing") },
  { prefix: "/docs/ai_business_plan.md", file: path.resolve(HERE, "..", "ai_business_plan.md") },
  { prefix: "/docs/ai_marketing_automation_business_plan.md", file: path.resolve(HERE, "..", "ai_marketing_automation_business_plan.md") },
  { prefix: "/", root: HERE },
].sort((a, b) => b.prefix.length - a.prefix.length);

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function respond(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8", ...headers });
  res.end(body);
}

function errorPage(res, status, title, detail) {
  const body = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${status} ${escapeHtml(title)}</title>
<style>body{font:15px/1.6 ui-monospace,Menlo,Consolas,monospace;background:#f0eee6;color:#1b1b18;margin:15vh auto;max-width:60ch;padding:0 20px}
b{color:#b03024}a{color:#b03024}</style></head>
<body><p><b>$ cat ${escapeHtml(detail)}</b></p>
<p>${status} ${escapeHtml(title)}</p>
<p><a href="/">[ back to the portfolio ]</a></p></body></html>`;
  respond(res, status, body);
}

function locate(urlPath) {
  for (const mount of MOUNTS) {
    if (!urlPath.startsWith(mount.prefix)) continue;

    if (mount.file) {
      if (urlPath === mount.prefix) return { file: mount.file };
      continue;
    }

    const rest = urlPath.slice(mount.prefix.length);
    if (rest === "" && mount.prefix !== "/") return { redirect: mount.prefix + "/" };

    let rel;
    try {
      rel = decodeURIComponent(rest);
    } catch {
      return { status: 400, title: "bad request", detail: rest };
    }

    const target = path.resolve(mount.root, rel.replace(/^\/+/, ""));
    if (target !== mount.root && !target.startsWith(mount.root + path.sep)) {
      return { status: 403, title: "forbidden", detail: rel };
    }
    return { file: target, root: mount.root };
  }
  return null;
}

async function serveFile(res, file, method) {
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const info = await stat(file);

  res.writeHead(200, {
    "content-type": type,
    "content-length": info.size,
    "cache-control": "no-cache",
  });
  if (method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
}

const server = createServer(async (req, res) => {
  const method = req.method ?? "GET";
  if (method !== "GET" && method !== "HEAD") {
    respond(res, 405, "<p>405 method not allowed</p>", { allow: "GET, HEAD" });
    return;
  }

  let urlPath;
  try {
    urlPath = new URL(req.url, "http://localhost").pathname;
  } catch {
    errorPage(res, 400, "bad request", req.url ?? "/");
    return;
  }

  try {
    const found = locate(urlPath);

    if (!found) {
      errorPage(res, 404, "No such file or directory", urlPath);
      return;
    }
    if (found.status) {
      errorPage(res, found.status, found.title, found.detail);
      return;
    }
    if (found.redirect) {
      res.writeHead(301, { location: found.redirect });
      res.end();
      return;
    }

    let target = found.file;
    let info;
    try {
      info = await stat(target);
    } catch {
      errorPage(res, 404, "No such file or directory", urlPath);
      return;
    }

    if (info.isDirectory()) {
      if (!urlPath.endsWith("/")) {
        res.writeHead(301, { location: urlPath + "/" });
        res.end();
        return;
      }
      // This project ships its page as page.html; siblings use index.html.
      const candidates = [path.join(target, "index.html"), path.join(target, "page.html")];
      const hit = await Promise.all(candidates.map((f) => stat(f).then(() => f).catch(() => null)));
      const index = hit.find(Boolean);
      if (!index) {
        errorPage(res, 404, "No such file or directory", urlPath);
        return;
      }
      target = index;
    }

    await serveFile(res, target, method);
    console.log(`${method} ${urlPath} 200`);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) errorPage(res, 500, "server error", urlPath);
    else res.end();
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`port ${PORT} is already in use — run with PORT=3001 npm start`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log("lpt1 ready — page_server");
  console.log(`  http://localhost:${PORT}`);
  console.log("  /                           this portfolio");
  console.log("  /projects/promptops-ai      ../promptops-ai");
  console.log("  /projects/omniprompt-marketing");
  console.log("  /docs/*.md                  business plans");
});
