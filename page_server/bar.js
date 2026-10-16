// bar.js — the one script the document pages load.
//
// The bar sits transparent over the top of the page and turns solid once you
// scroll. It deliberately does not listen to `scroll`: that fires constantly and
// forces layout work on every frame. Instead it watches a one pixel sentinel at
// the very top of the document, and when that leaves the viewport the page has
// moved.
//
// Nothing here is load bearing. Without this file the bar stays transparent and
// the nav links still work, because the current page is marked in the markup.

const BAR = ".topbar";
const SOLID = "topbar--solid";

/** Whether a sentinel observation means the page has scrolled away from the top. */
export function hasScrolledPast(entry) {
  return !entry.isIntersecting;
}

if (typeof document !== "undefined") {
  const bar = document.querySelector(BAR);

  // a browser without an observer keeps the clear bar, which is the look at the
  // top of a page anyway: nothing here is load bearing
  if (bar && typeof IntersectionObserver === "function") {
    const sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:1px";
    document.body.prepend(sentinel);

    const observer = new IntersectionObserver(
      ([entry]) => {
        bar.classList.toggle(SOLID, hasScrolledPast(entry));
      },
      { threshold: 0 },
    );

    observer.observe(sentinel);
  }
}
