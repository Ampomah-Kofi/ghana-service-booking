// Renders scripts/dev/app-icon.svg to the PNG sizes phones need (run once after changing the icon):
// node scripts/dev/render-icons.mjs
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync(new URL("./app-icon.svg", import.meta.url), "utf8");
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["maskable-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<html><body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: false });
  await page.close();
  console.log(name);
}
await browser.close();
