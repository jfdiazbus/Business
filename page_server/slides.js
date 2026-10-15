// slides.js — makes the deck behave like a deck.
//
// The slides snap and print with CSS alone. This adds the two things CSS
// cannot do: one keypress (or nav click) per slide, and a nav that shows which
// slide you are on. Without this file the page still reads fine — it scrolls
// like a long page.
//
// The decisions are kept in small functions so they can be tested without a
// browser; only the wiring below touches the DOM.

export const SLIDE_SELECTOR = "main > .slide";

const DIRECTION = {
  ArrowDown: 1,
  PageDown: 1,
  " ": 1,
  ArrowUp: -1,
  PageUp: -1,
};

/** The index of the slide whose top is closest to a scroll position. */
export function nearestSlide(tops, scrollY) {
  return tops.reduce(
    (best, top, index) => (Math.abs(top - scrollY) < Math.abs(tops[best] - scrollY) ? index : best),
    0,
  );
}

/** The href of the nav link that belongs to a slide, if it has one. */
export function navHrefFor(slide) {
  return slide && slide.id ? `#${slide.id}` : null;
}

/**
 * What a keypress should do:
 *
 *   { kind: "slide", index }   move to a slide
 *   { kind: "edge", direction} the current slide runs past the fold, so reveal
 *                              the rest of it instead of skipping it
 *   null                       leave the key to the browser
 *
 * A slide taller than the window (a phone, or a short laptop) is read by
 * scrolling through it, so one keypress never hides content.
 */
// A slider's edge can be a fraction of a pixel past the fold purely from
// rounding, and that must not read as "there is more of this slide to see".
const SLACK = 2;

export function nextMove({ key, index, count, box, viewportHeight }) {
  if (key === "Home") return { kind: "slide", index: 0 };
  if (key === "End") return { kind: "slide", index: count - 1 };

  const direction = DIRECTION[key];
  if (!direction) return null;

  const pastTheFold = direction > 0 ? box.bottom > viewportHeight + SLACK : box.top < 0 - SLACK;

  if (pastTheFold) return { kind: "edge", direction };

  const to = Math.max(0, Math.min(count - 1, index + direction));
  return to === index ? null : { kind: "slide", index: to };
}

/** Where to scroll so a slide's far edge meets the fold. */
export function edgeTarget({ box, direction, scrollY, viewportHeight }) {
  const to = direction > 0 ? scrollY + box.bottom - viewportHeight : scrollY + box.top;
  return Math.max(0, Math.round(to));
}

if (typeof document !== "undefined") {
  const slides = [...document.querySelectorAll(SLIDE_SELECTOR)];
  const links = [...document.querySelectorAll(".topbar nav a")];
  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  const scrollTo = (top) => window.scrollTo({ top, behavior: calm.matches ? "auto" : "smooth" });

  const tops = () => slides.map((slide) => slide.getBoundingClientRect().top + window.scrollY);

  const mark = (index) => {
    const href = navHrefFor(slides[index]);

    for (const link of links) {
      if (href !== null && link.getAttribute("href") === href) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    }
  };

  const show = (index) => {
    const slide = slides[index];
    if (!slide) return;

    slide.scrollIntoView({ behavior: calm.matches ? "auto" : "smooth", block: "start" });
    mark(index);
  };

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    if (event.target instanceof Element && event.target.closest("input, textarea, select")) return;

    const index = nearestSlide(tops(), window.scrollY);
    const move = nextMove({
      key: event.key,
      index,
      count: slides.length,
      box: slides[index].getBoundingClientRect(),
      viewportHeight: window.innerHeight,
    });
    if (!move) return;

    event.preventDefault();

    if (move.kind === "edge") {
      scrollTo(
        edgeTarget({
          box: slides[index].getBoundingClientRect(),
          direction: move.direction,
          scrollY: window.scrollY,
          viewportHeight: window.innerHeight,
        }),
      );
      return;
    }

    show(move.index);
  });

  let queued = false;

  addEventListener(
    "scroll",
    () => {
      if (queued) return;
      queued = true;

      requestAnimationFrame(() => {
        queued = false;
        mark(nearestSlide(tops(), window.scrollY));
      });
    },
    { passive: true },
  );

  mark(nearestSlide(tops(), window.scrollY));
}
