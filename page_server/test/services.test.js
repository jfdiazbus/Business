// The prices page: three offers, one action each, and buy buttons that fall
// back to email until real Stripe links exist. The fallback matters — it is
// what lets the page ship before the Stripe account is verified.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { buyHref } from "../services.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(path.join(PROJECT_ROOT, "services.html"), "utf8");
const thanksHtml = readFileSync(path.join(PROJECT_ROOT, "thanks.html"), "utf8");
const { document } = new JSDOM(html).window;
const thanks = new JSDOM(thanksHtml).window.document;

const text = (node) => node.textContent.replace(/\s+/g, " ").trim();

describe("the prices page", () => {
  it("describes itself, and has one heading", () => {
    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(document.title).toContain("What I charge");
    expect(document.querySelector('meta[name="description"]')?.content.length).toBeGreaterThan(40);
    expect(document.querySelector('meta[property="og:title"]')).toBeTruthy();
    expect(document.querySelectorAll("h1")).toHaveLength(1);
  });

  it("offers exactly three things, each with a price", () => {
    const offers = [...document.querySelectorAll("#services .project")];

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

  it("gives every offer one buy button, which emails until Stripe is wired", () => {
    const buttons = [...document.querySelectorAll("[data-buy]")];

    expect(buttons).toHaveLength(3);

    for (const button of buttons) {
      expect(["website", "api", "full"]).toContain(button.dataset.buy);
      // no link yet means email, never a dead or empty href
      expect(button.getAttribute("href")).toMatch(/^mailto:/);
      expect(button.dataset.fallback.length).toBeGreaterThan(10);
    }
  });

  it("answers the questions that stop people buying", () => {
    const questions = [...document.querySelectorAll(".faq dt")];

    expect(questions.length).toBeGreaterThanOrEqual(5);
    expect(document.querySelectorAll(".faq dd")).toHaveLength(questions.length);
    expect(questions.map(text).join(" ").toLowerCase()).toMatch(/refund|do not like it/);
  });

  it("says what the money is in, and where the work is", () => {
    expect(text(document.querySelector("#services"))).toContain("euro");
    expect(document.querySelector('#services a[href="/home"]')).toBeTruthy();
    expect(document.querySelector('#services a[href="/school"]')).toBeTruthy();
  });

  it("has one way to act, one way back, and no dead links", () => {
    expect(document.querySelector('#contact a[href="/home"]')).toBeTruthy();
    expect([...document.querySelectorAll('a[href^="mailto:"]')].length).toBeGreaterThan(0);

    for (const link of document.querySelectorAll("a")) {
      expect(link.getAttribute("href"), text(link)).not.toBe("#");
    }
  });

  it("keeps the copy on the house rules", () => {
    const copy = [...document.querySelectorAll("h2, h3, p, dd, .included li")]
      .filter((node) => !node.closest("footer") && !node.classList.contains("price"))
      .map(text)
      .join(" ")
      .toLowerCase();

    expect(copy).not.toMatch(/\w-\w/); // no hyphens inside sentences
    for (const cliche of ["elevate", "seamless", "unleash", "next gen", "game changer", "delve"]) {
      expect(copy, cliche).not.toContain(cliche);
    }
  });
});

describe("the payment links", () => {
  it("uses a real Payment Link once one is pasted in", () => {
    const links = { website: "https://buy.stripe.com/test_abc123" };

    expect(buyHref("website", links)).toBe("https://buy.stripe.com/test_abc123");
    expect(buyHref("website", { website: "  https://buy.stripe.com/test_abc123  " })).toContain(
      "buy.stripe.com",
    );
  });

  it("refuses anything that is not a Payment Link, so nobody lands nowhere", () => {
    for (const value of [
      "",
      "   ",
      "#",
      "https://example.com/pay",
      "buy.stripe.com/x",
      undefined,
    ]) {
      expect(buyHref("website", { website: value }), String(value)).toBeNull();
    }

    expect(buyHref("removed-offer", { website: "https://buy.stripe.com/test_a" })).toBeNull();
  });
});

describe("the thank you page", () => {
  it("says what happens next, and stays out of search", () => {
    expect(thanks.querySelector('meta[name="robots"]')?.content).toContain("noindex");
    expect(text(thanks.querySelector("#thanks"))).toContain("working day");
    expect(thanks.querySelector('a[href="/services"]')).toBeTruthy();
    expect(thanks.querySelector('a[href^="mailto:"]')).toBeTruthy();
    expect(thanks.querySelectorAll("h1")).toHaveLength(1);
  });
});
