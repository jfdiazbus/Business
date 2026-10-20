import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { access, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  DOC_FILES,
  PROJECT_DIRS,
  PROJECT_ROOT,
  build,
  checkLinks,
  collectInternalLinks,
  resolveAsset,
} from "../scripts/build.mjs";

let outDir;

const read = (rel) => readFile(path.join(outDir, rel), "utf8");
const size = (rel) => stat(path.join(outDir, rel)).then((info) => info.size);
const exists = (rel) =>
  access(path.join(outDir, rel)).then(
    () => true,
    () => false,
  );

beforeAll(async () => {
  outDir = await mkdtemp(path.join(os.tmpdir(), "portfolio-build-"));
  await build({ outDir });
});

afterAll(async () => {
  await rm(outDir, { recursive: true, force: true });
});

describe("the build", () => {
  it("writes the world as the front page and the deck at /home, byte for byte", async () => {
    const world = await readFile(path.join(PROJECT_ROOT, "world.html"), "utf8");
    const deck = await readFile(path.join(PROJECT_ROOT, "home.html"), "utf8");
    const school = await readFile(path.join(PROJECT_ROOT, "school.html"), "utf8");
    const services = await readFile(path.join(PROJECT_ROOT, "services.html"), "utf8");
    const thanks = await readFile(path.join(PROJECT_ROOT, "thanks.html"), "utf8");

    expect(await read("index.html")).toBe(world);
    expect(await read("home.html")).toBe(deck);
    expect(await read("school.html")).toBe(school);
    expect(await read("services.html")).toBe(services);
    expect(await read("thanks.html")).toBe(thanks);
  });

  it("writes the stylesheet", async () => {
    expect(await size("style.css")).toBeGreaterThan(500);
  });

  it("puts the world on the front page and the portfolio at /home", async () => {
    const index = await read("index.html");
    const home = await read("home.html");

    expect(index).toContain("The print shop");
    expect(index).toContain('src="/world/engine.js"');
    expect(home).toContain("Websites, presentations and small tools");
    expect(home).toContain('id="experience"');

    // /home is a rewrite, so the page is addressable without the extension
    // pretty URLs are the host's job (Cloudflare html_handling, nginx try_files),
    // so the build ships no _redirects for them
    expect(await exists("_redirects")).toBe(false);
  });

  it("ships the bar script, and no deck", async () => {
    expect(await size("bar.js")).toBeGreaterThan(500);
    expect(await read("home.html")).toContain('src="/bar.js"');
    expect(await read("_headers")).toContain("/bar.js");
    expect(await exists("slides.js")).toBe(false);
  });

  it("ships the scroll world, its film and its engine", async () => {
    const files = await readdir(path.join(outDir, "world"));

    expect(files).toContain("engine.js");
    expect(files.filter((name) => name.startsWith("dive-"))).toHaveLength(5);
    expect(files.filter((name) => name.startsWith("wipe-"))).toHaveLength(4);
    expect(files.filter((name) => name.startsWith("still-")).length).toBeGreaterThanOrEqual(5);
    // the paper edge is a build intermediate, not a shipped asset
    expect(files).not.toContain("sheet-edge.png");

    const headers = await read("_headers");
    expect(headers).toContain("/world/*.mp4");
    expect(headers).toContain("/world/engine.js");
  });

  it("keeps every shipped file inside Cloudflare's per asset limit", async () => {
    const limit = 25 * 1024 * 1024;
    const walk = async (dir) => {
      const entries = await readdir(dir, { withFileTypes: true });
      const files = await Promise.all(
        entries.map((entry) =>
          entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
        ),
      );
      return files.flat();
    };

    for (const file of await walk(outDir)) {
      const { size } = await stat(file);
      expect(size, path.relative(outDir, file)).toBeLessThan(limit);
    }
  });

  it("includes both client sites, website and presentation", async () => {
    for (const project of PROJECT_DIRS) {
      expect(await size(path.join("projects", project, "index.html")), project).toBeGreaterThan(
        500,
      );
      expect(await size(path.join("projects", project, "pitch.html")), project).toBeGreaterThan(
        500,
      );
      expect(
        await size(path.join("projects", project, "assets", "css", "site.css")),
        project,
      ).toBeGreaterThan(100);
    }
  });

  it("includes the business plans", async () => {
    for (const doc of DOC_FILES) {
      expect(await size(path.join("docs", doc)), doc).toBeGreaterThan(100);
    }
  });

  it("leaves out tooling and hidden files", async () => {
    const entries = await readdir(outDir);

    expect(entries).not.toContain("node_modules");
    expect(entries.filter((name) => name.startsWith("."))).toEqual([]);
    expect(entries.sort()).toEqual([
      "404.html",
      "_headers",
      "account.html",
      "account.js",
      "bar.js",
      "blog-editor.html",
      "blog-shell.html",
      "blog-write.js",
      "blog.js",
      "docs",
      "home.html",
      "index.html",
      "login.html",
      "projects",
      "register.html",
      "school.html",
      "services.html",
      "style.css",
      "terms.html",
      "thanks.html",
      "world",
      "world.js",
    ]);
  });

  it("ships a 404 page in the same style", async () => {
    const page = await read("404.html");

    expect(page).toContain("<!doctype html>");
    expect(page).toContain("isn&#39;t here");
    expect(page).toContain("[ back to the portfolio ]");
  });

  it("tells the host how to cache things", async () => {
    const headers = await read("_headers");

    expect(headers).toContain("/projects/*/assets/*");
    expect(headers).toMatch(/immutable/);
  });

  it("has no links pointing at nothing", async () => {
    expect(await checkLinks(outDir)).toEqual([]);
  });

  it("does not leak local file paths into the site", async () => {
    for (const file of ["index.html", "404.html", "style.css"]) {
      expect(await read(file)).not.toContain(PROJECT_ROOT);
      expect(await read(file)).not.toContain("/home/");
    }
  });

  it("is repeatable", async () => {
    const first = await read("index.html");
    await build({ outDir });

    expect(await read("index.html")).toBe(first);
    expect(await checkLinks(outDir)).toEqual([]);
  });
});

describe("the link checker", () => {
  it("reads the internal links out of a page", () => {
    const html = `<a href="/a">a</a><a href="/b/">b</a><a href="#top">c</a><a href="mailto:x@y.z">d</a>`;

    expect(collectInternalLinks(html)).toEqual(["/a", "/b/"]);
  });

  it("resolves folders to their index page", () => {
    expect(resolveAsset("/site", "/")).toBe(path.join("/site", "index.html"));
    expect(resolveAsset("/site", "/projects/x/")).toBe(path.join("/site", "projects/x/index.html"));
    expect(resolveAsset("/site", "/style.css?v=2")).toBe(path.join("/site", "style.css"));
  });

  it("catches a link that goes nowhere", async () => {
    const scratch = await mkdtemp(path.join(os.tmpdir(), "portfolio-broken-"));

    try {
      await writeFile(
        path.join(scratch, "index.html"),
        `<a href="/missing.html">missing</a><a href="/">home</a>`,
        "utf8",
      );

      expect(await checkLinks(scratch)).toEqual(["/missing.html"]);
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  });
});
