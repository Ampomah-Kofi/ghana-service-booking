import { devices, expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * Critical flow (roadmap Phase 6): a provider on a phone adds a walk-in in three taps,
 * completes it, and sees it on Today. Signs in once (the OTP rate limit is real) as the
 * seed barber, Kwame, with the local test OTP from supabase/config.toml.
 */
const KWAME_CUTS = "/dashboard/b0000000-0000-4000-8000-000000000001";

test.describe.configure({ mode: "serial" });

let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser, baseURL }) => {
  context = await browser.newContext({ ...devices["Pixel 7"], baseURL });
  page = await context.newPage();
  await page.goto(KWAME_CUTS);
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByLabel("Phone number").fill("020 000 0001");
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("Verification code").fill("123456");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
});

test.afterAll(async () => {
  await context?.close();
});

test("provider adds a walk-in and completes it", async () => {
  // Tap 1: "+", tap 2: Walk-in, tap 3: the service, then start.
  await page.locator('summary[aria-label="Add"]').click();
  await page.getByRole("link", { name: /Walk-in Someone is here now/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add walk-in" })).toBeVisible();
  await page.getByText("Beard trim").click();
  await expect(page.getByRole("radio", { name: /Beard trim/ })).toBeChecked();
  await page.getByRole("button", { name: "Start walk-in" }).click();

  await expect(page).toHaveURL(/\/calendar\?date=.*&added=/);
  await expect(page.getByText("Appointment added")).toBeVisible();
  const id = new URL(page.url()).searchParams.get("added");
  await page.goto(`${KWAME_CUTS}/appointments/${id}`);

  await expect(page.getByRole("heading", { level: 1, name: "Walk-in" })).toBeVisible();
  await expect(page.getByText("Arrived", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Complete" }).click();
  await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo complete" })).toBeVisible();

  await page.getByRole("navigation", { name: "Business" }).last().getByRole("link", { name: "Today" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Walk-in/ }).first()).toBeVisible();
});

test("the calendar's day, week and month views load, and nothing scrolls sideways at 360 px", async () => {
  await page.setViewportSize({ width: 360, height: 780 });
  for (const view of ["", "?view=week", "?view=month"]) {
    await page.goto(`${KWAME_CUTS}/calendar${view}`);
    await expect(page.getByRole("navigation", { name: "Calendar view" })).toBeVisible();
    const [scrollWidth, width] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(scrollWidth, `calendar${view} overflows`).toBeLessThanOrEqual(width);
  }
});
