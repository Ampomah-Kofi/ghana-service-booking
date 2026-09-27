import { expect, test } from "@playwright/test";
import QRCode from "qrcode";
import { createTestUser, deleteTestUser, type TestUser } from "./support/admin";

/**
 * Critical flow (roadmap Phase 2): a solo professional signs in, sets up their
 * business on a phone-sized screen, uploads a photo, publishes, and the public page works.
 */
let user: TestUser;

test.beforeAll(async () => {
  user = await createTestUser("Adwoa Mensah");
});

test.afterAll(async () => {
  if (user) await deleteTestUser(user);
});

test("solo provider onboards and publishes a shareable page", async ({ page, request }) => {
  const name = `Adwoa Nails ${Date.now().toString(36)}`;

  // Sign in (email path; the phone OTP path is covered in docs/testing.md manual checks + unit tests).
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fonboarding/);
  await page.getByRole("link", { name: "Use email instead" }).click();
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // Create the business
  await expect(page.getByRole("heading", { name: "List your business" })).toBeVisible();
  await page.getByLabel("Just me").check();
  await page.getByLabel("Business or professional name").fill(name);
  await page.getByLabel("What do you do?").selectOption({ label: "Nails" });
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 1: About
  await expect(page.getByText("Step 1 of 6")).toBeVisible();
  await page.getByLabel("Description").fill("Gel, acrylics and pedicures. Home visits in Accra.");
  await page.getByRole("button", { name: "Save and continue" }).click();

  // Step 2: Location (validation first)
  await expect(page.getByText("Step 2 of 6")).toBeVisible();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByText("Choose a town or city.")).toBeVisible();
  await page.getByLabel("Town or city").selectOption({ label: "Accra" });
  await page.getByLabel("Area or neighbourhood").selectOption({ label: "Osu" });
  await page.getByLabel("Nearest landmark").fill("Behind the Osu Mall");
  await page.getByRole("button", { name: "Save and continue" }).click();

  // Step 3: Contact
  await expect(page.getByText("Step 3 of 6")).toBeVisible();
  await page.getByLabel("Phone number for customers").fill("024 123");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByText("Enter a valid phone number, e.g. 024 123 4567.")).toBeVisible();
  await page.getByLabel("Phone number for customers").fill("024 123 4567");
  await page.getByRole("button", { name: "Save and continue" }).click();

  // Step 4: Services (required to publish)
  await expect(page.getByText("Step 4 of 6")).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("link", { name: "Add your first service" }).click();
  await page.getByLabel("Service name").fill("Gel manicure");
  await page.getByLabel("Price", { exact: true }).fill("80.5");
  await page.getByLabel("How long it takes").selectOption({ label: "45 min" });
  await page.getByLabel("Deposit (GH₵)").fill("100");
  await page.getByRole("button", { name: "Add service" }).click();
  await expect(page.getByText("The deposit can't be more than the price.")).toBeVisible();
  await page.getByLabel("Deposit (GH₵)").fill("");
  await page.getByRole("button", { name: "Add service" }).click();
  await expect(page.getByText("Step 4 of 6")).toBeVisible();
  await expect(page.getByText("GH₵ 80.50 · 45 min")).toBeVisible();
  await page.getByRole("link", { name: "Continue" }).click();

  // Step 5: Hours (Mon–Sat 9–6 prefilled): close Saturday, add a lunch break on Monday
  await expect(page.getByText("Step 5 of 6")).toBeVisible();
  await page.getByRole("switch", { name: "Saturday" }).uncheck();
  await page.getByRole("button", { name: "Add a break" }).first().click();
  await page.getByLabel("Monday closes").first().fill("12:00");
  await page.getByLabel("Monday reopens").fill("13:00");
  await page.getByLabel("Monday closes").nth(1).fill("18:00");
  await page.getByRole("button", { name: "Save and continue" }).click();

  // Step 6: Photos (resized in the browser, then uploaded)
  await expect(page.getByText("Step 6 of 6")).toBeVisible();
  const photo = await QRCode.toBuffer("test photo", { width: 1600 });
  await page.getByText("Add photo").locator("..").locator("input[type=file]").setInputFiles({
    name: "work.png",
    mimeType: "image/png",
    buffer: photo,
  });
  await expect(page.getByRole("button", { name: "Remove photo" })).toHaveCount(1, { timeout: 15_000 });
  await expect(page.getByText("1 of 12")).toBeVisible();
  await page.getByRole("link", { name: "Finish and preview" }).click();

  // Dashboard: publish
  await expect(page.getByRole("heading", { name: "Almost there" })).toBeVisible();
  await page.getByRole("button", { name: "Publish my page" }).click();
  await expect(page.getByRole("heading", { name: "Your page is live" })).toBeVisible();
  await expect(page.getByRole("img", { name: /QR code for/ })).toBeVisible();
  const pageUrl = await page.locator("[title^='http']").first().getAttribute("title");
  expect(pageUrl).toMatch(/\/business\/adwoa-nails-/);

  // Public page, seen by a signed-out visitor
  const slugPath = new URL(pageUrl!).pathname;
  const anon = await page.context().browser()!.newContext();
  const visitor = await anon.newPage();
  await visitor.goto(slugPath);
  await expect(visitor.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(visitor.getByText("Nails · Osu, Accra")).toBeVisible();
  await expect(visitor.getByText("Landmark: Behind the Osu Mall")).toBeVisible();
  await expect(visitor.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+233241234567");
  await expect(visitor.getByRole("link", { name: "WhatsApp", exact: true }).first()).toHaveAttribute(
    "href",
    "https://wa.me/233241234567",
  );
  await expect(visitor.getByRole("img", { name: `Work by ${name}` })).toHaveCount(1);
  await expect(visitor.getByText("Gel manicure")).toBeVisible();
  await expect(visitor.getByText("GH₵ 80.50")).toBeVisible();
  await expect(
    visitor.getByRole("definition").filter({ hasText: "9:00 am – 12:00 pm, 1:00 pm – 6:00 pm" }),
  ).toBeVisible();
  await expect(visitor.getByText("Saturday").locator("..").getByText("Closed")).toBeVisible();
  await anon.close();

  // QR download
  const qr = await request.get(`${slugPath}/qr`);
  expect(qr.status()).toBe(200);
  expect(qr.headers()["content-type"]).toBe("image/png");

  // Unpublish hides it from the public again
  await page.getByRole("button", { name: "Hide my page" }).click();
  await expect(page.getByRole("heading", { name: "Almost there" })).toBeVisible();
  const hidden = await request.get(slugPath, { headers: { cookie: "" } });
  expect(hidden.status()).toBe(404);
});
