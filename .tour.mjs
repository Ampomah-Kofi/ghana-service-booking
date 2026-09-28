// node tour.mjs <outDir> <storage|-> <path...>  — phone-screen shots (360x780), up to 3 screens per page.
import { chromium } from "@playwright/test";
const [out, storage, ...paths] = process.argv.slice(2);
const base = "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const ctx = await browser.newContext({
  viewport: { width: 360, height: 780 },
  deviceScaleFactor: 1.5,
  colorScheme: process.env.SCHEME || "light",
  storageState: storage === "-" ? undefined : storage,
});
const page = await ctx.newPage();
const screens = Number(process.env.SCREENS || 3);
for (const p of paths) {
  await page.goto(base + p, { waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(600);
  const name = p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home";
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let i = 0; i < screens && i * 700 < h - 200; i++) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), i * 700);
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${out}/${name}-${i + 1}.jpg`, type: "jpeg", quality: 65 });
  }
  console.log(name, h);
}
await browser.close();
