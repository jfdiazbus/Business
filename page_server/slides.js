// slides.js — makes the deck behave like a deck.
//
// The slides snap and print with CSS alone. This adds the one thing CSS cannot
// do: one keypress per slide, so the deck can be read without a mouse. Which
// slide you are on is printed in the slide itself ("2 / 5"), so nothing here has
// to mark up the navigation. Without this file the page still reads fine — it
// scrolls like a long page.
//
// The decisions are kept in small functions so they can be tested without a
// browser; only the wiring below touches the DOM.

export const SLIDE_SELECTOR = "main > .slide";

/**
 * How long one keypress takes to turn the page, in milliseconds.
 *
 * This used to be the browser's own smooth scroll, which takes its time and
 * cannot be hurried: a full screen of travel drifted for the better part of a
 * second, and it was still moving when the visitor expected the next slide. A
 * page turn should feel like a page turn.
 */
export const TURN = 300;

/** Cubic ease out: quick to leave, gentle to arrive. */
export function turned(t) {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) ** 3;
}

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

/**
 * What a keypress should do:
 *
 *   { kind: "slide", index }   move to a slide
 *   { kind: "edge", direction} the current slide runs past the fold, so reveal
 *                              the rest of it instead of skipping it
 *   null                       leave the key to the browser
 *
 * A slide taller than the window (a phone, or a short laptop) is read by
 * scrolling through it, so one keypress never hides content. Once there is only
 * a sliver left below the fold, the next keypress moves on instead of nudging at
 * a reveal that snapping will not allow.
 */
// A slider's edge can be a fraction of a pixel past the fold purely from
// rounding, and that must not read as "there is more of this slide to see".
const SLACK = 2;

// How much of a slide has to be below the fold before a keypress is spent
// revealing it rather than moving on. Without this the deck can stall: a slide
// taller than the window gets scrolled until the browser's snapping refuses to
// go further, and every later keypress aims at the same unreachable place.
const REVEAL = 96;

export function nextMove({ key, index, count, box, viewportHeight }) {
  if (key === "Home") return { kind: "slide", index: 0 };
  if (key === "End") return { kind: "slide", index: count - 1 };

  const direction = DIRECTION[key];
  if (!direction) return null;

  const remaining = box.bottom - viewportHeight;
  const pastTheFold = direction > 0 ? remaining > REVEAL : box.top < 0 - SLACK;

  if (pastTheFold) return { kind: "edge", direction };

  const to = Math.max(0, Math.min(count - 1, index + direction));
  return to === index ? null : { kind: "slide", index: to };
}

/**
 * Where to scroll so a slide's far edge meets the fold.
 *
 * Going down reveals the rest of a slide below the fold, so the slide's bottom
 * meets the bottom of the window. Coming back up puts the slide's top under the
 * bar, which is why the margin is subtracted: without it the heading ends up
 * hidden behind a bar that never moves.
 */
export function edgeTarget({ box, direction, scrollY, viewportHeight, margin = 0 }) {
  const to = direction > 0 ? scrollY + box.bottom - viewportHeight : scrollY + box.top - margin;
  return Math.max(0, Math.round(to));
}

if (typeof document !== "undefined") {
  const slides = [...document.querySelectorAll(SLIDE_SELECTOR)];
  const calm = matchMedia("(prefers-reduced-motion: reduce)");

  /**
   * Where the deck should come to rest for a slide: the same place the CSS
   * snap uses, read from the same scroll margin, so a keypress and a flick land
   * in exactly the same spot.
   */
  const marginFor = (slide) => parseFloat(getComputedStyle(slide).scrollMarginTop) || 0;
  const restFor = (slide) =>
    Math.max(0, Math.round(slide.getBoundingClientRect().top + scrollY - marginFor(slide)));

  let turning = null;

  /** `instant` is what overrides the stylesheet's smooth scroll for the frame. */
  const jump = (y) => window.scrollTo({ top: y, behavior: "instant" });

  /** One short, eased move. */
  const glideTo = (top) => {
    if (turning !== null) cancelAnimationFrame(turning);

    if (calm.matches || typeof requestAnimationFrame !== "function") {
      jump(top);
      return;
    }

    const from = scrollY;
    const started = performance.now();

    const step = (now) => {
      const t = Math.min(1, (now - started) / TURN);
      jump(from + (top - from) * turned(t));
      turning = t < 1 ? requestAnimationFrame(step) : null;
    };

    turning = requestAnimationFrame(step);
  };

  const tops = () => slides.map((slide) => slide.getBoundingClientRect().top + window.scrollY);

  const show = (index) => {
    const slide = slides[index];
    if (!slide) return;

    glideTo(restFor(slide));
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
      glideTo(
        edgeTarget({
          box: slides[index].getBoundingClientRect(),
          direction: move.direction,
          scrollY,
          viewportHeight: innerHeight,
          margin: marginFor(slides[index]),
        }),
      );
      return;
    }

    show(move.index);
  });
}
