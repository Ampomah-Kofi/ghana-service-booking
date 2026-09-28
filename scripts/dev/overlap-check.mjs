// Layout check: in-flow text overlapping other text, content hidden under fixed bottom bars, and fixed
// elements trapped by a transformed/filtered ancestor (they then scroll with the page instead of staying put).
// node scripts/dev/overlap-check.mjs <storage-state.json | -> <path...>   (app running on :3000)
// Checks 360 and 390 px widths. Sticky/fixed layers (tab bars, title bars, sheets) are excluded from the text check by design.
import { chromium } from "@playwright/test";
const [storage, ...paths] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
for (const width of [360, 390]) {
  const ctx = await b.newContext({
    viewport: { width, height: 740 },
    // Normal motion on purpose: a page animation's leftover transform is exactly what traps fixed bars.
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
      // 0) position: fixed must mean "fixed to the screen": no ancestor may create a containing block.
      const trapped = [];
      for (const el of document.querySelectorAll("body *")) {
        if (getComputedStyle(el).position !== "fixed" || !visible(el)) continue;
        for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
          const s = getComputedStyle(e);
          if (
            s.transform !== "none" ||
            s.backdropFilter !== "none" ||
            s.filter !== "none" ||
            s.perspective !== "none" ||
            /paint|layout|strict|content/.test(s.contain) ||
            /transform|filter/.test(s.willChange)
          ) {
            trapped.push(
              `${el.tagName.toLowerCase()}[${el.getAttribute("aria-label") ?? el.className.toString().slice(0, 30)}] inside .${e.className.toString().split(" ")[0]}`,
            );
            break;
          }
        }
      }
      // 0b) Navigation bars must be on top: sample points across each visible nav and check nothing covers it.
      const covered = [];
      for (const nav of document.querySelectorAll("nav")) {
        if (getComputedStyle(nav).position !== "fixed" || !visible(nav)) continue;
        const bar = nav.firstElementChild ?? nav;
        const r = bar.getBoundingClientRect();
        if (r.bottom <= 0 || r.top >= innerHeight) continue;
        for (const fx of [0.08, 0.3, 0.5, 0.7, 0.92]) {
          const x = r.left + r.width * fx,
            y = r.top + r.height / 2;
          const hit = document.elementFromPoint(x, y);
          if (hit && !nav.contains(hit)) {
            covered.push(
              `${nav.getAttribute("aria-label")} at ${Math.round(x)}px under ${hit.tagName.toLowerCase()}.${hit.className.toString().split(" ")[0]}`,
            );
            break;
          }
        }
      }
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
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
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
      return { hits: [...new Set(hits)].slice(0, 6), hidden: Math.round(lastBottom - barTop), trapped, covered };
    });
    const bad = r.hits.length || r.hidden > 0 || r.trapped.length || r.covered.length;
    console.log(
      `${bad ? "✗" : "✓"} ${width} ${path}${r.hidden > 0 ? `  last content ${r.hidden}px under bottom bar` : ""}${r.hits.length ? "\n    " + r.hits.join("\n    ") : ""}${r.trapped.length ? "\n    fixed but trapped: " + r.trapped.join(", ") : ""}${r.covered.length ? "\n    nav covered: " + r.covered.join(", ") : ""}`,
    );
  }
  await ctx.close();
}
await b.close();
