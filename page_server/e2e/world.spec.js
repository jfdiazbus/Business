// The one thing jsdom cannot see: the five scene film actually mounting and
// moving when someone scrolls.

import { expect, test } from "@playwright/test";

test("the world mounts, offers a route, and moves on a scroll", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");

  await expect(page.locator("#world")).toBeVisible();
  await expect(page.locator(".sw-route__dot")).toHaveCount(5);
  await expect(page.locator(".sw-route__dot.is-active")).toHaveCount(1);

  const first = await page.locator(".sw-route__dot.is-active").evaluate((dot) => dot.textContent);

  await page.mouse.move(600, 400);
  await page.mouse.wheel(0, 900);

  // The engine scrolls with `behavior: smooth`, so the position settles rather
  // than jumping.
  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await expect
    .poll(async () => page.locator(".sw-route__dot.is-active").evaluate((dot) => dot.textContent))
    .not.toBe(first);

  expect(errors).toEqual([]);
});
