// Accessibility check: node scripts/dev/a11y-check.mjs <storage-state.json|-> <path…>   (app running on :3000)
// Runs axe-core (WCAG 2.0–2.2 A/AA) at 360 px in light and dark, and checks that nothing scrolls sideways
// at 200% text size. axe-core isn't a project dependency: it's the copy eslint-plugin-jsx-a11y already
// brings in, found under node_modules/.pnpm. Exits 1 on any finding.
import { readdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const pnpmDir = new URL("../../node_modules/.pnpm/", import.meta.url);
const axeDir = readdirSync(pnpmDir).find((d) => d.startsWith("axe-core@"));
if (!axeDir) throw new Error("axe-core not found under node_modules/.pnpm (run pnpm install)");
const AXE = new URL(`${axeDir}/node_modules/axe-core/axe.min.js`, pnpmDir).pathname;

const [storage, ...paths] = process.argv.slice(2);
const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
let failed = false;
for (const scheme of ["light", "dark"]) {
  const context = await browser.newContext({
    viewport: { width: 360, height: 780 },
    colorScheme: scheme,
    storageState: storage === "-" ? undefined : storage,
  });
  const page = await context.newPage();
  for (const path of paths) {
    await page.goto(base + path);
    await page.waitForTimeout(700);
    await page.addScriptTag({ path: AXE });
    const violations = await page.evaluate(async () =>
      (
        await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] })
      ).violations.map(
        (v) =>
          `${v.id}: ${v.nodes
            .slice(0, 3)
            .map((n) => n.target.join(" "))
            .join(" | ")}`,
      ),
    );
    let reflow = "";
    if (scheme === "light") {
      await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
      await page.waitForTimeout(200);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 1) reflow = `  200% text: ${over}px sideways scroll`;
      await page.evaluate(() => (document.documentElement.style.fontSize = ""));
    }
    const bad = violations.length > 0 || reflow !== "";
    failed ||= bad;
    console.log(
      `${bad ? "✗" : "✓"} ${scheme} ${path}${reflow}${violations.length ? "\n    " + violations.join("\n    ") : ""}`,
    );
  }
  await context.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
