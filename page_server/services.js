// Where the buy buttons send people.
//
// These three come from the Stripe sandbox ("portfolio sandbox"), so they are
// test links: they accept Stripe's test cards, not money. The guard below lets
// a test link through on localhost only, which means the live site keeps
// falling back to email until real ones are pasted in.
//
// To go live: activate the Stripe account, recreate the three links in live
// mode (see README, "Taking payments"), and paste their URLs here.

export const paymentLinks = {
  website: "https://buy.stripe.com/test_8x23cv8bv5MRbqmgSJabK00",
  api: "https://buy.stripe.com/test_5kQ8wPfDX6QV8ea5a1abK01",
  full: "https://buy.stripe.com/test_8x2eVdgI13EJ51YdGxabK02",
};

// Payment Links are served from buy.stripe.com. If you ever move them to a
// custom domain, add that host here, or the buttons revert to email.
const LINK_HOSTS = ["buy.stripe.com"];

const TEST_LINK = /\/test_/;
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|::1)(:\d+)?$/;

function currentHost() {
  return typeof location === "undefined" ? "" : location.hostname;
}

function isPaymentLink(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && LINK_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * The href a buy button should use, or null when that offer has no usable link.
 *
 * Only real Payment Link URLs count, and a test-mode link counts on localhost
 * alone. A typo, a placeholder, or a sandbox link on the live site falls back
 * to email rather than sending a customer to a checkout that cannot take their
 * money. An unknown host counts as not local: this refuses rather than guesses.
 */
export function buyHref(offer, links = paymentLinks, host = currentHost()) {
  const url = links[offer];
  if (typeof url !== "string") return null;

  const trimmed = url.trim();
  if (!isPaymentLink(trimmed)) return null;
  if (TEST_LINK.test(trimmed) && !LOCAL_HOST.test(host)) return null;

  return trimmed;
}

if (typeof document !== "undefined") {
  for (const button of document.querySelectorAll("[data-buy]")) {
    const href = buyHref(button.dataset.buy);
    if (href) button.href = href;
    else if (button.dataset.fallback) button.textContent = button.dataset.fallback;
  }
}
