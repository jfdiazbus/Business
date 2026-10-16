// The prices page, and the page Stripe sends buyers to.
//
// These are the checks that catch a page that renders but should not ship: a
// header level skipped, an id used twice, a link to a route this site does not
// serve, a buy button turned back into an email, a receipt page that would let
// someone pay twice. The Stripe side of the same page is in stripe.test.js.

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(PROJECT_ROOT, file), "utf8");

const services = new JSDOM(read("services.html")).window.document;
const thanks = new JSDOM(read("thanks.html")).window.document;

/** Every page this site serves, so a link can be checked without a server. */
const ROUTES = {
  "/": "world.html",
  "/home": "home.html",
  "/school": "school.html",
  "/services": "services.html",
  "/thanks": "thanks.html",
};

const text = (node) => node.textContent.replace(/\s+/g, " ").trim();
const links = (doc) => [...doc.querySelectorAll("a[href]")];

describe("the prices page", () => {
  it("describes itself properly when someone shares the link", () => {
    const meta = (name) => services.querySelector(`meta[name="${name}"]`)?.content;
    const og = (name) => services.querySelector(`meta[property="og:${name}"]`)?.content;

    expect(services.documentElement.getAttribute("lang")).toBe("en");
    expect(services.title).toContain("What I charge");
    expect(meta("description").length).toBeGreaterThan(40);
    expect(og("title")).toBeTruthy();
    expect(og("description")).toBeTruthy();
    expect(meta("color-scheme")).toBe("light");
    expect(services.querySelector('link[rel="icon"]')).toBeTruthy();

    // one page title, and one main heading to go with it
    expect(services.querySelectorAll("h1")).toHaveLength(1);
    expect(text(services.querySelector("h1"))).toContain("What I charge");
  });

  it("lets a keyboard visitor skip the top bar", () => {
    const skip = services.querySelector("a.skip");

    expect(skip).toBeTruthy();
    expect(skip.getAttribute("href")).toBe("#services");
    expect(services.getElementById("services")).toBeTruthy();
  });

  it("keeps its landmarks and headings in a sensible order", () => {
    const landmarks = [...services.querySelectorAll("header, main, footer")].map((el) =>
      el.tagName.toLowerCase(),
    );

    expect(landmarks).toEqual(["header", "main", "footer"]);
    expect(services.querySelector("nav")?.getAttribute("aria-label")).toBeTruthy();

    const levels = [...services.querySelectorAll("h1, h2, h3")].map((h) => Number(h.tagName[1]));
    expect(levels.filter((level) => level === 1)).toHaveLength(1);

    // never jump down two levels: h2 to h4 leaves a screen reader guessing
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i] - levels[i - 1], `heading ${i}`).toBeLessThanOrEqual(1);
    }
  });

  it("uses every id once, so an anchor cannot land in the wrong place", () => {
    const ids = [...services.querySelectorAll("[id]")].map((el) => el.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sends every internal link somewhere this site actually serves", () => {
    for (const link of links(services)) {
      const href = link.getAttribute("href");

      if (href.startsWith("#")) {
        expect(services.getElementById(href.slice(1)), href).toBeTruthy();
        continue;
      }
      if (!href.startsWith("/")) continue;

      const route = href.split("#")[0].split("?")[0];
      const file = ROUTES[route];

      expect(file, `${href} is not a route this site serves`).toBeTruthy();
      expect(existsSync(path.join(PROJECT_ROOT, file)), href).toBe(true);
    }

    for (const link of links(services)) {
      expect(text(link).length, "a link with no words cannot be read out").toBeGreaterThan(0);
      expect(link.getAttribute("href")).not.toBe("#");
    }
  });

  it("offers exactly three things, each with a price", () => {
    const offers = [...services.querySelectorAll("#services .project")];

    expect(offers).toHaveLength(3);
    expect(offers.map((offer) => text(offer.querySelector(".price")))).toEqual([
      "€100",
      "€200",
      "€500",
    ]);

    for (const offer of offers) {
      expect(text(offer.querySelector("h3")).length).toBeGreaterThan(3);
      expect(text(offer.querySelector("p:not(.price)")).length).toBeGreaterThan(20);
      expect(offer.querySelectorAll(".included li").length).toBeGreaterThanOrEqual(3);
    }
  });

  it("gives every offer exactly one action, and it is a checkout", () => {
    for (const offer of services.querySelectorAll("#services .project")) {
      const actions = offer.querySelectorAll(".buy");

      expect(actions).toHaveLength(1);
      expect(actions[0].getAttribute("href")).toMatch(/^https:\/\//);
      expect(text(actions[0])).toMatch(/^\[ buy /);
    }

    expect(services.querySelectorAll("#services .buy")).toHaveLength(3);
  });

  it("answers the questions that stop people buying", () => {
    const questions = [...services.querySelectorAll(".faq dt")];
    const answers = text(services.querySelector(".faq")).toLowerCase();

    expect(questions.length).toBeGreaterThanOrEqual(5);
    expect(services.querySelectorAll(".faq dd")).toHaveLength(questions.length);

    for (const worry of [/refund/, /owns? the code/, /need from me/, /working day|week/]) {
      expect(answers, String(worry)).toMatch(worry);
    }
  });

  it("says what the money is in, and shows the work it buys", () => {
    expect(text(services.querySelector("#services"))).toContain("euro");
    expect(services.querySelector('#services a[href="/home"]')).toBeTruthy();
    expect(services.querySelector('#services a[href="/school"]')).toBeTruthy();
  });

  it("leaves one way to get in touch and one way back", () => {
    expect(services.querySelector('#contact a[href="/home"]')).toBeTruthy();
    expect(services.querySelectorAll('a[href^="mailto:"]').length).toBeGreaterThan(0);
    expect(services.querySelector(".leaders")).toBeTruthy();
  });

  it("keeps the copy on the house rules", () => {
    const copy = [...services.querySelectorAll("h2, h3, p, dd, .included li")]
      .filter((node) => !node.closest("footer") && !node.classList.contains("price"))
      .map(text)
      .join(" ")
      .toLowerCase();

    expect(copy).not.toMatch(/\w-\w/); // no hyphens inside sentences
    for (const cliche of ["elevate", "seamless", "unleash", "next gen", "game changer", "delve"]) {
      expect(copy, cliche).not.toContain(cliche);
    }
  });

  it("does not sell with a script, or with leftovers from the old fallback", () => {
    expect(services.querySelectorAll("script")).toHaveLength(0);
    expect(services.querySelectorAll("[data-buy], [data-fallback]")).toHaveLength(0);
  });
});

describe("the thank you page", () => {
  it("stays out of search and says what happens next", () => {
    expect(thanks.querySelector('meta[name="robots"]')?.content).toContain("noindex");
    expect(thanks.querySelectorAll("h1")).toHaveLength(1);
    expect(text(thanks.querySelector("#thanks"))).toContain("working day");
  });

  it("gives the buyer a way back, but never a way to pay twice", () => {
    expect(thanks.querySelector('a[href="/services"]')).toBeTruthy();
    expect(thanks.querySelector('a[href="/home"]')).toBeTruthy();
    expect(thanks.querySelector('a[href^="mailto:"]')).toBeTruthy();

    expect(thanks.querySelectorAll(".buy")).toHaveLength(0);
    expect(thanks.querySelectorAll('a[href*="buy.stripe.com"]')).toHaveLength(0);
  });

  it("builds on the same links the prices page does", () => {
    for (const link of links(thanks)) {
      const href = link.getAttribute("href");
      if (!href.startsWith("/")) continue;

      const route = href.split("#")[0].split("?")[0];
      expect(ROUTES[route], `${href} is not a route this site serves`).toBeTruthy();
      expect(existsSync(path.join(PROJECT_ROOT, ROUTES[route])), href).toBe(true);
    }
  });
});

describe("the two pages together", () => {
  it("wears the same shell, so the site does not change costume mid flow", () => {
    const shell = (doc) => ({
      name: text(doc.querySelector(".who")),
      stylesheet: doc.querySelector('link[rel="stylesheet"]')?.getAttribute("href"),
      favicon: doc.querySelector('link[rel="icon"]')?.getAttribute("href"),
      colophon: text(doc.querySelector(".colophon")),
    });

    for (const part of ["stylesheet", "favicon", "colophon"]) {
      expect(shell(thanks)[part], part).toBe(shell(services)[part]);
    }

    for (const page of [services, thanks]) {
      expect(shell(page).name).toContain("Juan Felipe Diaz Bustamante");
    }
  });

  it("loads no script on either page", () => {
    for (const page of [services, thanks]) {
      expect(page.querySelectorAll("script")).toHaveLength(0);
    }
  });
});
