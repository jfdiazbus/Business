// The school page: the coursework, described honestly, with one way to ask for
// more. Epitech keeps its repositories private, so the page describes the work
// rather than linking it — these guard that it stays that way, and that the
// copy keeps to the house rules.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(path.join(PROJECT_ROOT, "school.html"), "utf8");
const { document } = new JSDOM(html).window;

const text = (node) => node.textContent.replace(/\s+/g, " ").trim();

describe("school.html", () => {
  it("describes itself, and has one heading", () => {
    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(document.title).toContain("School work");
    expect(document.querySelector('meta[name="description"]')?.content.length).toBeGreaterThan(40);
    expect(document.querySelector('meta[property="og:title"]')).toBeTruthy();
    expect(document.querySelectorAll("h1")).toHaveLength(1);
  });

  it("leads with the two projects that matter", () => {
    const featured = [...document.querySelectorAll(".project")];

    expect(featured).toHaveLength(2);
    expect(text(featured[0].querySelector("h3"))).toBe("EpyTodo");
    expect(text(featured[1].querySelector("h3"))).toBe("Tardis");

    for (const card of featured) {
      expect(text(card.querySelector("p")).length).toBeGreaterThan(30);
      expect(card.querySelector(".detail")).toBeTruthy();
    }
  });

  it("then lists the rest, each with something human to read", () => {
    const rows = [...document.querySelectorAll("#school .leader")];

    expect(rows.length).toBeGreaterThanOrEqual(8);

    for (const row of rows) {
      expect(text(row.querySelector(".k")).length).toBeGreaterThan(2);
      expect(text(row.querySelector(".v")).length).toBeGreaterThan(20);
    }
  });

  it("is honest about the repositories being private", () => {
    expect(html).toContain("repositories private");
    expect(document.querySelector('a[href="https://github.com/jfdiazbus"]')).toBeTruthy();
  });

  it("has one way to act, one way back, and no dead links", () => {
    expect([...document.querySelectorAll('a[href^="mailto:"]')].length).toBeGreaterThan(0);
    expect(document.querySelector('.topbar nav a[href="/home"]')).toBeTruthy();
    expect(document.querySelector('.more a[href="/home"]')).toBeTruthy();

    for (const link of document.querySelectorAll("a")) {
      expect(link.getAttribute("href"), text(link)).not.toBe("#");
    }
  });

  it("keeps the copy on the house rules", () => {
    const copy = [...document.querySelectorAll("h2, h3, p")]
      .filter((node) => !node.closest("footer")) // the colophon says "hand-coded"
      .map(text)
      .join(" ")
      .toLowerCase();

    expect(copy).not.toMatch(/\w-\w/); // no hyphens inside sentences
    for (const cliche of ["elevate", "seamless", "unleash", "next gen", "game changer", "delve"]) {
      expect(copy, cliche).not.toContain(cliche);
    }
  });
});
