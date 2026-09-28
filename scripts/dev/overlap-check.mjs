// Layout check: in-flow text overlapping other text, and content hidden under fixed bottom bars.
// node scripts/dev/overlap-check.mjs <storage-state.json | -> <path...>   (app running on :3000)
// Checks 360 and 390 px widths. Sticky/fixed layers (tab bars, title bars, sheets) are excluded from the text check by design.
import { chromium } from "@playwright/test";
const [storage, ...paths] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
for (const width of [360, 390]) {
  const ctx = await b.newContext({
    viewport: { width, height: 740 },
    reducedMotion: "reduce",
    storageState: storage === "-" ? undefined : storage,
  });
  const p = await ctx.newPage();
  for (const path of paths) {
    await p.goto("http://localhost:3000" + path, { waitUntil: "load" });
    await p.waitForTimeout(700);
    const r = await p.evaluate(async () => {
      const isFixedOnly = (el) => {
        for (let e = el; e; e = e.parentElement) if (getComputedStyle(e).position === "fixed") return true;
        return false;
      };
      const isFixed = (el) => {
        for (let e = el; e; e = e.parentElement) {
          const s = getComputedStyle(e);
          if (s.position === "fixed" || s.position === "sticky") return true;
        }
        return false;
      };
      const visible = (el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return (
          r.width > 0 &&
          r.height > 0 &&
          s.visibility !== "hidden" &&
          s.opacity !== "0" &&
          !el.closest(
            "[popover]:not(:popover-open), details:not([open]) > :not(summary), [hidden], .sr-only, [aria-hidden=true]",
          )
        );
      };
      // 1) In-flow text overlapping other in-flow text.
      const leaves = [...document.querySelectorAll("main *")].filter(
        (el) => visible(el) && !isFixed(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()),
      );
      const boxes = leaves.map((el) => {
        const rs = [...el.getClientRects()];
        return { el, rs };
      });
      const hits = [];
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i],
            c = boxes[j];
          if (a.el.contains(c.el) || c.el.contains(a.el)) continue;
          for (const x of a.rs)
            for (const y of c.rs) {
              const w = Math.min(x.right, y.right) - Math.max(x.left, y.left),
                h = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top);
              if (w > 2 && h > 2)
                hits.push(`"${a.el.textContent.trim().slice(0, 25)}" × "${c.el.textContent.trim().slice(0, 25)}"`);
            }
        }
      // 2) Scrolled to the bottom, the last content must end above any fixed bottom bar.
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise((r) => setTimeout(r, 400));
      const bars = [...document.querySelectorAll("body *")]
        .filter((el) => getComputedStyle(el).position === "fixed" && visible(el))
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.bottom >= innerHeight - 2 && r.top > innerHeight / 2 && r.height < 200);
      // Only the opaque part of a bar matters: its first visible child with a background.
      const barTop = bars.length
        ? Math.min(
            ...[...document.querySelectorAll("body *")]
              .filter((el) => {
                const s = getComputedStyle(el);
                const r = el.getBoundingClientRect();
                return (
                  visible(el) &&
                  r.top > innerHeight / 2 &&
                  r.bottom <= innerHeight + 1 &&
                  (s.backgroundColor !== "rgba(0, 0, 0, 0)" || s.backdropFilter !== "none") &&
                  isFixedOnly(el) &&
                  r.height < 200 &&
                  r.width > 100
                );
              })
              .map((el) => el.getBoundingClientRect().top),
          )
        : innerHeight;
      const content = [...document.querySelectorAll("main *")].filter(
        (el) => visible(el) && !isFixed(el) && el.children.length === 0,
      );
      const lastBottom = Math.max(...content.map((el) => el.getBoundingClientRect().bottom));
      return { hits: [...new Set(hits)].slice(0, 6), hidden: Math.round(lastBottom - barTop) };
    });
    const bad = r.hits.length || r.hidden > 0;
    console.log(
      `${bad ? "✗" : "✓"} ${width} ${path}${r.hidden > 0 ? `  last content ${r.hidden}px under bottom bar` : ""}${r.hits.length ? "\n    " + r.hits.join("\n    ") : ""}`,
    );
  }
  await ctx.close();
}
await b.close();
