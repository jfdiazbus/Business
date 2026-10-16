// Guards the credentials handling: the secrets file stays out of git and out
// of the image, and an unfilled template must never look like a real token.

import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PROJECT_ROOT,
  SECRETS_FILE,
  cliArgs,
  parseSecrets,
  readSecrets,
  wranglerEntry,
} from "../scripts/deploy.mjs";

const REPO_ROOT = path.resolve(PROJECT_ROOT, "..");
const read = (file, root = PROJECT_ROOT) => readFile(path.join(root, file), "utf8");

describe("the secrets file", () => {
  it("reads plain KEY=value lines", () => {
    const text = "CLOUDFLARE_ACCOUNT_ID=abc123\nCLOUDFLARE_API_TOKEN=cfut_ab-cd_ef\n";

    expect(parseSecrets(text)).toEqual({
      CLOUDFLARE_ACCOUNT_ID: "abc123",
      CLOUDFLARE_API_TOKEN: "cfut_ab-cd_ef",
    });
  });

  it("ignores comments, blank lines and empty values", () => {
    const text = [
      "# CLOUDFLARE_API_TOKEN=this is only a comment",
      "",
      "CLOUDFLARE_API_TOKEN=",
      "CLOUDFLARE_ACCOUNT_ID=   ",
      "   ",
    ].join("\n");

    expect(parseSecrets(text)).toEqual({});
  });

  it("strips the quotes around a value and keeps the rest untouched", () => {
    expect(parseSecrets('TOKEN="a=b=c"')).toEqual({ TOKEN: "a=b=c" });
  });

  it("treats a missing file as no credentials at all", async () => {
    expect(await readSecrets(path.join(PROJECT_ROOT, "definitely-not-here"))).toEqual({});
  });

  it("points at the gitignored file beside the project", () => {
    expect(SECRETS_FILE).toBe(path.join(PROJECT_ROOT, ".secrets"));
  });

  it("treats an unfilled template as no secrets, so a blank value is not a token", () => {
    // The local .secrets file is gitignored and is meant to be filled in, so
    // this guards the template shape rather than whatever is on this machine.
    const template = "CLOUDFLARE_API_TOKEN=\nCLOUDFLARE_ACCOUNT_ID=\n# a comment\n\n";

    expect(parseSecrets(template)).toEqual({});
  });

  it("survives the file not existing at all", async () => {
    expect(await readSecrets(path.join(PROJECT_ROOT, ".secrets-absent"))).toEqual({});
  });

  it("cannot be committed", async () => {
    expect(await read(".gitignore", REPO_ROOT)).toContain(".secrets");
  });

  it("cannot end up in the docker image", async () => {
    expect(await read(".dockerignore", REPO_ROOT)).toContain(".secrets");
  });
});

describe("deploying", () => {
  it("finds the installed wrangler without relying on PATH", () => {
    expect(existsSync(wranglerEntry())).toBe(true);
    expect(path.basename(wranglerEntry())).toMatch(/wrangler/);
  });

  it("runs through the script that loads .secrets", async () => {
    const pkg = JSON.parse(await read("package.json"));

    expect(pkg.scripts.deploy).toBe("node scripts/deploy.mjs");
  });

  it("drops the -- that pnpm inserts, so flags reach wrangler", () => {
    // `pnpm run deploy -- --dry-run` arrives as ["--", "--dry-run"]; passing
    // that straight on makes wrangler treat --dry-run as a positional argument
    // and deploy for real.
    expect(cliArgs(["--", "--dry-run"])).toEqual(["--dry-run"]);
    expect(cliArgs(["--dry-run"])).toEqual(["--dry-run"]);
    expect(cliArgs([])).toEqual([]);
  });

  it("documents that pnpm needs `run` for it", async () => {
    // `pnpm deploy` is pnpm's own workspace command, so the README has to spell
    // out `pnpm run deploy` or people will silently run the wrong thing.
    const readme = await read("README.md");
    const bareCommands = [...readme.matchAll(/^\s*pnpm deploy(?=\s|$)/gm)];

    expect(readme).toContain("pnpm run deploy");
    expect(bareCommands.map((match) => match[0].trim())).toEqual([]);
  });
});
