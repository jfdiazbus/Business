// Every email link has to open a mail provider in the browser. A `mailto:`
// link silently does nothing on a device with no mail app configured, so the
// contact route is Gmail compose, already addressed to the right inbox.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = [
  "account.html",
  "blog.html",
  "home.html",
  "login.html",
  "register.html",
  "school.html",
  "services.html",
  "terms.html",
  "thanks.html",
  "world.html",
];

const GMAIL_COMPOSE = "https://mail.google.com/mail/?view=cm&fs=1&to=jfdiazbus%40gmail.com";

const page = (file) =>
  new JSDOM(readFileSync(path.join(PROJECT_ROOT, file), "utf8")).window.document;

describe("the contact links", () => {
  it("sends every email link to Gmail compose, addressed to the right inbox", () => {
    for (const file of PAGES) {
      const document = page(file);
      const links = [...document.querySelectorAll('a[href*="jfdiazbus%40gmail.com"]')];

      expect(links.length, file).toBeGreaterThan(0);

      for (const link of links) {
        expect(link.href, file).toBe(GMAIL_COMPOSE);
        expect(link.target, file).toBe("_blank");
        expect(link.rel, file).toBe("noopener");
      }
    }
  });

  it("never leaves the visitor waiting for a mail app that is not installed", () => {
    for (const file of PAGES) {
      expect(page(file).querySelectorAll('a[href^="mailto:"]'), file).toHaveLength(0);
    }
  });
});
