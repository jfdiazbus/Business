// The portfolio page: what it says, how it is marked up, and what it must not
// grow back into. It used to be a five slide deck; it is a document page now,
// and a few checks here exist purely to keep the deck from creeping back.

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(PROJECT_ROOT, file), "utf8");
const html = read("home.html");
const document = new JSDOM(html).window.document;

/** Every page this site serves, so a link can be checked without a server. */
const ROUTES = {
  "/": "world.html",
  "/home": "home.html",
  "/school": "school.html",
  "/services": "services.html",
  "/thanks": "thanks.html",
  "/terms": "terms.html",
};

const text = (node) => node.textContent.replace(/\s+/g, " ").trim();
const section = (id) => document.getElementById(id);

describe("the portfolio page", () => {
  it("introduces itself for a reader and for a link preview", () => {
    const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.content;

    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(document.title).toContain("Juan Felipe Diaz Bustamante");
    expect(meta("description").length).toBeGreaterThan(40);
    expect(meta("color-scheme")).toBe("dark");
    expect(document.querySelector('meta[property="og:title"]')).toBeTruthy();
    expect(document.querySelector('link[rel="icon"]')).toBeTruthy();
  });

  it("has exactly one h1, and it says what the page is", () => {
    const headings = document.querySelectorAll("h1");

    expect(headings).toHaveLength(1);
    expect(text(headings[0])).toBe("Websites, presentations and small tools");
    // the name lives in the bar, which is on every page
    expect(document.querySelector(".brand").textContent).toContain("Juan Felipe Diaz Bustamante");
  });

  it("keeps its landmarks and heading levels in order", () => {
    const landmarks = [...document.querySelectorAll("header, main, footer")].map((el) =>
      el.tagName.toLowerCase(),
    );

    expect(landmarks).toEqual(["header", "main", "footer"]);

    const levels = [...document.querySelectorAll("h1, h2, h3")].map((h) => Number(h.tagName[1]));
    expect(levels.filter((level) => level === 1)).toHaveLength(1);

    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i] - levels[i - 1], `heading ${i}`).toBeLessThanOrEqual(1);
    }
  });

  it("lets a keyboard visitor skip to the content", () => {
    const skip = document.querySelector("a.skip");

    expect(skip).toBeTruthy();
    expect(document.getElementById(skip.getAttribute("href").slice(1))).toBeTruthy();
  });

  it("has the four sections the site is organised by", () => {
    const sections = [...document.querySelectorAll("main > section.block")];

    expect(sections.map((s) => s.id)).toEqual(["experience", "education", "projects", "contact"]);

    for (const id of ["experience", "education", "projects", "contact"]) {
      const heading = document.querySelector(`#${id} > .heading`);
      expect(heading, id).toBeTruthy();
      expect(text(heading).toLowerCase(), id).toContain(id);
    }
  });

  it("says where I have worked, and what I am good at", () => {
    const rows = [...section("experience").querySelectorAll(".werk-row")];

    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(text(section("experience"))).toContain("MigaLabs");
    expect(text(section("experience"))).toMatch(/Alvatroz/);
    expect(section("experience").querySelectorAll(".leader").length).toBeGreaterThanOrEqual(3);
  });

  it("says where I studied, and points at the long version", () => {
    const education = text(section("education"));

    expect(education).toContain("Epitech");
    expect(education).toMatch(/2025/);
    expect(section("education").querySelector('a[href="/school"]')).toBeTruthy();
  });

  it("shows four things I built, each with a title and a description", () => {
    const projects = [...section("projects").querySelectorAll(".project")];

    expect(projects).toHaveLength(4);

    for (const project of projects) {
      expect(text(project.querySelector("h3")).length).toBeGreaterThan(2);
      expect(text(project.querySelector("p")).length).toBeGreaterThan(20);
    }
  });

  it("sells nothing and links no client site from the work", () => {
    // the projects are mine; the client sites are not advertised here
    const links = [...section("projects").querySelectorAll("a[href^='http']")];

    expect(links).toEqual([]);
    expect(text(section("projects")).toLowerCase()).not.toContain("omniprompt");
  });

  it("leaves one way to get in touch, and one way to the prices", () => {
    const contact = section("contact");

    expect(contact.querySelector('a[href^="mailto:"]')).toBeTruthy();
    expect(contact.querySelector('a[href="/services"]')).toBeTruthy();
    expect(contact.querySelectorAll(".leader").length).toBeGreaterThanOrEqual(4);
    expect(text(contact)).toContain("linkedin");
  });

  it("sends every internal link somewhere this site serves", () => {
    for (const link of document.querySelectorAll("a[href]")) {
      const href = link.getAttribute("href");

      expect(text(link).length, "a link with no words cannot be read out").toBeGreaterThan(0);
      expect(href, text(link)).not.toBe("#");

      if (href.startsWith("#")) {
        expect(document.getElementById(href.slice(1)), href).toBeTruthy();
        continue;
      }
      if (!href.startsWith("/")) continue;

      const route = href.split("#")[0].split("?")[0];
      expect(ROUTES[route], `${href} is not a route this site serves`).toBeTruthy();
      expect(existsSync(path.join(PROJECT_ROOT, ROUTES[route])), href).toBe(true);
    }
  });

  it("does not talk like a terminal", () => {
    for (const jargon of ["drwxr-xr-x", "-rw-r--r--", "$ ls", "whoami", "~/projects", "$ cat"]) {
      expect(html, jargon).not.toContain(jargon);
    }
  });

  it("keeps ascii art out of the page", () => {
    expect(document.querySelector(".banner")).toBeNull();
    expect(document.querySelector("pre")).toBeNull();
  });

  it("stays a page, and does not grow back into a deck", () => {
    for (const leftover of [".slide", ".slide-top", ".count", ".scroll-hint", ".hero"]) {
      expect(document.querySelector(leftover), leftover).toBeNull();
    }

    expect(html).not.toContain("scroll-snap");
    expect(read("style.css")).not.toContain("scroll-snap-type");
  });

  it("keeps the copy on the house rules", () => {
    const copy = [...document.querySelectorAll("h1, h2, h3, p, li")]
      .filter((node) => !node.closest("footer") && !node.classList.contains("leader"))
      .map(text)
      .join(" ")
      .replace(/[\w.-]+@[\w.-]+/g, "")
      .toLowerCase();

    expect(copy).not.toMatch(/\w-\w/); // no hyphens inside sentences
    for (const cliche of ["elevate", "seamless", "unleash", "next gen", "game changer", "delve"]) {
      expect(copy, cliche).not.toContain(cliche);
    }
  });

  it("loads one small script, and no frameworks", () => {
    const scripts = [...document.querySelectorAll("script[src]")];

    expect(scripts.map((script) => script.getAttribute("src"))).toEqual(["/bar.js"]);
    expect(scripts[0].getAttribute("type")).toBe("module");
  });
});
