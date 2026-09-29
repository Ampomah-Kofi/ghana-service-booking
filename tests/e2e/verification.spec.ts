import { devices, expect, test, type Page } from "@playwright/test";
import {
  createPublishedBusiness,
  createTestUser,
  deleteTestUser,
  type TestBusiness,
  type TestUser,
} from "./support/admin";

/**
 * The verified check (ADR-0015): an owner applies from More, a platform admin verifies it after
 * checking, customers see the check, and renaming the business takes it away.
 */
let owner: TestUser;
let business: TestBusiness;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  owner = await createTestUser("Yaa Owner");
  business = await createPublishedBusiness(owner, `Yaa Lashes ${Date.now().toString(36)}`);
});

test.afterAll(async () => {
  if (owner) await deleteTestUser(owner);
});

async function signInWithEmail(page: Page, user: TestUser, next: string) {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByRole("link", { name: "Use email instead" }).click();
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === next);
}

test("owner applies, admin verifies, customers see the check", async ({ browser, baseURL, page }) => {
  // The owner applies.
  const more = `/dashboard/${business.id}/more`;
  await signInWithEmail(page, owner, more);
  await page.getByRole("button", { name: "Apply for the check mark" }).click();
  await expect(page.getByText("Checking your details.")).toBeVisible();

  // No check yet for customers.
  await page.goto(`/business/${business.slug}`);
  await expect(page.getByRole("img", { name: "Verified business" })).toHaveCount(0);

  // The seed platform admin verifies (phone sign-in with the local test code).
  const adminContext = await browser.newContext({ ...devices["Pixel 7"], baseURL });
  const admin = await adminContext.newPage();
  await admin.goto("/admin/verification");
  await admin.getByLabel("Phone number").fill("020 000 0009");
  await admin.getByRole("button", { name: "Send code" }).click();
  await admin.getByLabel("Verification code").fill("123456");
  await admin.getByRole("button", { name: "Continue" }).click();
  await expect(admin.getByRole("heading", { level: 1, name: "Verification" })).toBeVisible();
  const item = admin.getByRole("listitem").filter({ hasText: business.name });
  await item.getByPlaceholder("What you checked (audit log)").fill("Called the owner; Ghana Card matches");
  await item.getByRole("button", { name: "Verify" }).click();
  // The page refreshes: the business moves to the Verified list, where the only action is removing the check.
  await expect(item.getByRole("button", { name: "Remove check" })).toBeVisible();
  await adminContext.close();

  // Customers see it on the page and in search; it explains itself.
  await page.goto(`/business/${business.slug}`);
  await expect(page.getByRole("img", { name: "Verified business" })).toBeVisible();
  await page.getByRole("button", { name: "Verified business: what this means" }).click();
  await expect(page.getByText(/checked the owner.s phone and details/)).toBeVisible();
  const api = await page.request.get(`/api/v1/businesses/${business.slug}`);
  expect((await api.json()).data.verified).toBe(true);
});

test("renaming the business removes the check", async ({ page }) => {
  await signInWithEmail(page, owner, `/dashboard/${business.id}/setup/about`);
  await page.getByLabel("Business name").fill(`${business.name} Studio`);
  await page.getByRole("button", { name: "Save and continue" }).click();
  // Wait for the save to finish (it moves on to the next step) before leaving the page.
  await expect(page).not.toHaveURL(/\/setup\/about/);
  await page.goto(`/dashboard/${business.id}/more`);
  await expect(page.getByRole("button", { name: "Apply for the check mark" })).toBeVisible();
});
