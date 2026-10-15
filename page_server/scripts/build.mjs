// Builds ./dist — the static site that Docker and Cloudflare serve.
//
//   pnpm build
//
// Everything the page links to (the two client sites, the business plans)
// is copied in, so the result is a self-contained folder with no server code
// and no dependencies.

import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { errorPageHtml } from "../index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(HERE, "..");
export const DEFAULT_WORKSPACE = path.resolve(PROJECT_ROOT, "..");
export const DEFAULT_OUT = path.join(PROJECT_ROOT, "dist");

/** [source in page_server, path in dist] */
export const PAGE_FILES = [
  ["page.html", "index.html"],
  ["style.css", "style.css"],
  ["slides.js", "slides.js"],
];

/** folders copied from the workspace into dist/projects/ */
export const PROJECT_DIRS = ["promptops-ai", "omniprompt-marketing"];

/** files copied from the workspace into dist/docs/ */
export const DOC_FILES = ["ai_business_plan.md", "ai_marketing_automation_business_plan.md"];

// Cloudflare and nginx both read these; the assets rule has to come first
// because the broader /projects/* rule would otherwise swallow it.
export const HEADERS = `/projects/*/assets/*
  Cache-Control: public, max-age=31536000, immutable

/style.css
  Cache-Control: public, max-age=3600

/slides.js
  Cache-Control: public, max-age=3600

/projects/*
  Cache-Control: public, max-age=3600
`;

const skipDotFiles = (src) => !src.split(path.sep).some((segment) => segment.startsWith("."));

export async function build({ outDir = DEFAULT_OUT, workspace = DEFAULT_WORKSPACE } = {}) {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  for (const [from, to] of PAGE_FILES) {
    await cp(path.join(PROJECT_ROOT, from), path.join(outDir, to));
  }

  for (const name of PROJECT_DIRS) {
    await cp(path.join(workspace, name), path.join(outDir, "projects", name), {
      recursive: true,
      filter: skipDotFiles,
    });
  }

  for (const name of DOC_FILES) {
    await cp(path.join(workspace, name), path.join(outDir, "docs", name));
  }

  await writeFile(
    path.join(outDir, "404.html"),
    errorPageHtml({
      heading: "Sorry, this page isn't here.",
      message: "The link may be old, or the address may have a typo.",
    }),
    "utf8",
  );
  await writeFile(path.join(outDir, "_headers"), HEADERS, "utf8");

  return { outDir, brokenLinks: await checkLinks(outDir) };
}

/** Every link on the page that points inside the site. */
export function collectInternalLinks(html) {
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  return [...new Set(hrefs.filter((href) => href.startsWith("/") && !href.startsWith("//")))];
}

/** The file a site-absolute link should resolve to inside dist. */
export function resolveAsset(outDir, href) {
  const clean = href.split("#")[0].split("?")[0];
  let rel = clean.replace(/^\/+/, "");
  if (rel === "" || rel.endsWith("/")) rel += "index.html";
  return path.join(outDir, rel);
}

const exists = (target) =>
  access(target).then(
    () => true,
    () => false,
  );

/** Returns the links on a built page that point at nothing. */
export async function checkLinks(outDir, htmlFile = "index.html") {
  const html = await readFile(path.join(outDir, htmlFile), "utf8");
  const broken = [];

  for (const href of collectInternalLinks(html)) {
    const candidate = resolveAsset(outDir, href);
    const found = (await exists(candidate)) || (await exists(path.join(candidate, "index.html")));
    if (!found) broken.push(href);
  }

  return broken;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const { outDir, brokenLinks } = await build();
  console.log(`built ${path.relative(process.cwd(), outDir) || outDir}`);

  if (brokenLinks.length > 0) {
    console.error(`broken links on the page: ${brokenLinks.join(", ")}`);
    process.exitCode = 1;
  }
}
