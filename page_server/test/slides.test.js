// The deck's script decides what a keypress does. Those decisions are pure
// functions so they can be pinned down here, without a browser.

import { describe, expect, it } from "vitest";
import { edgeTarget, nearestSlide, nextMove, SLIDE_SELECTOR, TURN, turned } from "../slides.js";

const fitting = { top: 0, bottom: 900 };
const tall = { top: 0, bottom: 1600 };

describe("what a keypress does", () => {
  it("moves one slide at a time", () => {
    const down = (index) =>
      nextMove({ key: "ArrowDown", index, count: 4, box: fitting, viewportHeight: 900 });

    expect(down(0)).toEqual({ kind: "slide", index: 1 });
    expect(down(1)).toEqual({ kind: "slide", index: 2 });
    expect(
      nextMove({ key: "ArrowUp", index: 2, count: 4, box: fitting, viewportHeight: 900 }),
    ).toEqual({ kind: "slide", index: 1 });
  });

  it("also answers the page keys and the space bar", () => {
    for (const key of ["PageDown", " "]) {
      expect(nextMove({ key, index: 0, count: 4, box: fitting, viewportHeight: 900 }), key).toEqual(
        { kind: "slide", index: 1 },
      );
    }

    expect(
      nextMove({ key: "PageUp", index: 3, count: 4, box: fitting, viewportHeight: 900 }),
    ).toEqual({ kind: "slide", index: 2 });
  });

  it("jumps to the ends", () => {
    expect(
      nextMove({ key: "Home", index: 2, count: 4, box: fitting, viewportHeight: 900 }),
    ).toEqual({ kind: "slide", index: 0 });
    expect(nextMove({ key: "End", index: 1, count: 4, box: fitting, viewportHeight: 900 })).toEqual(
      { kind: "slide", index: 3 },
    );
  });

  it("stays put at the first and last slide", () => {
    expect(
      nextMove({ key: "ArrowUp", index: 0, count: 4, box: fitting, viewportHeight: 900 }),
    ).toBeNull();
    expect(
      nextMove({ key: "ArrowDown", index: 3, count: 4, box: fitting, viewportHeight: 900 }),
    ).toBeNull();
  });

  it("reveals the rest of a slide taller than the window instead of skipping it", () => {
    expect(
      nextMove({ key: "ArrowDown", index: 1, count: 4, box: tall, viewportHeight: 900 }),
    ).toEqual({ kind: "edge", direction: 1 });

    expect(
      nextMove({
        key: "ArrowUp",
        index: 1,
        count: 4,
        box: { top: -400, bottom: 400 },
        viewportHeight: 900,
      }),
    ).toEqual({ kind: "edge", direction: -1 });

    // once that slide's end is on screen, the next press moves on
    expect(
      nextMove({
        key: "ArrowDown",
        index: 1,
        count: 4,
        box: { top: -700, bottom: 880 },
        viewportHeight: 900,
      }),
    ).toEqual({ kind: "slide", index: 2 });
  });

  it("leaves every other key to the browser", () => {
    for (const key of ["a", "Escape", "Tab", "Enter", "ArrowLeft", "ArrowRight", "F5"]) {
      expect(
        nextMove({ key, index: 1, count: 4, box: fitting, viewportHeight: 900 }),
        key,
      ).toBeNull();
    }
  });

  it("ignores the fraction of a pixel that rounding leaves past the fold", () => {
    // a slide laid out to exactly one screen can measure 900.09 tall, and that
    // must not read as content still hidden below
    const rounded = { top: 0.09, bottom: 900.09 };

    expect(
      nextMove({ key: "ArrowDown", index: 0, count: 4, box: rounded, viewportHeight: 900 }),
    ).toEqual({ kind: "slide", index: 1 });
    expect(
      nextMove({
        key: "ArrowUp",
        index: 2,
        count: 4,
        box: { top: -0.09, bottom: 900 },
        viewportHeight: 900,
      }),
    ).toEqual({ kind: "slide", index: 1 });
  });

  it("knows where the far edge of a tall slide is", () => {
    expect(
      edgeTarget({
        box: { top: 100, bottom: 1600 },
        direction: 1,
        scrollY: 100,
        viewportHeight: 900,
      }),
    ).toBe(800);
    expect(
      edgeTarget({
        box: { top: -300, bottom: 600 },
        direction: -1,
        scrollY: 1400,
        viewportHeight: 900,
      }),
    ).toBe(1100);
    expect(
      edgeTarget({
        box: { top: -50, bottom: 850 },
        direction: -1,
        scrollY: 20,
        viewportHeight: 900,
      }),
    ).toBe(0);
  });
});

describe("knowing which slide you are on", () => {
  const tops = [44, 944, 1844, 2744];

  it("picks the closest slide", () => {
    expect(nearestSlide(tops, 0)).toBe(0);
    expect(nearestSlide(tops, 800)).toBe(1);
    expect(nearestSlide(tops, 1844)).toBe(2);
    expect(nearestSlide(tops, 99999)).toBe(3);
  });

  it("survives a deck with a single slide", () => {
    expect(nearestSlide([0], 500)).toBe(0);
  });

  it("moves on when only a sliver of the slide is left below the fold", () => {
    // the state a tall slide gets stuck in: 72px below the fold, which snapping
    // will not scroll away, so pressing on has to mean the next slide
    const stuck = { top: -317, bottom: 1072 };

    expect(
      nextMove({ key: "ArrowDown", index: 1, count: 5, box: stuck, viewportHeight: 1000 }),
    ).toEqual({
      kind: "slide",
      index: 2,
    });

    // and a real reveal above that threshold still happens
    const half = { top: 72, bottom: 1461 };

    expect(
      nextMove({ key: "ArrowDown", index: 1, count: 5, box: half, viewportHeight: 1000 }),
    ).toEqual({
      kind: "edge",
      direction: 1,
    });
  });

  it("keeps an upward turn clear of the bar", () => {
    // the same box, with and without the bar's height to allow for
    const options = { box: tall, direction: -1, scrollY: 1200, viewportHeight: 900 };

    expect(edgeTarget(options)).toBe(1200);
    expect(edgeTarget({ ...options, margin: 72 })).toBe(1128);
  });

  it("reads the slides the same way the page is marked up", () => {
    expect(SLIDE_SELECTOR).toBe("main > .slide");
  });
});

describe("the page turn", () => {
  it("turns quickly, rather than taking the browser's own time", () => {
    // a full screen of travel used to drift for most of a second
    expect(TURN).toBeGreaterThan(150);
    expect(TURN).toBeLessThanOrEqual(400);
  });

  it("eases out, so it leaves fast and arrives gently", () => {
    expect(turned(0)).toBe(0);
    expect(turned(1)).toBe(1);

    // more than halfway there before half the time has gone
    expect(turned(0.5)).toBeGreaterThan(0.5);

    const samples = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].map(turned);
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i], `sample ${i}`).toBeGreaterThan(samples[i - 1]);
    }

    // and it clamps, so a late frame cannot overshoot
    expect(turned(-1)).toBe(0);
    expect(turned(2)).toBe(1);
  });
});
