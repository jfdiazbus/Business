// Draws the ASCII banner at the top of home.html (the deck).
//
//   pnpm banner          rewrite home.html with a fresh banner
//
// The same function is used by the tests, so the art on the page can never
// drift away from a real figlet rendering of the title.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import figlet from "figlet";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(HERE, "..");
export const PAGE_FILE = path.join(PROJECT_ROOT, "home.html");
export const BANNER_TEXT = "HELLO";
export const BANNER_FONT = "Big";

/** The banner as an array of lines, trailing whitespace removed. */
export function renderBanner(text = BANNER_TEXT, font = BANNER_FONT) {
  const lines = figlet
    .textSync(text, { font })
    .replace(/[ \t]+$/gm, "")
    .split("\n");
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** The banner as the HTML that lives inside the page's <pre class="banner">. */
export function bannerMarkup(lines = renderBanner()) {
  return lines
    .map((line, index) => `<span class="line" style="--i:${index}">${line}</span>`)
    .join("");
}

/** Replaces the banner block in a page, leaving the rest untouched. */
export function replaceBanner(html, lines = renderBanner()) {
  const block = /(<pre class="banner"[^>]*>)[\s\S]*?(<\/pre>)/;
  if (!block.test(html)) throw new Error('no <pre class="banner"> block found in home.html');
  return html.replace(block, (_match, open, close) => open + bannerMarkup(lines) + close);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const html = await readFile(PAGE_FILE, "utf8");
  const lines = renderBanner();
  await writeFile(PAGE_FILE, replaceBanner(html, lines), "utf8");
  console.log(`banner updated: "${BANNER_TEXT}" in the ${BANNER_FONT} font, ${lines.length} lines`);
}
