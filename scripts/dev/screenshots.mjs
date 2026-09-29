// Screenshots for design review: node scripts/dev/screenshots.mjs <outDir> <url...>
// Uses the running app (E2E_BASE_URL or http://localhost:3000). Light + dark at 360 px, light at 1024 px.
// Optional: SCREENSHOT_STORAGE=<playwright storage-state json> for signed-in pages.
import { chromium } from "@playwright/test";

const [outDir, ...paths] = process.argv.slice(2);
const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";
// Software GL so backdrop-filter (glass, ADR-0010) renders like on a real phone.
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const variants = [
  { name: "360-light", width: 360, scheme: "light" },
  { name: "360-dark", width: 360, scheme: "dark" },
  { name: "1024-light", width: 1024, scheme: "light" },
];
for (const v of variants) {
  const context = await browser.newContext({
    viewport: { width: v.width, height: 800 },
    deviceScaleFactor: 2,
    colorScheme: v.scheme,
    storageState: process.env.SCREENSHOT_STORAGE || undefined,
  });
  const page = await context.newPage();
  for (const path of paths) {
    await page.goto(base + path, { waitUntil: "load" });
    // Streamed pages: wait until the network settles (bounded; dense pages may never idle).
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    const file = `${outDir}/${path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-${v.name}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
  }
  await context.close();
}
await browser.close();
