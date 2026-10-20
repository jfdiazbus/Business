// The promise the search engine sees, and the one a keyboard sees, checked
// against the browser instead of a parsed document.
//
// Only serious and critical findings fail: axe reports plenty of advice, and a
// suite that fails on advice stops being run.

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = [
  { path: "/", name: "the world" },
  { path: "/home", name: "the portfolio" },
  { path: "/school", name: "the school page" },
  { path: "/services", name: "the prices" },
  { path: "/terms", name: "the terms" },
  { path: "/thanks", name: "the thank you page" },
  { path: "/login", name: "the login page" },
  { path: "/register", name: "the register page" },
  { path: "/blog", name: "the blog" },
];

for (const { path, name } of PAGES) {
  test(`${name} has no serious accessibility violation`, async ({ page }) => {
    // Motion is optional on this site, and the reveal animations fade cards in.
    // Scanning the settled state is the honest check: a transient opacity is
    // not a contrast decision.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    await page.waitForLoadState("load");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );

    expect(
      serious,
      serious
        .map(
          (violation) =>
            `${violation.id}: ${violation.help} (${violation.nodes.length} nodes, first: ${violation.nodes[0]?.target.join(" ")})`,
        )
        .join("\n"),
    ).toEqual([]);
  });
}

test("the top bar can be reached without a mouse", async ({ page }) => {
  await page.goto("/services");
  await page.keyboard.press("Tab");

  await expect(page.locator("a.skip")).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#services$/);
});
