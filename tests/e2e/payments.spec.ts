import { expect, test, type Page } from "@playwright/test";
import {
  createPublishedBusiness,
  createTestUser,
  deleteTestUser,
  setUpDirectPayments,
  type TestBusiness,
  type TestUser,
} from "./support/admin";

/**
 * Critical flow (ADR-0017): the app never takes money. A customer books on a phone and says
 * they'll pay with Mobile Money; the ticket shows the business's own MoMo number and a reference;
 * the owner marks it paid; the customer sees it recorded.
 */
let owner: TestUser;
let customer: TestUser;
let business: TestBusiness;
let bookingId = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  owner = await createTestUser("Efua Owner");
  customer = await createTestUser("Kojo Payer");
  business = await createPublishedBusiness(owner, "Efua Direct Studio");
  await setUpDirectPayments(business);
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

test("customer books, chooses Mobile Money, and sees where to send it", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await signIn(page, customer, `/business/${business.slug}`);
  await expect(page.getByText(/Pays: Cash · MoMo · Bank/)).toBeVisible();

  await page.getByRole("link", { name: "Book an appointment" }).click();
  await page.getByRole("link", { name: /Silk press/ }).click();
  const times = page.locator('section[aria-labelledby="times-heading"] a');
  await expect(times.first()).toBeVisible();
  await times.first().click();

  await expect(page.getByRole("heading", { level: 1, name: "Your details" })).toBeVisible();
  await page.getByLabel("Phone number").fill("024 555 7788");
  await expect(page.getByRole("radio", { name: /^Cash/ })).toBeChecked();
  await page.getByRole("radio", { name: /^Mobile Money/ }).check();
  await page.getByRole("button", { name: "Confirm booking" }).click();

  // No pay screen: straight to the ticket.
  await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}\?booked=1/);
  bookingId = new URL(page.url()).pathname.split("/").pop() ?? "";
  const payment = page.locator('section[aria-labelledby="payment-heading"]');
  await expect(payment.locator("dd").first()).toHaveText("Mobile Money");
  await expect(payment.getByText("024 400 0111")).toBeVisible();
  await expect(payment.getByText("Efua Mensah")).toBeVisible();
  await expect(payment.getByText(/^BK-[0-9A-F]{6}$/)).toBeVisible();
});

test("API: payment details need the booking's customer; no pay endpoint exists", async ({ request }) => {
  expect((await request.get(`/api/v1/appointments/${bookingId}/payment-details`)).status()).toBe(401);
  expect((await request.post(`/api/v1/appointments/${bookingId}/payments`, { data: {} })).status()).toBe(405);
  const openapi = await (await request.get("/api/v1/openapi.json")).json();
  expect(Object.keys(openapi.paths)).toContain("/appointments/{id}/payment-details");
  expect(openapi.paths["/appointments/{id}/payments"].post).toBeUndefined();
});

test("owner marks it paid and the customer sees it recorded", async ({ page, browser }) => {
  const next = `/dashboard/${business.id}/appointments/${bookingId}`;
  await page.setViewportSize({ width: 360, height: 780 });
  await signIn(page, owner, next);
  await expect(page.getByText("Kojo will pay with mobile money.")).toBeVisible();
  await page.getByRole("button", { name: "Mark paid" }).click();
  await expect(page.getByRole("radio", { name: "MoMo" })).toBeChecked();
  await expect(page.getByLabel(/Amount received/)).toHaveValue("150");
  await page.getByRole("dialog").getByRole("button", { name: "Mark paid" }).click();
  await expect(page.getByText("Paid in full · GH₵ 150")).toBeVisible();

  await page.goto(`/dashboard/${business.id}/payments`);
  await expect(page.getByRole("heading", { level: 1, name: "Payments" })).toBeVisible();
  await expect(page.getByText("Kojo Payer · Silk press")).toBeVisible();

  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  await customerPage.setViewportSize({ width: 360, height: 780 });
  await signIn(customerPage, customer, `/bookings/${bookingId}`);
  await expect(customerPage.getByText("Paid in full, as recorded by the business.")).toBeVisible();
  await customerContext.close();
});
