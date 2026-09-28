import { expect, test } from "@playwright/test";
import {
  createPublishedBusiness,
  createTestUser,
  deleteTestUser,
  enableOnlineDeposits,
  type TestBusiness,
  type TestUser,
} from "./support/admin";

/**
 * Critical flow (roadmap Phase 9): a customer books a service with a deposit on a phone, pays it
 * with Mobile Money, approves on the (mock, development-only) phone prompt, and the ticket shows
 * the booking confirmed with the deposit paid. Then the owner records the rest in cash.
 */
let owner: TestUser;
let customer: TestUser;
let business: TestBusiness;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  owner = await createTestUser("Efua Owner");
  customer = await createTestUser("Kojo Payer");
  business = await createPublishedBusiness(owner, "Efua Deposit Studio");
  await enableOnlineDeposits(business);
});

test.afterAll(async () => {
  if (customer) await deleteTestUser(customer);
  if (owner) await deleteTestUser(owner);
});

let bookingUrl = "";

test("customer pays a deposit with Mobile Money and the booking confirms itself", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto(`/sign-in?next=${encodeURIComponent(`/business/${business.slug}`)}`);
  await page.getByRole("link", { name: "Use email instead" }).click();
  await page.getByLabel("Email").fill(customer.email);
  await page.getByLabel("Password").fill(customer.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === `/business/${business.slug}`);

  await page.getByRole("link", { name: "Book an appointment" }).click();
  await page.getByRole("link", { name: /Silk press/ }).click();
  const times = page.locator('section[aria-labelledby="times-heading"] a');
  await expect(times.first()).toBeVisible();
  await times.first().click();

  await expect(page.getByRole("heading", { level: 1, name: "Your details" })).toBeVisible();
  await page.getByLabel("Phone number").fill("024 555 7788");
  await page.getByRole("button", { name: "Confirm booking" }).click();

  // The slot is held while they pay.
  await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}\/pay$/);
  await expect(page.getByRole("heading", { level: 1, name: "Pay the deposit" })).toBeVisible();
  await expect(page.getByText(/left to pay/)).toBeVisible();
  await expect(page.getByRole("radio", { name: /Mobile Money/ })).toBeChecked();
  await page.getByRole("button", { name: /^Pay GH₵/ }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Approve on your phone" })).toBeVisible();
  await page.getByRole("link", { name: /mock phone prompt/i }).click();
  await expect(page.getByText(/MOCK PAYMENT/)).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();

  await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}\?payment=paid/);
  const payment = page.locator('section[aria-labelledby="payment-heading"]');
  await expect(payment.getByText("Paid", { exact: true })).toBeVisible();
  await expect(payment.getByText(/GH₵ 100 at the visit/)).toBeVisible();
  bookingUrl = new URL(page.url()).pathname;
});

test("API: payments need the booking's customer; the OpenAPI lists them", async ({ request }) => {
  const id = bookingUrl.split("/").pop() ?? "";
  expect((await request.get(`/api/v1/appointments/${id}/payments`)).status()).toBe(401);
  expect((await request.post(`/api/v1/appointments/${id}/payments`, { data: { method: "card" } })).status()).toBe(401);
  const openapi = await (await request.get("/api/v1/openapi.json")).json();
  expect(Object.keys(openapi.paths)).toContain("/appointments/{id}/payments");
});

test("owner sees the deposit and records the rest in cash", async ({ page }) => {
  const id = bookingUrl.split("/").pop() ?? "";
  const next = `/dashboard/${business.id}/appointments/${id}`;
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByRole("link", { name: "Use email instead" }).click();
  await page.getByLabel("Email").fill(owner.email);
  await page.getByLabel("Password").fill(owner.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === next);

  await expect(page.getByText("GH₵ 50 paid · GH₵ 100 to collect")).toBeVisible();
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByLabel(/Amount received/)).toHaveValue("100");
  await page.getByRole("button", { name: "Save payment" }).click();
  await expect(page.getByText("Paid in full · GH₵ 150")).toBeVisible();

  await page.goto(`/dashboard/${business.id}/payments`);
  await expect(page.getByRole("heading", { level: 1, name: "Payments" })).toBeVisible();
  await expect(page.getByText("MTN MoMo · ending 0111")).toBeVisible();
});
