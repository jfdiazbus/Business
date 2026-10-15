// Guards the page layout and the scroll-driven printing: every animation has
// to be optional for motion, and the scroll timelines have to degrade to a
// static — but complete — page in browsers that do not support them.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(path.join(PROJECT_ROOT, "style.css"), "utf8");

const MOTION = /@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{/;
const SUPPORTS = /@supports\s*\(animation-timeline:\s*view\(\)\)\s*\{/;

/** The bodies of every block whose opening line matches `opener`. */
function blocks(source, opener) {
  const found = [];
  const pattern = new RegExp(opener.source, "g");
  let match;

  while ((match = pattern.exec(source)) !== null) {
    const open = match.index + match[0].length - 1;
    let depth = 0;

    for (let i = open; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          found.push({ start: match.index, end: i, body: source.slice(open + 1, i) });
          pattern.lastIndex = i + 1;
          break;
        }
      }
    }
  }

  return found;
}

/** The stylesheet with those blocks taken out. */
function without(source, opener) {
  let out = "";
  let cursor = 0;

  for (const block of blocks(source, opener)) {
    out += source.slice(cursor, block.start);
    cursor = block.end + 1;
  }

  return out + source.slice(cursor);
}

/** The declarations of a rule, by selector. */
function ruleBody(source, selector) {
  const opening = `${selector} {`;
  const start = source.indexOf(opening);
  if (start === -1) return null;

  const from = start + opening.length - 1;
  let depth = 0;

  for (let i = from; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(from + 1, i);
    }
  }

  return null;
}

describe("the page fills the screen", () => {
  it("lets the paper span the whole width", () => {
    expect(ruleBody(css, ".sheet")).not.toContain("max-width");
  });

  it("pins the sprocket strips to the viewport, so the paper can feed", () => {
    const sprocket = ruleBody(css, ".sprocket");

    expect(sprocket).toContain("position: fixed");
    expect(sprocket).toContain("pointer-events: none");
  });

  it("keeps the words in a centred column", () => {
    const page = ruleBody(css, ".page");

    expect(page).toContain("margin: 0 auto");
    expect(page).toContain("max-width: var(--page-max)");
  });

  it("gives every slide a screen of its own", () => {
    const slide = ruleBody(css, ".slide");

    expect(slide).toMatch(/min-block-size: 100(s?v)h/);
    expect(slide).toContain("scroll-snap-align: start");
    expect(slide).toContain("padding-block");
  });

  it("keeps the name and nav reachable from every slide", () => {
    const topbar = ruleBody(css, ".topbar");

    expect(topbar).toContain("position: sticky");
    expect(topbar).toMatch(/z-index: \d/);
    expect(topbar).toContain("background");
  });

  it("centres a slide without cropping one that is taller than the screen", () => {
    // auto margins, not justify-content: center, which clips the overflow
    expect(css).toMatch(/\.slide > \.rule:first-child\s*\{[^}]*margin-block: auto/);
    expect(css).not.toMatch(/\.slide\s*\{[^}]*justify-content: center/);
  });

  it("hides the decorative strips on small screens", () => {
    const small = blocks(css, /@media\s*\(max-width:\s*639px\)\s*\{/)[0].body;

    expect(small).toContain(".sprocket");
    expect(small).toContain("display: none");
  });
});

describe("the scroll animations", () => {
  it("never animates for someone who asked for less motion", () => {
    const unguarded = without(css, MOTION);

    expect(unguarded).not.toMatch(/^\s*animation\s*:\s*(?!none\b)[\w-]+/m);
    expect(unguarded).not.toMatch(/^\s*animation-timeline\s*:/m);
    expect(unguarded).not.toMatch(/^\s*animation-range\s*:/m);
  });

  it("shows the whole page when it is printed, scroll states and all", () => {
    const print = blocks(css, /@media\s*print\s*\{/)[0].body;

    expect(print).toMatch(/animation:\s*none\s*!important/);
    expect(print).toContain(".scroll-hint");
  });

  it("prints a stack of pages, not a stack of screens", () => {
    const print = blocks(css, /@media\s*print\s*\{/)[0].body;

    expect(print).toMatch(/\.slide\s*\{[^}]*min-block-size: 0/);
    expect(print).toMatch(/\.topbar\s*\{[^}]*position: static/);
  });

  it("snaps between slides, and not at all for someone who would rather scroll freely", () => {
    const snapping = blocks(css, MOTION)[0].body;
    const calm = blocks(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/)[0].body;

    expect(snapping).toContain("scroll-snap-type: y proximity");
    expect(calm).toContain("scroll-snap-type: none");
  });

  it("never uses a scroll timeline where it is not supported", () => {
    const unguarded = without(css, SUPPORTS);

    expect(unguarded).not.toMatch(/^\s*animation-timeline\s*:/m);
  });

  it("feeds the paper and rides a print head down the edge", () => {
    const [scroll] = blocks(css, SUPPORTS);
    const motion = blocks(scroll.body, MOTION)[0].body;

    expect(motion).toContain(".sprocket::before");
    expect(motion).toContain(".sprocket::after");
    expect(motion).toContain("animation-timeline: scroll(root block)");
    expect(motion).toContain("animation-timeline: view()");
  });

  it("only shows the print head where the timeline works", () => {
    const outside = without(css, SUPPORTS);

    expect(outside).not.toContain(".sprocket::after");
  });

  it("uses keyframes that exist", () => {
    const used = [...css.matchAll(/animation:\s*([\w-]+)/g)]
      .map((match) => match[1])
      .filter((name) => name !== "none");
    const defined = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1]);

    expect(used.length).toBeGreaterThan(3);
    for (const name of new Set(used)) {
      expect(defined, name).toContain(name);
    }
  });

  it("declares the timeline after the animation shorthand, which resets it", () => {
    const [scroll] = blocks(css, SUPPORTS);
    const motion = blocks(scroll.body, MOTION)[0].body;

    for (const rule of motion.matchAll(/animation:\s*[\w-]+[^;]*;[\s\S]*?(?=})/g)) {
      const shorthand = rule[0].indexOf("animation:");
      const timeline = rule[0].indexOf("animation-timeline:");
      expect(timeline, rule[0].slice(0, 40)).toBeGreaterThan(shorthand);
    }
  });

  it("prints itself by scrolling in every section", () => {
    const [scroll] = blocks(css, SUPPORTS);
    const motion = blocks(scroll.body, MOTION)[0].body;

    for (const selector of [".rule", ".heading", ".project h3", ".project p", ".leader .fill"]) {
      expect(motion, selector).toContain(selector);
    }
  });

  it("lets the scroll cue leave once the page moves", () => {
    const [scroll] = blocks(css, SUPPORTS);
    const motion = blocks(scroll.body, MOTION)[0].body;

    expect(motion).toContain(".scroll-hint");
    expect(motion).toMatch(/animation-range:\s*0%\s*10%/);
  });
});
