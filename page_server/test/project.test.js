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
      ["jsdom", "prettier", "vitest", "wrangler"].sort(),
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

  it("keeps the bar script free of imports, too", async () => {
    const script = await read("bar.js");

    expect(script).not.toMatch(/^\s*import\s/m);
    expect(script).not.toContain("require(");
  });

  it("exposes the commands the pipelines call", async () => {
    const pkg = JSON.parse(await read("package.json"));

    for (const script of ["start", "dev", "dev:worker", "build", "test", "deploy"]) {
      expect(pkg.scripts[script], script).toBeTruthy();
    }
    expect(pkg.scripts.deploy).toContain("scripts/deploy.mjs");
    expect(pkg.type).toBe("module");
    expect(pkg.private).toBe(true);
  });

  it("can run the commands Cloudflare's builder uses", async () => {
    const config = await read("wrangler.toml");

    // branch builds run `wrangler preview`, and it refuses to run at all
    // without a previews block; that failure only shows up in CI, so pin it
    expect(config).toMatch(/^\[previews\]$/m);
    expect(config).toContain("[assets]");
    expect(config).toContain('directory = "./dist"');
  });

  it("can also build from the repository root, where Cloudflare may run it", async () => {
    const rootPkg = JSON.parse(await read("package.json", REPO_ROOT));
    const rootConfig = await read("wrangler.toml", REPO_ROOT);
    const projectConfig = await read("wrangler.toml");
    const value = (text, key) => new RegExp(`${key} = "([^"]+)"`).exec(text)[1];

    expect(rootPkg.scripts.build).toContain("page_server/scripts/build.mjs");
    expect(rootConfig).toContain('directory = "./page_server/dist"');
    expect(rootConfig).toMatch(/^\[previews\]$/m);

    // a build that ran from the repository root must deploy the same Worker
    expect(value(rootConfig, "name")).toBe(value(projectConfig, "name"));
    expect(value(rootConfig, "compatibility_date")).toBe(
      value(projectConfig, "compatibility_date"),
    );
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

  it("lets Cloudflare build the site, keeping CI to tests", async () => {
    const ci = await read(".github/workflows/ci.yml", REPO_ROOT);

    expect(ci).toContain("pnpm test");
    expect(ci).toContain("pnpm build");

    // Cloudflare's Git integration publishes the site, so a second, GitHub-side
    // deploy must not be racing it.
    expect(await exists(".github/workflows/deploy.yml", REPO_ROOT)).toBe(false);
    expect(await exists("wrangler.toml")).toBe(true);
    expect(await read(".node-version")).toMatch(/^\d+\s*$/);
  });

  it("writes down the settings Cloudflare builds with", async () => {
    const readme = await read("README.md");
    // the name has to match what the dashboard Worker is called, so read it
    // from the config rather than hard coding it twice
    const name = /name = "([^"]+)"/.exec(await read("wrangler.toml"))[1];

    expect(readme).toContain(name); // the Worker name
    expect(readme).toContain("page_server"); // the root directory
    expect(readme).toContain("pnpm build"); // the build command
    expect(readme).toContain("npx wrangler deploy"); // the deploy command
  });

  it("has a Dockerfile that serves the built site", async () => {
    const dockerfile = await read("Dockerfile");
    const nginx = await read("docker/nginx.conf");

    expect(dockerfile).toContain("scripts/build.mjs");
    expect(dockerfile).toMatch(/FROM nginx:/);
    expect(nginx).toContain("404.html");
  });

  it("still has the fonts and files the scripts need", async () => {
    for (const file of ["home.html", "world.html", "style.css", "index.js", "vitest.config.js"]) {
      expect(await exists(file), file).toBe(true);
    }
    for (const file of ["scripts/build.mjs", "scripts/deploy.mjs", "bar.js"]) {
      expect(await exists(file), file).toBe(true);
    }
  });
});
