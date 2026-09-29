// Saves a signed-in Playwright storage state for a seed user (local dev only):
// node scripts/dev/login-state.mjs <phone e.g. 0200000001> <out.json>
// Uses the seed test OTP (123456) from supabase/config.toml.
import { chromium } from "@playwright/test";

const [phone, out] = process.argv.slice(2);
const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
const page = await browser.newPage();
await page.goto(`${base}/sign-in?next=/account`);
await page.getByLabel("Phone number").fill(phone);
await page
  .getByRole("button", { name: /send|continue/i })
  .first()
  .click();
await page.getByLabel("Verification code").fill("123456");
await page
  .getByRole("button", { name: /verify|sign in|continue/i })
  .first()
  .click();
await page.waitForURL((url) => url.pathname === "/account");
await page.context().storageState({ path: out });
console.log("saved", out);
await browser.close();
