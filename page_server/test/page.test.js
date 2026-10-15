import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { renderBanner } from "../scripts/banner.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(path.join(PROJECT_ROOT, "page.html"), "utf8");
const { document } = new JSDOM(html).window;

describe("page.html", () => {
  it("introduces the page with a title, a language and a description", () => {
    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(document.title).toContain("Juan Felipe");
    expect(document.querySelector('meta[name="description"]')?.content.length).toBeGreaterThan(40);
    expect(document.querySelector('meta[name="viewport"]')).toBeTruthy();
  });

  it("has exactly one h1, and it names the developer", () => {
    const headings = document.querySelectorAll("h1");

    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toContain("Juan Felipe Diaz Bustamante");
  });

  it("builds the banner from real figlet art", () => {
    const lines = [...document.querySelectorAll(".banner .line")].map((line) =>
      line.textContent.replace(/[ \t]+$/, ""),
    );

    expect(lines).toEqual(renderBanner());
    expect(lines.length).toBeGreaterThan(3);
  });

  it("skips the decoration for screen readers", () => {
    const banner = document.querySelector(".banner");

    expect(banner.getAttribute("aria-hidden")).toBe("true");
    expect(document.querySelector('.skip[href="#work"]')).toBeTruthy();
    expect(document.getElementById("work")).toBeTruthy();
  });

  it("does not talk like a terminal", () => {
    for (const jargon of ["drwxr-xr-x", "-rw-r--r--", "$ ls", "whoami", "~/projects", "$ cat"]) {
      expect(html, jargon).not.toContain(jargon);
    }
  });

  it("shows three projects, each with a title and a description", () => {
    const projects = [...document.querySelectorAll(".project")];

    expect(projects).toHaveLength(3);

    for (const project of projects) {
      expect(project.querySelector("h3")?.textContent.trim().length).toBeGreaterThan(0);
      expect(project.querySelector("p")?.textContent.trim().length).toBeGreaterThan(20);
    }
  });

  it("links the two client sites from the right place", () => {
    const hrefs = [...document.querySelectorAll(".project a")].map((link) =>
      link.getAttribute("href"),
    );

    expect(hrefs).toContain("/projects/omniprompt-marketing/index.html");
    expect(hrefs).toContain("/projects/promptops-ai/pitch.html");
  });

  it("points every nav link at a section that exists", () => {
    const navLinks = [...document.querySelectorAll(".topbar nav a")];

    expect(navLinks.map((link) => link.getAttribute("href"))).toEqual([
      "#work",
      "#about",
      "#contact",
    ]);

    for (const link of navLinks) {
      expect(document.getElementById(link.getAttribute("href").slice(1))).toBeTruthy();
    }
  });

  it("keeps heading levels in order", () => {
    const levels = [...document.querySelectorAll("h1, h2, h3")].map((heading) =>
      Number(heading.tagName.slice(1)),
    );

    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i] - levels[i - 1], `after ${levels[i - 1]}`).toBeLessThanOrEqual(1);
    }
  });

  it("gives every link words a person can read", () => {
    for (const link of document.querySelectorAll("a")) {
      expect(link.textContent.trim().length, link.outerHTML.slice(0, 60)).toBeGreaterThan(0);
    }
  });

  it("offers a way to get in touch", () => {
    const mailto = document.querySelector('a[href^="mailto:"]');

    expect(mailto?.getAttribute("href")).toContain("@");
    expect(document.querySelector('a[href^="https://github.com/"]')).toBeTruthy();
  });

  it("describes its skills and contact details in plain rows", () => {
    const leaders = [...document.querySelectorAll(".leader")];

    expect(leaders.length).toBeGreaterThanOrEqual(6);

    for (const row of leaders) {
      expect(row.querySelector(".k")?.textContent.trim().length).toBeGreaterThan(0);
      expect(row.querySelector(".v")?.textContent.trim().length).toBeGreaterThan(0);
    }
  });

  it("tells the visitor there is more to scroll to, without nagging a screen reader", () => {
    const hint = document.querySelector(".scroll-hint");

    expect(hint?.getAttribute("aria-hidden")).toBe("true");
    expect(hint.textContent).toContain("scrolling");
    expect(hint.closest(".hero")).toBeTruthy();
  });

  it("is a deck: four slides, each numbered after the title page", () => {
    const slides = [...document.querySelectorAll("main > .slide")];

    expect(slides).toHaveLength(4);
    expect(slides[0].classList.contains("hero")).toBe(true);

    slides.slice(1).forEach((slide, index) => {
      const count = slide.querySelector(":scope > .slide-top .count");

      expect(slide.querySelector(":scope > .rule"), slide.id).toBeTruthy();
      expect(count.textContent.replace(/\s+/g, " ").trim()).toBe(`${index + 2} / 4`);
    });
  });

  it("ends the deck on the contact slide", () => {
    const last = document.querySelector("main > .slide:last-of-type");

    expect(last.id).toBe("contact");
    expect(last.querySelector("footer .eof").textContent).toContain("Thanks for reading");
    expect(last.querySelector("footer .colophon")).toBeTruthy();
  });

  it("loads one small module, and no frameworks", () => {
    const scripts = [...document.querySelectorAll("script[src]")];

    expect(scripts.map((script) => script.getAttribute("src"))).toEqual(["slides.js"]);
    expect(scripts[0].getAttribute("type")).toBe("module");
  });
});
