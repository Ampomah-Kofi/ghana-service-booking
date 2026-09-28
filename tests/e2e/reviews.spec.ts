import { devices, expect, test, type Page } from "@playwright/test";
import {
  createCompletedVisit,
  createPublishedBusiness,
  createTestUser,
  deleteTestUser,
  type TestBusiness,
  type TestUser,
} from "./support/admin";

/**
 * Critical flow (roadmap Phase 7): a customer saves a business, rates a completed visit,
 * the owner replies, and the reply shows under the review on the public page.
 */
let owner: TestUser;
let customer: TestUser;
let business: TestBusiness;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  owner = await createTestUser("Esi Owner");
  customer = await createTestUser("Abena Reviewer");
  business = await createPublishedBusiness(owner, "Esi Silk Studio");
  await createCompletedVisit(business, customer);
});

test.afterAll(async () => {
  if (customer) await deleteTestUser(customer);
  if (owner) await deleteTestUser(owner);
});

async function signIn(page: Page, user: TestUser, next: string) {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByRole("link", { name: "Use email instead" }).click();
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === next);
}

test("customer saves a favourite, then rates a completed visit", async ({ page }) => {
  await signIn(page, customer, `/business/${business.slug}`);

  await page.getByRole("button", { name: `Save ${business.name} to favourites` }).click();
  await expect(page.getByRole("button", { name: `Remove ${business.name} from favourites` })).toBeVisible();
  await page.goto("/favorites");
  await expect(page.getByRole("heading", { level: 3, name: business.name })).toBeVisible();

  await page.goto("/bookings");
  await page.getByRole("link", { name: "Rate" }).click();
  await expect(page.getByRole("heading", { name: "How was Silk press?" })).toBeVisible();
  // The stars are real radio buttons drawn as stars: tap the fourth star.
  await page.locator("label", { has: page.getByRole("radio", { name: /^4 stars/ }) }).click();
  await expect(page.getByRole("radio", { name: /^4 stars/ })).toBeChecked();
  await page.getByLabel(/Tell others about your visit/).fill("Silky and neat, a little late.");
  await page.getByRole("button", { name: "Post review" }).click();
  await expect(page.getByRole("heading", { name: "Your review" })).toBeVisible();
  await expect(page.locator("article").getByText("Silky and neat, a little late.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit review" })).toBeVisible();
});

test("owner replies and the reply is public", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ ...devices["Pixel 7"], baseURL });
  const page = await context.newPage();
  await signIn(page, owner, `/dashboard/${business.id}/reviews`);
  await expect(page.getByText("Abena R.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await page.getByLabel("Your reply").fill("Thank you, Abena! We're fixing the wait.");
  await page.getByRole("button", { name: "Post reply" }).click();
  await expect(page.getByText("Reply from Esi Silk Studio")).toBeVisible();
  await context.close();

  const visitor = await browser.newContext({ ...devices["Pixel 7"], baseURL });
  const pub = await visitor.newPage();
  await pub.goto(`/business/${business.slug}`);
  await expect(pub.getByText("4.0 ★")).toBeVisible();
  await expect(pub.getByText("Silky and neat, a little late.")).toBeVisible();
  await expect(pub.getByText("Thank you, Abena! We're fixing the wait.")).toBeVisible();
  // Signed out: the heart asks to sign in instead of saving.
  await expect(pub.getByRole("link", { name: `Sign in to save ${business.name}` })).toBeVisible();
  await visitor.close();
});

test("reviews API: public list with summary; favourites and writing need a signed-in caller", async ({ request }) => {
  const list = await request.get(`/api/v1/businesses/${business.slug}/reviews`);
  expect(list.status()).toBe(200);
  const body = await list.json();
  expect(body.meta).toMatchObject({ count: 1, average: 4, distribution: [0, 0, 0, 1, 0] });
  expect(body.data[0]).toMatchObject({ author_name: "Abena R.", rating: 4, reply: { body: expect.any(String) } });

  expect((await request.get("/api/v1/me/favorites")).status()).toBe(401);
  expect((await request.put(`/api/v1/me/favorites/${business.id}`)).status()).toBe(401);
  expect((await request.post(`/api/v1/appointments/${business.id}/review`, { data: { rating: 5 } })).status()).toBe(
    401,
  );
  const openapi = await (await request.get("/api/v1/openapi.json")).json();
  expect(Object.keys(openapi.paths)).toEqual(
    expect.arrayContaining([
      "/me/favorites",
      "/businesses/{slug}/reviews",
      "/appointments/{id}/review",
      "/reviews/{id}/reply",
    ]),
  );
});
