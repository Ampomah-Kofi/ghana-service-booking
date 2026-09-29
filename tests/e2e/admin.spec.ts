import { expect, test, type Page } from "@playwright/test";
import {
  createPublishedBusiness,
  createTestUser,
  deleteTestUser,
  makeAdmin,
  type TestBusiness,
  type TestUser,
} from "./support/admin";

/**
 * Critical flow (Phase 10): a moderator finds a business on a phone, suspends it with a reason
 * (it disappears for customers), restores it, and the audit log shows both. The owner's Insights
 * screen opens with its period switch.
 */
let moderator: TestUser;
let owner: TestUser;
let business: TestBusiness;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  moderator = await createTestUser("Mo Moderator");
  owner = await createTestUser("Adwoa Owner");
  await makeAdmin(moderator, "moderator");
  business = await createPublishedBusiness(owner, "Adwoa Nail Bar");
});

test.afterAll(async () => {
  if (owner) await deleteTestUser(owner);
  if (moderator) await deleteTestUser(moderator);
});

async function signIn(page: Page, user: TestUser, next: string) {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByRole("link", { name: "Use email instead" }).click();
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === next);
}

test("a moderator suspends and restores a business, and the audit log shows it", async ({ page, request }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await signIn(page, moderator, "/admin");
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();

  await page.goto("/admin/businesses");
  await page.getByRole("searchbox", { name: "Search businesses" }).fill("Adwoa Nail");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("link", { name: /Adwoa Nail Bar/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Adwoa Nail Bar" })).toBeVisible();

  await page.getByRole("button", { name: "Suspend business" }).click();
  await expect(page.getByText("Give a reason (it goes in the audit log).")).toBeVisible();
  await page.getByLabel("Reason (audit log)").fill("Fake photos reported");
  await page.getByRole("button", { name: "Suspend business" }).click();
  await expect(page.getByText("Suspended and logged.")).toBeVisible();
  expect((await request.get(`/business/${business.slug}`)).status()).toBe(404);

  await page.reload();
  await page.getByLabel("Reason (audit log)").fill("Owner sent real photos");
  await page.getByRole("button", { name: "Restore business" }).click();
  await expect(page.getByText(/Restored \(published\) and logged\./)).toBeVisible();
  expect((await request.get(`/business/${business.slug}`)).status()).toBe(200);

  await page.goto("/admin/audit?action=business");
  await expect(page.getByText("Owner sent real photos")).toBeVisible();
  await expect(page.getByText("Fake photos reported")).toBeVisible();
});

test("the owner opens Insights and switches the period; staff-only pages stay closed to others", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await signIn(page, owner, `/dashboard/${business.id}/insights`);
  await expect(page.getByRole("heading", { level: 1, name: "Insights" })).toBeVisible();
  await page.getByRole("link", { name: "3 months" }).click();
  await expect(page).toHaveURL(/days=90/);
  await expect(page.getByRole("link", { name: "3 months" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("No bookings in this period yet.")).toBeVisible();
  // Not an admin: the admin area doesn't exist for them.
  expect((await page.goto("/admin"))?.status()).toBe(404);
});
