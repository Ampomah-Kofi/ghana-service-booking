import { expect, test, type Page } from "@playwright/test";
import { createTestUser, deleteTestUser, type TestUser } from "./support/admin";

/**
 * Critical flow (roadmap Phase 5): a customer books "any available" at a team
 * business on a small phone, signs in mid-flow without losing their choice,
 * confirms, sees the booking, and cancels it. Uses seed data (ama-braids).
 */
let user: TestUser;

test.beforeAll(async () => {
  user = await createTestUser("Abena Customer");
});

test.afterAll(async () => {
  if (user) await deleteTestUser(user);
});

async function expectNoSidewaysScroll(page: Page) {
  const [scrollWidth, viewport] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(scrollWidth).toBeLessThanOrEqual(viewport);
}

test("customer books any available professional, then cancels", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/business/ama-braids");
  await page.getByRole("link", { name: "Book an appointment" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Choose a service" })).toBeVisible();
  await page.getByRole("link", { name: /Twists/ }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Choose a professional" })).toBeVisible();
  await page.getByRole("link", { name: /Any available professional/ }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Choose a time" })).toBeVisible();
  await expectNoSidewaysScroll(page);
  const times = page.locator('section[aria-labelledby="times-heading"] a');
  await expect(times.first()).toBeVisible();
  const chosenTime = (await times.first().innerText()).trim();
  await times.first().click();

  // Not signed in yet: the summary is shown and sign-in returns here.
  await expect(page.getByRole("heading", { level: 1, name: "Almost done" })).toBeVisible();
  await page.getByRole("link", { name: "Sign in to book" }).click();
  await page.getByRole("link", { name: "Use email instead" }).click();
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Your details" })).toBeVisible();
  await expect(page.getByText(chosenTime).first()).toBeVisible();
  await expect(page.getByLabel("Your name")).toHaveValue("Abena Customer");
  // Email accounts have no phone yet: validation first, then a valid Ghana number.
  await page.getByLabel("Phone number").fill("024 123");
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByText("Enter a valid phone number, e.g. 024 123 4567.")).toBeVisible();
  await page.getByLabel("Phone number").fill("024 555 1234");
  await page.getByRole("button", { name: "Confirm booking" }).click();

  await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}\?booked=1/);
  await expect(page.getByRole("heading", { name: "You're booked!" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Twists" })).toBeVisible();
  await expect(page.getByText(chosenTime).first()).toBeVisible();

  // Phase 8: the confirmation waits in the inbox, with a count on the bell.
  await page.goto("/");
  await page.getByRole("link", { name: /^Notifications, \d+ unread$/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
  await expect(page.getByText("You're booked", { exact: true })).toBeVisible();

  await page.goto("/bookings");
  await expect(page.getByRole("heading", { level: 1, name: "Bookings" })).toBeVisible();
  await page
    .getByRole("link", { name: /Ama Braids Studio/ })
    .first()
    .click();

  await page.getByRole("button", { name: "Cancel booking" }).click();
  await page.getByLabel("Reason (optional)").fill("Plans changed");
  await page.getByRole("button", { name: "Yes, cancel it" }).click();
  await expect(page.getByText("Your booking is cancelled")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();

  // Book again: same service and person, straight to the time step.
  await page.getByRole("link", { name: "Book again" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Choose a time" })).toBeVisible();
  await expect(page.getByText(/^Twists · /).first()).toBeVisible();

  // Explore remembers where you've been, with the same shortcut. Cancelled visits don't count.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your places" })).toHaveCount(0);
});

test("the booking API needs a signed-in caller; availability is public", async ({ request }) => {
  // Internal jobs and personal endpoints refuse anonymous callers.
  expect((await request.post("/api/internal/jobs/dispatch")).status()).toBe(401);
  expect((await request.get("/api/v1/me/notifications")).status()).toBe(401);
  const profile = await (await request.get("/api/v1/businesses/kwame-cuts")).json();
  const lowCut = profile.data.services.find((s: { name: string }) => s.name === "Low cut");
  const availability = await request.get(`/api/v1/businesses/kwame-cuts/availability?service_id=${lowCut.id}&days=7`);
  expect(availability.status()).toBe(200);
  const body = await availability.json();
  expect(body.meta.timezone).toBe("Africa/Accra");
  expect(body.data).toHaveLength(7);
  expect(body.data.some((d: { slots: unknown[] }) => d.slots.length > 0)).toBe(true);

  const booking = await request.post("/api/v1/appointments", {
    data: {
      business_id: profile.data.id,
      service_id: lowCut.id,
      starts_at: new Date().toISOString(),
      customer_name: "X",
    },
  });
  expect(booking.status()).toBe(401);
});
