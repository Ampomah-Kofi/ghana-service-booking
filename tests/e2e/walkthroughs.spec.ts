import { expect, test, type Page } from "@playwright/test";
import { createTestUser, deleteTestUser, type TestUser } from "./support/admin";

/**
 * Real-life journeys (after Phase 8), on a small phone, as the people the product is for:
 *  1. Kofi, an electrician in Tema, lists a job with "Price on request" and his Instagram.
 *  2. Esi, an influencer in Accra, lists priced deliverables and her TikTok/Instagram.
 *  3. A brand manager searches "influencer in Accra", compares, books a TikTok video and is notified;
 *     Esi sees the new booking in her inbox.
 * Set WALKTHROUGH_SHOTS=dir to save a screenshot at every step (for design review).
 */
const SHOTS = process.env.WALKTHROUGH_SHOTS;
let step = 0;
async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  step += 1;
  await page.screenshot({
    path: `${SHOTS}/${String(step).padStart(2, "0")}-${name}.jpg`,
    type: "jpeg",
    quality: 70,
    fullPage: true,
  });
}

let kofi: TestUser;
let esi: TestUser;
let brand: TestUser;
const tag = Date.now().toString(36);

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  kofi = await createTestUser("Kofi Mensah");
  esi = await createTestUser("Esi Appiah");
  brand = await createTestUser("Adjoa Brand");
});

test.afterAll(async () => {
  for (const u of [brand, esi, kofi]) if (u) await deleteTestUser(u);
});

async function signIn(page: Page, user: TestUser, next: string) {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByRole("link", { name: "Use email instead" }).click();
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

/** The six setup steps, as a first-time provider would fill them. */
async function listBusiness(
  page: Page,
  o: {
    name: string;
    category: string;
    description: string;
    city: string;
    area?: string;
    landmark: string;
    phone: string;
    socials: Record<string, string>;
    services: {
      name: string;
      price?: string;
      type?: "Exact" | "From (starting at)" | "On request";
      duration: string;
    }[];
  },
) {
  await expect(page.getByRole("heading", { name: "List your business" })).toBeVisible();
  await shot(page, "list-your-business");
  await page.getByLabel("Just me").check();
  await page.getByLabel("Business or professional name").fill(o.name);
  await page.getByLabel("What do you do?").selectOption({ label: o.category });
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Step 1 of 6")).toBeVisible();
  await page.getByLabel("Description").fill(o.description);
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page.getByText("Step 2 of 6")).toBeVisible();
  await page.getByLabel("Town or city").selectOption({ label: o.city });
  if (o.area) await page.getByLabel("Area or neighbourhood").selectOption({ label: o.area });
  await page.getByLabel("Nearest landmark").fill(o.landmark);
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page.getByText("Step 3 of 6")).toBeVisible();
  await page.getByLabel("Phone number for customers").fill(o.phone);
  for (const [label, value] of Object.entries(o.socials)) await page.getByLabel(label, { exact: true }).fill(value);
  await shot(page, "contact-and-socials");
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page.getByText("Step 4 of 6")).toBeVisible();
  for (const [i, s] of o.services.entries()) {
    await page.getByRole("link", { name: i === 0 ? "Add your first service" : /Add (another|a) service/ }).click();
    await page.getByLabel("Service name").fill(s.name);
    if (s.price) await page.getByLabel("Price", { exact: true }).fill(s.price);
    if (s.type) await page.getByLabel("Price is").selectOption({ label: s.type });
    await page.getByLabel("How long it takes").selectOption({ label: s.duration });
    if (i === 0) await shot(page, "first-service");
    await page.getByRole("button", { name: "Add service" }).click();
    await expect(page.getByText("Step 4 of 6")).toBeVisible();
  }
  for (const s of o.services.filter((x) => x.type === "On request"))
    await expect(page.getByRole("listitem").filter({ hasText: s.name })).toContainText("Price on request");
  await shot(page, "services-list");
  await page.getByRole("link", { name: "Continue" }).click();

  await expect(page.getByText("Step 5 of 6")).toBeVisible();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByText("Step 6 of 6")).toBeVisible();
  await page.getByRole("link", { name: "Finish and preview" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "More" })).toBeVisible();
  await page.getByRole("button", { name: "Publish my page" }).click();
  await expect(page.getByText("Your page is live. Customers can book you online.")).toBeVisible();
  await shot(page, "published");
}

test("an electrician lists a job with price on request and his Instagram", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await signIn(page, kofi, "/onboarding");
  const name = `Kofi Volts ${tag}`;
  await listBusiness(page, {
    name,
    category: "Electricians",
    description: "Wiring, sockets, prepaid meters and ceiling fans. I come to you anywhere in Tema.",
    city: "Tema",
    landmark: "Near the Community 1 lorry station",
    phone: "024 700 1234",
    socials: { Instagram: "https://www.instagram.com/kofivolts/?hl=en" },
    services: [
      { name: "Socket repair", type: "On request", duration: "1 hr" },
      { name: "House wiring", price: "500", type: "From (starting at)", duration: "4 hr" },
    ],
  });

  // What a customer sees.
  await page.getByRole("link", { name: "View page" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByRole("link", { name: /Instagram @kofivolts/ })).toHaveAttribute(
    "href",
    "https://www.instagram.com/kofivolts",
  );
  await expect(page.getByRole("link", { name: /^Book Socket repair, Price on request/ })).toBeVisible();
  await shot(page, "electrician-public-page");
});

test("an influencer lists priced deliverables with her socials", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await signIn(page, esi, "/onboarding");
  const name = `Esi Creates ${tag}`;
  await listBusiness(page, {
    name,
    category: "Influencers & creators",
    description: "Lifestyle and beauty creator in Accra. Honest reviews, clean edits, 48-hour turnaround.",
    city: "Accra",
    area: "Osu",
    landmark: "Oxford Street, near the Koala shop",
    phone: "020 811 2233",
    socials: { TikTok: "@esicreates", Instagram: "esi.creates", "YouTube channel": "youtube.com/@esicreates" },
    services: [
      { name: "TikTok video", price: "1200", duration: "2 hr" },
      { name: "Instagram post + story", price: "800", duration: "1 hr" },
      { name: "Event appearance", type: "On request", duration: "4 hr" },
    ],
  });
  await page.getByRole("link", { name: "View page" }).click();
  await expect(page.getByRole("link", { name: /TikTok @esicreates/ })).toHaveAttribute(
    "href",
    "https://www.tiktok.com/@esicreates",
  );
  await expect(page.getByRole("link", { name: /YouTube/ })).toHaveAttribute("href", "https://youtube.com/@esicreates");
  await shot(page, "influencer-public-page");
});

test("a brand finds the influencer, books a TikTok video, and both are notified", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await page.getByRole("searchbox", { name: /Search for a service/ }).fill("influencer in Accra");
  await page.getByRole("searchbox", { name: /Search for a service/ }).press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: /Influencers & creators/ })).toBeVisible();
  await shot(page, "brand-search");
  await page.getByRole("heading", { level: 3, name: `Esi Creates ${tag}` }).click();
  await page.getByRole("link", { name: /^Book TikTok video/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Choose a time" })).toBeVisible();
  await page
    .getByRole("list")
    .filter({ has: page.getByRole("link", { name: /^\d{1,2}:\d{2} (am|pm)$/ }) })
    .first()
    .getByRole("link")
    .first()
    .click();
  await page.getByRole("link", { name: "Sign in to book" }).click();
  await page.getByRole("link", { name: "Use email instead" }).click();
  await page.getByLabel("Email").fill(brand.email);
  await page.getByLabel("Password").fill(brand.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your details" })).toBeVisible();
  await page.getByLabel("Phone number").fill("024 555 9876");
  await shot(page, "brand-details");
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByRole("heading", { name: /You're booked!|Request sent/ })).toBeVisible();
  await shot(page, "brand-booked");

  await page.goto("/notifications");
  await expect(page.getByText(/You're booked|Request sent/).first()).toBeVisible();
  await shot(page, "brand-inbox");

  // Esi, on her phone, sees the new booking.
  const ctx = await browser.newContext({ baseURL, viewport: { width: 360, height: 780 } });
  const esiPage = await ctx.newPage();
  await signIn(esiPage, esi, "/notifications");
  await expect(esiPage.getByText(/New booking|Needs your OK/).first()).toBeVisible();
  await expect(esiPage.getByText(/TikTok video/).first()).toBeVisible();
  await shot(esiPage, "influencer-inbox");
  await ctx.close();
});
