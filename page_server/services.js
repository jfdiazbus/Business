// Where the buy buttons send people.
//
// Create the three Payment Links in your Stripe dashboard (see README, "Taking
// payments"), then paste their URLs here. While an entry is empty, that offer's
// button falls back to email instead of pointing at nothing — so the page can
// ship before Stripe is ready.

export const paymentLinks = {
  website: "",
  api: "",
  full: "",
};

const STRIPE_LINK = /^https:\/\/buy\.stripe\.com\/\S+$/;

/**
 * The href a buy button should use, or null when that offer has no link yet.
 * Only real Payment Link URLs count: a typo or a placeholder falls back to
 * email rather than sending someone to a broken checkout.
 */
export function buyHref(offer, links = paymentLinks) {
  const url = links[offer];
  if (typeof url !== "string") return null;

  const trimmed = url.trim();
  return STRIPE_LINK.test(trimmed) ? trimmed : null;
}

if (typeof document !== "undefined") {
  for (const button of document.querySelectorAll("[data-buy]")) {
    const href = buyHref(button.dataset.buy);
    if (href) button.href = href;
    else if (button.dataset.fallback) button.textContent = button.dataset.fallback;
  }
}
