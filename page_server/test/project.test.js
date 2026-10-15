// Guards the promises this project makes about itself: no runtime
// dependencies, a build and a deploy that exist, and a repo that keeps
// node_modules out of it.

import { describe, expect, it } from "vitest";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(PROJECT_ROOT, "..");

const read = (rel, root = PROJECT_ROOT) => readFile(path.join(root, rel), "utf8");
const exists = (rel, root = PROJECT_ROOT) =>
  stat(path.join(root, rel)).then(
    () => true,
    () => false,
  );

describe("the project", () => {
  it("runs with no runtime dependencies", async () => {
    const pkg = JSON.parse(await read("package.json"));

    expect(pkg.dependencies ?? {}).toEqual({});
    expect(Object.keys(pkg.devDependencies).sort()).toEqual(
      ["figlet", "jsdom", "prettier", "vitest", "wrangler"].sort(),
    );
  });

  it("imports nothing but Node's own modules in the server", async () => {
    const source = await read("index.js");
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);

    expect(imports.length).toBeGreaterThan(0);
    for (const specifier of imports) {
      expect(specifier, specifier).toMatch(/^node:/);
    }
  });

  it("exposes the commands the pipelines call", async () => {
    const pkg = JSON.parse(await read("package.json"));

    for (const script of ["start", "dev", "build", "test", "deploy", "banner"]) {
      expect(pkg.scripts[script], script).toBeTruthy();
    }
    expect(pkg.scripts.deploy).toContain("wrangler deploy");
    expect(pkg.type).toBe("module");
    expect(pkg.private).toBe(true);
  });

  it("deploys the folder the build produces", async () => {
    const config = await read("wrangler.toml");

    expect(config).toContain("[assets]");
    expect(config).toContain('directory = "./dist"');
    expect(config).toMatch(/name = "[\w-]+"/);
  });

  it("keeps node_modules and build output out of git", async () => {
    const ignore = await read(".gitignore", REPO_ROOT);

    expect(ignore).toContain("node_modules");
    expect(ignore).toContain("dist");
  });

  it("has a CI workflow that tests, and a deploy workflow that ships", async () => {
    const ci = await read(".github/workflows/ci.yml", REPO_ROOT);
    const deploy = await read(".github/workflows/deploy.yml", REPO_ROOT);

    expect(ci).toContain("pnpm test");
    expect(ci).toContain("pnpm build");
    expect(deploy).toContain("pnpm test");
    expect(deploy).toContain("npx wrangler deploy");
    expect(deploy).toContain("secrets.CLOUDFLARE_API_TOKEN");
  });

  it("has a Dockerfile that serves the built site", async () => {
    const dockerfile = await read("Dockerfile");
    const nginx = await read("docker/nginx.conf");

    expect(dockerfile).toContain("scripts/build.mjs");
    expect(dockerfile).toMatch(/FROM nginx:/);
    expect(nginx).toContain("404.html");
  });

  it("still has the fonts and files the scripts need", async () => {
    for (const file of ["page.html", "style.css", "index.js", "vitest.config.js"]) {
      expect(await exists(file), file).toBe(true);
    }
    for (const file of ["scripts/build.mjs", "scripts/banner.mjs"]) {
      expect(await exists(file), file).toBe(true);
    }
  });
});
