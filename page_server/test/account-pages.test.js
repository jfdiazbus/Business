// The account pages: sign in, registration and the account itself.
//
// These checks are about what the page promises a reader: one clear heading,
// labelled fields, a form that asks the browser for the right autofill, and no
// inline script. The server side is in accounts.test.js.

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(PROJECT_ROOT, file), "utf8");
const render = (file) => new JSDOM(read(file)).window.document;

const pages = {
  "login.html": render("login.html"),
  "register.html": render("register.html"),
  "account.html": render("account.html"),
};

const text = (node) => node.textContent.replace(/\s+/g, " ").trim();

describe("the account pages", () => {
  it("each has a title, one heading, a description, and stays out of search", () => {
    for (const [file, page] of Object.entries(pages)) {
      expect(page.title, file).toContain("Juan Felipe Diaz Bustamante");
      expect(page.querySelectorAll("h1"), file).toHaveLength(1);
      expect(page.querySelector('meta[name="description"]')?.content.length, file).toBeGreaterThan(
        20,
      );
      expect(page.querySelector('meta[name="robots"]')?.content, file).toContain("noindex");
    }
  });

  it("puts the account link in the site navigation", () => {
    for (const [file, page] of Object.entries(pages)) {
      expect(
        page.querySelector('.topbar nav a[data-account-link][href="/login"]'),
        file,
      ).toBeTruthy();
      expect(page.querySelector('.topbar nav a[href="/services"]'), file).toBeTruthy();
      expect(page.querySelector('.topbar nav a[href="/blog"]'), file).toBeTruthy();
    }
  });

  it("labels every field and asks the browser for the right autofill", () => {
    const login = pages["login.html"].querySelector("#login-form");
    expect(login.querySelector('input[type="email"][autocomplete="email"]')).toBeTruthy();
    expect(
      login.querySelector('input[type="password"][autocomplete="current-password"]'),
    ).toBeTruthy();
    expect(login.querySelector("button[type='submit']")?.textContent).toBe("Sign in");

    const register = pages["register.html"].querySelector("#register-form");
    expect(register.querySelector('input[name="name"]')).toBeTruthy();
    expect(register.querySelector('input[type="email"]')).toBeTruthy();
    expect(
      register.querySelector('input[type="password"][autocomplete="new-password"][minlength="10"]'),
    ).toBeTruthy();
    expect(register.querySelector("button[type='submit']")?.textContent).toBe("Create account");

    for (const page of Object.values(pages)) {
      for (const input of page.querySelectorAll("input")) {
        expect(page.querySelector(`label[for="${input.id}"]`), input.id).toBeTruthy();
      }
    }
  });

  it("loads the bar and the account script, and nothing inline", () => {
    for (const [file, page] of Object.entries(pages)) {
      expect(
        [...page.querySelectorAll("script[src]")].map((script) => script.getAttribute("src")),
        file,
      ).toEqual(["/bar.js", "/account.js"]);
      expect(page.querySelectorAll("script:not([src])"), file).toHaveLength(0);
    }
  });

  it("has the account actions the script wires up", () => {
    const account = pages["account.html"];
    expect(account.querySelector("#account-signed-out")).toBeTruthy();
    expect(account.querySelector("#account-signed-in")).toBeTruthy();
    expect(account.querySelector("#account-orders")).toBeTruthy();
    expect(account.querySelector("#password-form")).toBeTruthy();
    expect(account.querySelector("#logout-button")).toBeTruthy();
    expect(account.querySelector("#delete-form")).toBeTruthy();
    expect(account.querySelector("noscript")).toBeTruthy();
  });

  it("is built, rewritten by the Node server, and described in the terms", () => {
    const build = read("scripts/build.mjs");
    const server = read("index.js");
    const terms = read("terms.html");

    for (const file of ["login.html", "register.html", "account.html", "account.js"]) {
      expect(build, file).toContain(`"${file}"`);
      expect(existsSync(path.join(PROJECT_ROOT, file)), file).toBe(true);
    }

    for (const [route, file] of [
      ["/login", "login.html"],
      ["/register", "register.html"],
      ["/account", "account.html"],
    ]) {
      expect(server, route).toContain(`"${route}": "${file}"`);
    }

    expect(terms).toContain('id="accounts-title"');
    expect(text(new JSDOM(terms).window.document.querySelector("#accounts-title"))).toContain(
      "Accounts and comments",
    );
  });
});
