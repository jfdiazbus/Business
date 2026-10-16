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

    expect(topbar).toContain("position: fixed");
    expect(topbar).toMatch(/z-index: \d/);
    // the background arrives with the scrolled state, so the bar can start clear
    expect(ruleBody(css, ".topbar--solid")).toContain("background");
  });

  it("centres a slide without cropping one that is taller than the screen", () => {
    // auto margins, not justify-content: center, which clips the overflow
    expect(css).toMatch(/\.slide > \.rule:first-child\s*\{[^}]*margin-block: auto/);
    expect(css).not.toMatch(/\.slide\s*\{[^}]*justify-content: center/);
  });

  it("shortens the bar on small screens", () => {
    const small = blocks(css, /@media\s*\(max-width:\s*767px\)\s*\{/)[0].body;

    expect(small).toContain("--bar-h");
  });

  it("scrolls a long nav sideways rather than wrapping it", () => {
    expect(ruleBody(css, ".topbar nav")).toContain("overflow-x: auto");
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

  it("draws its hairlines and reveals its sections as you scroll", () => {
    const [scroll] = blocks(css, SUPPORTS);
    const motion = blocks(scroll.body, MOTION)[0].body;

    expect(motion).toContain(".rule");
    expect(motion).toContain("wipe-x");
    expect(motion).toContain("animation-timeline: view()");
  });

  it("has no tractor feed, print head or ascii ruler left over", () => {
    for (const gone of [".sprocket", "--dots", "print head", "===="]) {
      expect(css, gone).not.toContain(gone);
    }
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

    for (const selector of [".rule", ".heading", ".project", ".leader", ".werk-row"]) {
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

describe("the design tokens", () => {
  const tokens = Object.fromEntries(
    [...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );

  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };

  const contrast = (one, other) => {
    const [lighter, darker] = [luminance(one), luminance(other)].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
  };

  it("defines every token it uses", () => {
    const defined = new Set([...css.matchAll(/--([a-z0-9-]+)\s*:/g)].map((match) => match[1]));
    const used = new Set([...css.matchAll(/var\(--([a-z0-9-]+)/g)].map((match) => match[1]));

    expect([...used].filter((name) => !defined.has(name))).toEqual([]);
  });

  it("keeps every word legible on the background", () => {
    expect(tokens.bg, "no background token").toBeTruthy();

    for (const name of ["ink", "ink-soft", "accent"]) {
      expect(contrast(tokens[name], tokens.bg), name).toBeGreaterThanOrEqual(4.5);
    }

    // the faint tone is for marks like the little list dots, never for sentences
    expect(contrast(tokens["ink-faint"], tokens.bg)).toBeGreaterThanOrEqual(3);
  });

  it("keeps backgrounds flat and type upright", () => {
    expect(css).not.toMatch(/background[^;{}]*gradient/i);
    expect(css).not.toContain("font-style: italic");
    expect(css).not.toMatch(/font-weight:\s*(800|900)/);
  });

  it("takes its sizes from the type scale", () => {
    const sizes = [...css.matchAll(/--fs-[a-z0-9]+:\s*(\d+)px/g)].map((match) => Number(match[1]));

    expect(sizes.sort((a, b) => a - b)).toEqual([12, 14, 16, 18, 20, 24, 30, 36, 48, 60]);
  });
});
