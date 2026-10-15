// The deck's script decides what a keypress does. Those decisions are pure
// functions so they can be pinned down here, without a browser.

import { describe, expect, it } from "vitest";
import { edgeTarget, navHrefFor, nearestSlide, nextMove, SLIDE_SELECTOR } from "../slides.js";

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

  it("maps a slide to the nav link that points at it", () => {
    expect(navHrefFor({ id: "work" })).toBe("#work");
    expect(navHrefFor({ id: "" })).toBeNull();
    expect(navHrefFor({})).toBeNull();
    expect(navHrefFor(null)).toBeNull();
  });

  it("reads the slides the same way the page is marked up", () => {
    expect(SLIDE_SELECTOR).toBe("main > .slide");
  });
});
