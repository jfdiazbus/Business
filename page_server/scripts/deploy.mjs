// Ships the site to Cloudflare.
//
//   pnpm run deploy                build dist/, then upload it
//   pnpm run deploy -- --dry-run   build, then report what would upload
//
// Credentials come from .secrets when it has values in it. Leave it empty and
// wrangler falls back to the session from `pnpm exec wrangler login`.

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "./build.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(HERE, "..");
export const SECRETS_FILE = path.join(PROJECT_ROOT, ".secrets");

/** KEY=value lines, ignoring comments, blank lines and empty values. */
export function parseSecrets(text) {
  const values = {};

  for (const line of text.split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;

    const value = match[2].replace(/^(["'])(.*)\1$/, "$2");
    if (value !== "") values[match[1]] = value;
  }

  return values;
}

export async function readSecrets(file = SECRETS_FILE) {
  return parseSecrets(await readFile(file, "utf8").catch(() => ""));
}

/** Where the installed wrangler starts, whichever package manager put it there. */
export function wranglerEntry() {
  const require = createRequire(import.meta.url);
  const manifestPath = require.resolve("wrangler/package.json");
  const manifest = require("wrangler/package.json");
  const entry = typeof manifest.bin === "string" ? manifest.bin : manifest.bin.wrangler;

  return path.join(path.dirname(manifestPath), entry);
}

/** Arguments after the script name, minus the `--` pnpm inserts. */
export function cliArgs(argv = process.argv.slice(2)) {
  return argv.filter((arg) => arg !== "--");
}

/**
 * Only the Cloudflare variables reach wrangler. `.secrets` also holds the
 * Stripe key the stripe suite reads, and a child process that only uploads
 * files has no business being handed it.
 */
export function wranglerEnv(secrets, env = process.env) {
  const cloudflare = Object.fromEntries(
    Object.entries(secrets).filter(([name]) => name.startsWith("CLOUDFLARE_")),
  );

  return { ...env, ...cloudflare };
}

/** Hands the built folder to wrangler, inheriting our terminal and logs. */
export function upload({ args = [], env = process.env } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [wranglerEntry(), "deploy", ...args], {
      cwd: PROJECT_ROOT,
      env,
      stdio: "inherit",
    });

    child.on("close", (code) => resolve(code ?? 1));
  });
}

export async function deploy({ args = cliArgs() } = {}) {
  const secrets = await readSecrets();
  const usingToken = Boolean(secrets.CLOUDFLARE_API_TOKEN);

  console.log(
    usingToken
      ? "authenticating with the token in .secrets"
      : "no token in .secrets — using your wrangler login session",
  );

  const { outDir, brokenLinks } = await build();

  if (brokenLinks.length > 0) {
    console.error(`not deploying: the page links to ${brokenLinks.join(", ")}`);
    return 1;
  }

  console.log(`built ${path.relative(PROJECT_ROOT, outDir) || "."}`);

  return upload({ args, env: wranglerEnv(secrets) });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  process.exitCode = await deploy();
}
