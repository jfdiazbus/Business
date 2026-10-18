// The Stripe side of the prices page.
//
// Two layers, because they catch different things:
//
//   1. The links in the page are well formed, distinct, and honest about being
//      test links. Always runs, no network, no key.
//   2. Every link really exists in the Stripe account and carries the settings
//      the page promises. Runs only when a key is available, from
//      STRIPE_SECRET_KEY in the environment or from the gitignored .secrets.
//
// The second layer is the one that catches expensive drift: a price changed in
// the Dashboard and not on the page, a link switched off, tax or invoicing
// silently turned off, a redirect pointed at the wrong place. It skips, loudly,
// rather than pretending to pass when no key is present.

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { PROJECT_ROOT, readSecrets } from "../scripts/deploy.mjs";

const read = (file) => readFileSync(path.join(PROJECT_ROOT, file), "utf8");
const servicesHtml = read("services.html");
const readme = read("README.md");
const { document } = new JSDOM(servicesHtml).window;

const text = (node) => node.textContent.replace(/\s+/g, " ").trim();

/** Each offer with the price the page shows, and its buy button. */
const offers = [...document.querySelectorAll("#services .project")].map((offer) => {
  const shown = text(offer.querySelector(".price"));

  return {
    name: text(offer.querySelector("h3")),
    shown,
    cents: Number(shown.replace(/\D/g, "")) * 100,
    href: offer.querySelector(".buy").getAttribute("href"),
  };
});

const TEST_LINK = /\/test_/;

describe("the links the page sells with", () => {
  it("gives every offer its own Payment Link", () => {
    expect(offers).toHaveLength(5);

    for (const offer of offers) {
      expect(offer.href, offer.name).toMatch(/^https:\/\/buy\.stripe\.com\/[A-Za-z0-9_]+$/);
      expect(offer.cents, offer.name).toBeGreaterThan(0);
    }

    expect(new Set(offers.map((offer) => offer.href)).size).toBe(5);
  });

  it("never sells through an email instead of a checkout", () => {
    const emails = [...document.querySelectorAll("#services a[href^='mailto:']")].map(text);

    expect(emails).toEqual([]);
  });

  it("says out loud when the links are test links, so nobody ships them thinking otherwise", () => {
    const testLinks = offers.filter((offer) => TEST_LINK.test(offer.href));

    if (testLinks.length === 0) return;

    expect(readme).toMatch(/test links/i);
    expect(readme).toMatch(/swap in live links/i);
  });
});

// --- layer 2: the account itself ------------------------------------------

const secrets = await readSecrets();
const apiKey = process.env.STRIPE_SECRET_KEY || secrets.STRIPE_SECRET_KEY || "";

/** A GET against the Stripe API. The key never appears in a failure message. */
async function stripe(resource, params = {}) {
  const url = new URL(`https://api.stripe.com/v1/${resource}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.append(name, value);

  const response = await fetch(url, {
    headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}` },
    signal: AbortSignal.timeout(15000),
  });

  const body = await response.json();
  if (body.error) throw new Error(`Stripe refused ${resource}: ${body.error.message}`);

  return body;
}

const accountTests = apiKey ? describe : describe.skip;

accountTests("the Stripe account behind those links", () => {
  /** Every link on the page, fetched once, with its price and product. */
  let loaded = null;
  const loadOffers = () =>
    (loaded ??= (async () => {
      const links = await stripe("payment_links", {
        limit: "100",
        "expand[]": "data.line_items",
      });

      const byUrl = new Map((links.data || []).map((link) => [link.url, link]));

      return Promise.all(
        offers.map(async (offer) => {
          const link = byUrl.get(offer.href);
          if (!link) return { offer, link: null };

          const line = ((link.line_items && link.line_items.data) || [])[0] || {};
          const priceId = typeof line.price === "object" ? line.price.id : line.price;
          const price = priceId ? await stripe(`prices/${priceId}`, { "expand[]": "product" }) : {};

          return { offer, link, line, price };
        }),
      );
    })());

  it("has an active Payment Link for every offer on the page", async () => {
    for (const { offer, link } of await loadOffers()) {
      expect(
        link,
        `${offer.name}: ${offer.href} is not a Payment Link in this account`,
      ).toBeTruthy();
      expect(link.active, `${offer.name} is switched off in Stripe`).toBe(true);
    }
  }, 20000);

  it("charges exactly the price the page shows", async () => {
    for (const { offer, line, price } of await loadOffers()) {
      expect(line.amount_total, `${offer.name} on the page says ${offer.shown}`).toBe(offer.cents);
      expect(price.unit_amount, offer.name).toBe(offer.cents);
    }
  }, 20000);

  it("keeps the checkout the page promises", async () => {
    for (const { offer, link } of await loadOffers()) {
      expect(link.currency, offer.name).toBe("eur");
      expect(link.automatic_tax && link.automatic_tax.enabled, offer.name).toBe(true);
      expect(link.allow_promotion_codes, offer.name).toBe(true);
      expect(link.tax_id_collection && link.tax_id_collection.enabled, offer.name).toBe(true);
      expect(link.invoice_creation && link.invoice_creation.enabled, offer.name).toBe(true);
      expect(link.after_completion && link.after_completion.type, offer.name).toBe("redirect");
      expect(link.after_completion.redirect.url, offer.name).toMatch(/\/thanks$/);

      // left unset on purpose, so Stripe picks the methods: card alone would
      // hide Klarna, Bancontact and the rest from European buyers
      expect(link.payment_method_types, offer.name).toBeNull();
    }
  }, 20000);

  it("labels each price, and gives it a tax code that is not the nontaxable one", async () => {
    for (const { offer, price } of await loadOffers()) {
      expect(price.tax_behavior, offer.name).toBe("exclusive");
      expect(price.product.name, offer.name).toBeTruthy();
      expect(price.product.tax_code, offer.name).toBeTruthy();
      // txcd_00000000 is Nontaxable, and Stripe reports it the same way it
      // reports a missing registration: as not_collecting
      expect(price.product.tax_code, offer.name).not.toBe("txcd_00000000");
    }
  }, 20000);

  it("points every link at the thank you page this site actually serves", async () => {
    for (const { offer, link } of await loadOffers()) {
      const url = new URL(link.after_completion.redirect.url);
      const route = url.pathname.replace(/\/$/, "") || "/";
      const page = { "/thanks": "thanks.html", "/services": "services.html" }[route];

      expect(page, `${offer.name} redirects to ${route}, which is not a page here`).toBeTruthy();
      expect(existsSync(path.join(PROJECT_ROOT, page)), offer.name).toBe(true);
    }
  }, 20000);
});
