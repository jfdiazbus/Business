import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("../blog.html", import.meta.url), "utf8");
const source = readFileSync(new URL("../blog.js", import.meta.url), "utf8");
const post = {
  slug: "freedom-to-build",
  title: "The freedom to build",
  excerpt: "A small web you can understand, change and make your own.",
  published_at: "2026-10-21T12:00:00Z",
  cover_key: "open-sky.webp",
  blocks: [
    { type: "heading", level: 2, text: "Start with ownership" },
    { type: "paragraph", text: 'Keep <script>alert("hello")</script> as text.' },
    { type: "image", key: "workshop.webp", alt: "An open workshop", caption: "Room to experiment" },
    { type: "video", key: "demo.webm", caption: "A working prototype" },
    {
      type: "columns",
      columns: [
        { heading: "Explore", text: "Try an idea." },
        { heading: "Share", text: "Let others build on it." },
      ],
    },
  ],
};

function openBlog(path, fetch) {
  const dom = new JSDOM(html, { url: `https://example.test${path}`, runScripts: "outside-only" });
  dom.window.fetch = fetch;
  dom.window.eval(source);
  return dom;
}

describe("reading a blog entry", () => {
  it("loads a published entry with safe content, media, metadata and a way back", async () => {
    const fetch = vi.fn(async (url) => ({
      ok: true,
      json: async () =>
        url.endsWith("/comments")
          ? { comments: [] }
          : url === "/api/account/session"
            ? { authenticated: false }
            : { post },
    }));
    const dom = openBlog("/blog/freedom-to-build", fetch);
    try {
      const doc = dom.window.document;
      await vi.waitFor(() => expect(doc.querySelector(".blog-article")).toBeTruthy());
      expect(fetch).toHaveBeenCalledWith("/api/blog/posts/freedom-to-build");
      expect(doc.querySelector("h1").textContent).toBe(post.title);
      expect(doc.title).toBe(`${post.title} — Juan Felipe Diaz`);
      for (const selector of ['meta[name="description"]', 'meta[property="og:description"]']) {
        expect(doc.querySelector(selector).content).toBe(post.excerpt);
      }
      expect(doc.querySelector('meta[property="og:title"]').content).toBe(doc.title);
      expect(doc.querySelector(".blog-date").textContent).toContain("2026");
      expect(doc.querySelector(".blog-paragraph").textContent).toBe(post.blocks[1].text);
      expect(doc.querySelector(".blog-article script")).toBeNull();
      expect(doc.querySelector(".blog-section-heading").textContent).toBe("Start with ownership");
      expect(doc.querySelector(".blog-cover").getAttribute("src")).toBe(
        "/blog/media/open-sky.webp",
      );
      expect(doc.querySelector(".blog-image").alt).toBe("An open workshop");
      expect(doc.querySelector(".blog-caption").textContent).toBe("Room to experiment");
      expect(doc.querySelector("video").controls).toBe(true);
      expect(doc.querySelector("video source").type).toBe("video/webm");
      expect(doc.querySelectorAll(".blog-column")).toHaveLength(2);
      expect(doc.querySelector("#blog-content .more a").getAttribute("href")).toBe("/blog");
      expect(doc.querySelector(".blog-introduction").hidden).toBe(true);
      expect(doc.querySelector("#blog-status").textContent).toBe("");
      await vi.waitFor(() => expect(doc.querySelector(".blog-comments a")).toBeTruthy());
    } finally {
      dom.window.close();
    }
  });

  it("recovers from an entry request failure when the reader retries", async () => {
    let failing = true;
    const fetch = vi.fn(async (url) => {
      if (failing) throw new Error("Offline");
      return {
        ok: true,
        json: async () =>
          url.endsWith("/comments")
            ? { comments: [] }
            : url === "/api/account/session"
              ? { authenticated: false }
              : { post },
      };
    });
    const dom = openBlog("/blog/freedom-to-build", fetch);
    try {
      const doc = dom.window.document;
      await vi.waitFor(() => expect(doc.querySelector("#blog-content button")).toBeTruthy());
      expect(doc.querySelector("#blog-status").textContent).toContain("could not load");
      failing = false;
      doc.querySelector("#blog-content button").click();
      await vi.waitFor(() => expect(doc.querySelector(".blog-article")).toBeTruthy());
      expect(doc.querySelector("#blog-content button")).toBeNull();
      await vi.waitFor(() => expect(doc.querySelector(".blog-comments a")).toBeTruthy());
    } finally {
      dom.window.close();
    }
  });
});
