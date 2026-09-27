import { expect, test } from "@playwright/test";

/** A customer finds a provider without an account (read-only; uses seed data). */
test("search from the home page and open a provider", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Recently joined" })).toBeVisible();

  await page.getByRole("searchbox", { name: /Search for a service/ }).fill("Barber in East Legon");
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect(page).toHaveURL(/\/search\?q=Barber\+in\+East\+Legon/);
  await expect(page.getByRole("heading", { level: 1, name: "Barbers in East Legon, Accra" })).toBeVisible();
  await expect(page.getByText("1 result")).toBeVisible();
  await page.getByRole("link", { name: /Kwame Cuts/ }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Kwame Cuts" })).toBeVisible();
  await expect(page.getByText("Skin fade")).toBeVisible();
  await expect(page.getByText("GH₵ 80")).toBeVisible();
});

test("a town with no matches explains itself instead of showing nothing", async ({ page }) => {
  await page.goto("/search?q=Braids+in+Accra");
  await expect(page.getByRole("status").filter({ hasText: "No braids & locs in Accra yet" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Ama Braids Studio/ })).toBeVisible();
});

test("category pages filter by town", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Photography", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Photography" })).toBeVisible();
  await page.getByRole("link", { name: "Kumasi", exact: true }).click();
  await expect(page).toHaveURL(/town=Kumasi/);
  await expect(page.getByRole("link", { name: /Lens by Kofi/ })).toBeVisible();
  await page.getByRole("link", { name: "Tamale", exact: true }).click();
  await expect(page.getByText("No photography in Tamale yet. Here are other places.")).toBeVisible();
});

test("public pages never scroll sideways on a small phone (360px)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  for (const url of [
    "/",
    "/search?q=Barber+in+East+Legon",
    "/search?q=Braids+in+Accra",
    "/categories/nails",
    "/business/ama-braids",
    "/business/ama-braids/book",
    "/sign-in",
  ]) {
    await page.goto(url);
    const [scrollWidth, viewport] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    expect(scrollWidth, `${url} overflows horizontally`).toBeLessThanOrEqual(viewport);
  }
});
