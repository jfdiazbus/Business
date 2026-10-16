// The bar: one small script, and the rules it has to keep.
//
// The point of `bar.js` is the thing it does not do. A scroll listener would
// fire on every frame and force layout while the visitor is scrolling, so the
// solid state is driven by an observed sentinel instead. This file guards both
// the decision and the wiring.

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { hasScrolledPast } from "../bar.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(PROJECT_ROOT, "bar.js"), "utf8");

describe("bar.js", () => {
  it("reads a sentinel leaving the viewport as the page having moved", () => {
    expect(hasScrolledPast({ isIntersecting: true })).toBe(false);
    expect(hasScrolledPast({ isIntersecting: false })).toBe(true);
  });

  it("never listens to scroll events", () => {
    expect(source).not.toMatch(/addEventListener\("scroll"/);
    expect(source).not.toMatch(/onscroll/);
  });

  it("gives up quietly where it cannot observe anything", () => {
    // an IntersectionObserver is not guaranteed to exist, and the bar has to
    // survive that: the page works with the bar clear
    expect(source).toMatch(/IntersectionObserver/);
    expect(source).toMatch(/typeof document !== "undefined"/);
  });

  it("turns the bar solid once the page moves, and clear again at the top", async () => {
    const dom = new JSDOM('<body><header class="topbar"></header></body>');
    const { document } = dom.window;

    let observe = null;
    globalThis.document = document;
    globalThis.IntersectionObserver = class {
      constructor(callback) {
        observe = callback;
      }
      observe() {}
    };

    vi.resetModules();
    await import("../bar.js");

    const bar = () => document.querySelector(".topbar").classList.contains("topbar--solid");
    expect(observe, "the bar should be observing something").toBeTruthy();
    expect(bar()).toBe(false);

    observe([{ isIntersecting: false }]);
    expect(bar()).toBe(true);

    observe([{ isIntersecting: true }]);
    expect(bar()).toBe(false);

    delete globalThis.document;
    delete globalThis.IntersectionObserver;
  });
});
