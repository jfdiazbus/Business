// bar.js — the one script the document pages load.
//
// Two jobs, and both are enhancements rather than requirements:
//
//   1. The bar sits clear over the top of the page and turns solid once you
//      scroll. It deliberately does not listen to `scroll`: that fires on every
//      frame and forces layout work while the visitor is scrolling. It watches a
//      one pixel sentinel instead.
//   2. On a phone the nav collapses behind a menu button. Without this file the
//      button stays hidden and the nav stays a plain scrollable row of links, so
//      nothing becomes unreachable.
//
// The page works with this file blocked. It just keeps the clear bar and the
// plain row.

const BAR = ".topbar";
const SOLID = "topbar--solid";
const ENHANCED = "topbar--enhanced";
const OPEN = "topbar--open";

/** Whether a sentinel observation means the page has scrolled away from the top. */
export function hasScrolledPast(entry) {
  return !entry.isIntersecting;
}

/** The clear bar becomes solid when the page moves, without watching scroll. */
export function observeScroll(bar, { doc = document, view = globalThis } = {}) {
  if (typeof view.IntersectionObserver !== "function") return null;

  const sentinel = doc.createElement("div");
  sentinel.setAttribute("aria-hidden", "true");
  sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:1px";
  doc.body.prepend(sentinel);

  const observer = new view.IntersectionObserver(
    ([entry]) => {
      bar.classList.toggle(SOLID, hasScrolledPast(entry));
    },
    { threshold: 0 },
  );

  observer.observe(sentinel);
  return observer;
}

/** The phone menu. Does nothing at all without a button and a nav to wire up. */
export function activateMenu(bar, { doc = document, view = globalThis } = {}) {
  const button = bar.querySelector(".topbar__menu");
  const nav = bar.querySelector("nav");
  if (!button || !nav) return null;

  bar.classList.add(ENHANCED);

  const first = nav.querySelector("a");
  const isOpen = () => bar.classList.contains(OPEN);

  const setOpen = (open) => {
    bar.classList.toggle(OPEN, open);
    button.setAttribute("aria-expanded", String(open));
    // the page behind the panel must not scroll under it
    doc.body.style.overflow = open ? "hidden" : "";
  };

  const open = () => {
    setOpen(true);
    if (first) first.focus();
  };

  const close = ({ focusButton = false } = {}) => {
    if (!isOpen()) return;
    setOpen(false);
    if (focusButton) button.focus();
  };

  button.addEventListener("click", () => {
    if (isOpen()) close({ focusButton: true });
    else open();
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) close();
  });

  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close({ focusButton: true });
  });

  // a wider window brings the plain row back, so the panel must not stay open
  if (typeof view.matchMedia === "function") {
    view.matchMedia("(min-width: 768px)").addEventListener("change", (event) => {
      if (event.matches) close();
    });
  }

  return { open, close, isOpen };
}

/** The nav says "Log in" until the server says someone is signed in. */
export async function markSignedIn(link, { fetchImpl = globalThis.fetch } = {}) {
  if (!link || typeof fetchImpl !== "function") return null;

  try {
    const response = await fetchImpl("/api/account/session", { credentials: "same-origin" });
    if (!response.ok) return null;
    const result = await response.json();
    if (!result || !result.authenticated) return null;
    link.textContent = "Account";
    link.href = "/account";
    link.setAttribute("data-signed-in", "true");
    if (globalThis.location?.pathname === "/account") {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
    return result.user || null;
  } catch {
    return null;
  }
}

if (typeof document !== "undefined") {
  const bar = document.querySelector(BAR);

  if (bar) {
    observeScroll(bar);
    activateMenu(bar);
  }

  markSignedIn(document.querySelector("[data-account-link]"));
}
