// bar.js — the bar, the phone menu, and the rules the file has to keep.
//
// The point of this script is partly what it does not do. A scroll listener
// would fire on every frame and force layout while the visitor is scrolling, so
// the solid state is driven by an observed sentinel instead. The menu is an
// enhancement too: without this file the nav stays a plain row of links.

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { hasScrolledPast } from "../bar.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(PROJECT_ROOT, "bar.js"), "utf8");

const BAR = `
  <header class="topbar">
    <a class="brand" href="/">Juan Felipe</a>
    <nav id="topbar-nav" aria-label="site">
      <a href="/home">Portfolio</a>
      <a href="/services">Services</a>
      <a href="/school">School</a>
    </nav>
    <a class="btn btn--primary" href="/services">See services</a>
    <button
      class="topbar__menu"
      type="button"
      aria-expanded="false"
      aria-controls="topbar-nav"
      aria-label="Menu"
    >
      <span class="topbar__bars" aria-hidden="true"></span>
    </button>
  </header>`;

/** Loads bar.js against a fresh document, with an observer we can drive. */
async function loadBar(html = BAR) {
  const dom = new JSDOM(`<body>${html}</body>`);
  const observers = [];

  globalThis.document = dom.window.document;
  globalThis.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }
    observe() {}
  };

  vi.resetModules();
  await import("../bar.js");

  const { document, KeyboardEvent } = dom.window;

  return {
    document,
    KeyboardEvent,
    observers,
    bar: document.querySelector(".topbar"),
    restore() {
      delete globalThis.document;
      delete globalThis.IntersectionObserver;
    },
  };
}

describe("bar.js", () => {
  it("reads a sentinel leaving the viewport as the page having moved", () => {
    expect(hasScrolledPast({ isIntersecting: true })).toBe(false);
    expect(hasScrolledPast({ isIntersecting: false })).toBe(true);
  });

  it("never listens to scroll events", () => {
    expect(source).not.toMatch(/addEventListener\("scroll"/);
    expect(source).not.toMatch(/onscroll/);
  });

  it("gives up quietly where the browser has no observer and no matchMedia", () => {
    expect(source).toMatch(/typeof view\.IntersectionObserver !== "function"/);
    expect(source).toMatch(/typeof view\.matchMedia === "function"/);
  });

  it("turns the bar solid once the page moves, and clear again at the top", async () => {
    const { bar, observers, restore } = await loadBar();

    try {
      expect(observers, "the bar should be observing something").toHaveLength(1);

      const isSolid = () => bar.classList.contains("topbar--solid");
      expect(isSolid()).toBe(false);

      observers[0].callback([{ isIntersecting: false }]);
      expect(isSolid()).toBe(true);

      observers[0].callback([{ isIntersecting: true }]);
      expect(isSolid()).toBe(false);
    } finally {
      restore();
    }
  });

  it("opens the phone menu, and closes it again on Escape", async () => {
    const { bar, document, KeyboardEvent, restore } = await loadBar();

    try {
      const button = bar.querySelector(".topbar__menu");
      const firstLink = bar.querySelector("nav a");

      // the button is only usable once the script has taken it over
      expect(bar.classList.contains("topbar--enhanced")).toBe(true);
      expect(button.getAttribute("aria-expanded")).toBe("false");

      button.click();
      expect(button.getAttribute("aria-expanded")).toBe("true");
      expect(bar.classList.contains("topbar--open")).toBe(true);
      expect(document.body.style.overflow).toBe("hidden");
      expect(document.activeElement).toBe(firstLink);

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(button.getAttribute("aria-expanded")).toBe("false");
      expect(bar.classList.contains("topbar--open")).toBe(false);
      expect(document.body.style.overflow).toBe("");
      expect(document.activeElement).toBe(button);
    } finally {
      restore();
    }
  });

  it("closes the menu when a link in it is followed", async () => {
    const { bar, document, KeyboardEvent, restore } = await loadBar();

    try {
      const button = bar.querySelector(".topbar__menu");

      button.click();
      expect(bar.classList.contains("topbar--open")).toBe(true);

      bar.querySelector("nav a").dispatchEvent(new KeyboardEvent("click", { bubbles: true }));
      expect(bar.classList.contains("topbar--open")).toBe(false);
      expect(document.body.style.overflow).toBe("");
    } finally {
      restore();
    }
  });

  it("leaves a bar without a menu button alone", async () => {
    const { bar, restore } = await loadBar(
      '<header class="topbar"><a class="brand">x</a></header>',
    );

    try {
      expect(bar.classList.contains("topbar--enhanced")).toBe(false);
    } finally {
      restore();
    }
  });
});
