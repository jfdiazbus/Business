// The blog's public page, the writing desk, and the safe block format they share.

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(PROJECT_ROOT, file), "utf8");
const page = new JSDOM(read("blog.html")).window.document;
const writer = new JSDOM(read("blog-write.html")).window.document;
const text = (node) => node.textContent.replace(/\s+/g, " ").trim();

describe("the public blog", () => {
  it("has a title, description and a place for posts", () => {
    expect(page.title).toContain("Blog");
    expect(page.querySelector('meta[name="description"]')?.content.length).toBeGreaterThan(30);
    expect(page.querySelectorAll("h1")).toHaveLength(1);
    expect(page.querySelector("main#blog-main")).toBeTruthy();
    expect(page.querySelector("#blog-content")).toBeTruthy();
    expect(page.querySelector("#blog-status[aria-live='polite']")).toBeTruthy();
  });

  it("lets readers find the blog from the site navigation", () => {
    for (const file of ["home.html", "school.html", "services.html", "thanks.html", "terms.html"]) {
      const doc = new JSDOM(read(file)).window.document;
      expect(doc.querySelector('.topbar nav a[href="/blog"]'), file).toBeTruthy();
    }
    expect(page.querySelector('.topbar nav a[href="/blog"][aria-current="page"]')).toBeTruthy();
  });

  it("uses the bar enhancement and no extra framework", () => {
    expect(
      [...page.querySelectorAll("script[src]")].map((script) => script.getAttribute("src")),
    ).toEqual(["/bar.js", "/blog.js"]);
    expect(page.querySelectorAll("script:not([src])")).toHaveLength(0);
  });

  it("renders post content with DOM text, not injected HTML", () => {
    const source = read("blog.js");
    expect(source).toContain("textContent");
    expect(source).not.toContain("innerHTML");
    expect(source).toContain('element("video", "blog-video")');
    expect(source).toContain("blog-columns");
  });

  it("links back to the portfolio and to the terms", () => {
    expect(page.querySelector('footer a[href="/terms"]')).toBeTruthy();
    expect(page.querySelector('.topbar nav a[href="/home"]')).toBeTruthy();
  });
});

describe("the private writing desk", () => {
  it("stays out of search and starts with a sign in", () => {
    expect(writer.querySelector('meta[name="robots"]')?.content).toContain("noindex");
    expect(text(writer.querySelector("h1"))).toBe("Write a post");
    expect(
      writer.querySelector('input[type="password"][autocomplete="current-password"]'),
    ).toBeTruthy();
    expect(writer.querySelector("#blog-config-note")).toBeTruthy();
  });

  it("offers article, project and photo story templates", () => {
    const templates = [...writer.querySelectorAll("#post-template option")].map(
      (option) => option.value,
    );
    expect(templates).toEqual(["article", "project", "photo-story"]);
  });

  it("offers text, headings, images, video and a two column section", () => {
    const kinds = [...writer.querySelectorAll("#new-block-type option")].map(
      (option) => option.value,
    );
    expect(kinds).toEqual(["paragraph", "heading", "image", "video", "columns"]);

    const source = read("blog-write.js");
    expect(source).toContain('heading: "The challenge"');
    expect(source).toContain('heading: "The approach"');
    expect(source).toContain("Add a third column");
    expect(source).toContain("image/jpeg,image/png,image/webp,image/gif");
    expect(source).toContain("video/mp4,video/webm");
  });

  it("has labelled save and publish actions, and a way back", () => {
    expect(writer.querySelector("#save-draft")).toBeTruthy();
    expect(writer.querySelector("#publish-post")).toBeTruthy();
    expect(writer.querySelector('a[href="/blog"]')).toBeTruthy();
    expect(writer.querySelector("#writer-status[aria-live='polite']")).toBeTruthy();
  });

  it("loads only the bar and the editor", () => {
    expect(
      [...writer.querySelectorAll("script[src]")].map((script) => script.getAttribute("src")),
    ).toEqual(["/bar.js", "/blog-write.js"]);
  });
});

describe("the built blog routes", () => {
  it("adds the pages and their scripts to the static assets build", () => {
    const build = read("scripts/build.mjs");
    for (const file of ["blog-shell.html", "blog-editor.html", "blog.js", "blog-write.js"]) {
      expect(build).toContain(`"${file}"`);
    }
    expect(read("index.js")).toContain('"/blog": "blog.html"');
    expect(read("index.js")).toContain('"/blog/write": "blog-write.html"');
    expect(existsSync(path.join(PROJECT_ROOT, "migrations/0001_blog.sql"))).toBe(true);
  });
});
