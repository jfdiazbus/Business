// The terms page: what a buyer has to be able to find before they pay.
//
// The site makes promises on /services. This page is where those promises, the
// prices, the delivery times, the refund rule and the consumer's right to cancel
// are written down in one place, so the checks here are about content rather
// than layout.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(PROJECT_ROOT, file), "utf8");
const terms = new JSDOM(read("terms.html")).window.document;

const text = (node) => node.textContent.replace(/\s+/g, " ").trim();

describe("the terms page", () => {
  it("names the seller, and keeps one way to reach them", () => {
    const body = text(terms.body).toLowerCase();

    expect(body).toContain("juan felipe diaz bustamante");
    expect(body).toContain("france");
    expect(terms.querySelector('a[href^="mailto:"]')).toBeTruthy();
    expect(terms.querySelectorAll("h1")).toHaveLength(1);
    expect(text(terms.querySelector("h1"))).toBe("Terms and privacy");
  });

  it("answers what a buyer needs to know before paying", () => {
    const body = text(terms.body).toLowerCase();

    for (const clause of [
      /euro/,
      /stripe/,
      /invoice/,
      /working days/,
      /refund/,
      /14 days/,
      /cancel/,
      /who owns what/,
      /last updated/,
    ]) {
      expect(body, String(clause)).toMatch(clause);
    }
  });

  it("says what happens to the buyer's data, and names the limits", () => {
    const body = text(terms.body).toLowerCase();

    for (const clause of [/your data/, /deleted/, /do not sell/, /accounting records/]) {
      expect(body, String(clause)).toMatch(clause);
    }
  });

  it("describes itself and its head for a shared link", () => {
    expect(terms.documentElement.getAttribute("lang")).toBe("en");
    expect(terms.title).toContain("Terms");
    expect(terms.querySelector('meta[name="description"]')?.content.length).toBeGreaterThan(40);
    expect(terms.querySelector('meta[name="color-scheme"]')?.content).toBe("dark");
    expect(terms.querySelector('meta[property="og:title"]')).toBeTruthy();
  });

  it("keeps the page navigable, with every anchor landing somewhere", () => {
    const ids = [...terms.querySelectorAll("[id]")].map((element) => element.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(terms.querySelector(".skip")?.getAttribute("href")).toBe("#terms");
    expect(terms.querySelector(".topbar__menu")).toBeTruthy();

    for (const link of terms.querySelectorAll("a[href]")) {
      const href = link.getAttribute("href");

      expect(text(link).length, "a link with no words cannot be read out").toBeGreaterThan(0);
      expect(href, text(link)).not.toBe("#");
      if (href.startsWith("#")) expect(terms.getElementById(href.slice(1)), href).toBeTruthy();
    }
  });

  it("loads the bar script alone, so the page reads without it", () => {
    const scripts = [...terms.querySelectorAll("script[src]")].map((s) => s.getAttribute("src"));

    expect(scripts).toEqual(["/bar.js"]);
  });

  it("keeps the copy on the house rules", () => {
    const copy = [...terms.querySelectorAll("h2, p")]
      .filter((node) => !node.closest("footer"))
      .map(text)
      .join(" ")
      // an email address is not a sentence, and juan-felipe is a real hyphen in one
      .replace(/[\w.-]+@[\w.-]+/g, "")
      .toLowerCase();

    expect(copy).not.toMatch(/\w-\w/); // no hyphens inside sentences
    for (const cliche of ["elevate", "seamless", "unleash", "next gen", "game changer", "delve"]) {
      expect(copy, cliche).not.toContain(cliche);
    }
  });

  it("is reachable from every page that carries a footer", () => {
    for (const page of ["home.html", "school.html", "services.html", "thanks.html"]) {
      expect(read(page), page).toContain('href="/terms"');
    }

    // and the server routes the pretty URL to it
    expect(read("index.js")).toContain('"/terms": "terms.html"');
  });
});
