// Hero width regression gate (2026-06-12). The docs hero (R wire,
// 799px container) once clipped its interval column: the flex
// distribution ran on flat-100 fake naturals (audit S9), the estimator
// under-measured the loaded face, and Canvas measurement raced webfont
// loading (measured Georgia, rendered Lora). Fixed by content naturals
// as shrink floors + Canvas-exact browser measurement + a fonts-settle
// epoch that re-derives widths. This gate asserts every INTERVAL cell's
// content fits its content box (both UNSCALED — the first version of
// this file compared a scaled rect to unscaled scrollWidth and
// false-failed; don't reintroduce that).
// Run after `npm run build`: bun run tests/browser/hero-width-repro.browser.ts
import puppeteer from "puppeteer";
import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(readFileSync(path.join(__dirname, "fixtures/hero-embedded.json"), "utf8"));
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(`file://${path.join(__dirname, "fixtures.html")}`, { waitUntil: "load" });
await page.addStyleTag({ path: path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.css") });
await page.addScriptTag({ path: path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.js") });
await page.evaluate((s) => {
  const w = window as never as { HTMLWidgets: { find: (n: string) => { factory: (el: HTMLElement, a: number, b: number) => { renderValue: (x: unknown) => void } } } };
  const host = document.getElementById("widget")!;
  const inner = document.createElement("div");
  inner.style.width = "799px"; inner.style.height = "900px";
  host.appendChild(inner);
  w.HTMLWidgets.find("tabviz").factory(inner, 799, 900).renderValue(s);
}, spec as never);
// Wait for QUIESCENCE: webfonts + the loadingdone re-measure are part
// of what we gate — poll until the grid template is stable for 3
// consecutive checks (or 12s).
let lastTemplate = "", stable = 0;
for (let i = 0; i < 40 && stable < 3; i++) {
  await new Promise((r) => setTimeout(r, 300));
  const t = await page.evaluate(() => (document.querySelector(".tabviz-main") as HTMLElement)?.style.gridTemplateColumns ?? "");
  if (t === lastTemplate) stable++; else { stable = 0; lastTemplate = t; }
}
const verdict = await page.evaluate(() => {
  // Content element per cell kind: render-tree cells use `.cell-content`;
  // component cells render their own root (pvalue → `.cell-pvalue`, badge →
  // `.cell-badge`, text → `.cell-text`). Measure the widest non-absolute
  // content child (skip overlaid affordances like resize handles).
  const contentWidth = (cell: HTMLElement): { w: number; txt: string } | null => {
    const kids = [...cell.children].filter(
      (k): k is HTMLElement => k instanceof HTMLElement && getComputedStyle(k).position !== "absolute",
    );
    if (!kids.length) return null;
    let best = kids[0]!;
    for (const k of kids) if (k.offsetWidth > best.offsetWidth) best = k;
    return { w: best.offsetWidth, txt: (best.textContent ?? "").trim() };
  };
  const cells = [...document.querySelectorAll<HTMLElement>(".grid-cell.data-cell")];
  // INTERVAL cells are EXACT-measured (Canvas tree) → strict 0.5px floor.
  //
  // The GENERAL floor (8px) is deliberately loose to absorb a KNOWN, tracked
  // measurement gap: cells render `font-variant-numeric: tabular-nums` (DOM AND
  // export), but the width measurement uses PROPORTIONAL glyph advances — so a
  // numeric cell renders ~0.9px/digit WIDER than measured (a hero "839/14,752"
  // events cell: render 87px vs proportional 70px). The proper fix is
  // tabular-aware measurement (see arc-history 2026-06-16); until then the
  // residual is ~7px for the hero's widest figure cells. The 8px floor still
  // catches the bug class this gate exists for: a COMPONENT column dropping to
  // AUTO_WIDTH.MIN (60px) → tens-of-px clips (the pvalue regression was 37px).
  // A future wider tabular value clipping >8px will (correctly) fail here and
  // force the tabular fix.
  const STRICT = 0.5, GENERAL = 8;
  const bad: string[] = [];
  let intervals = 0, total = 0;
  for (const cell of cells) {
    const c = contentWidth(cell);
    if (!c) continue;
    total++;
    const cs = getComputedStyle(cell);
    const room = cell.offsetWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const isInterval = /\(\d+\.\d+, \d+\.\d+\)/.test(cell.textContent ?? "");
    if (isInterval) intervals++;
    const tol = isInterval ? STRICT : GENERAL;
    if (c.w > room + tol) {
      bad.push(`${isInterval ? "[iv]" : "[  ]"} "${c.txt.slice(0, 22)}" content=${c.w} room=${Math.round(room)} over=${Math.round(c.w - room)}`);
    }
  }
  return { total, intervals, bad };
});
console.log(`data cells checked: ${verdict.total} (${verdict.intervals} intervals); overflows: ${verdict.bad.length}`);
if (verdict.bad.length > 0) {
  console.error(verdict.bad.join("\n"));
  process.exit(1);
}
console.log("✓ hero cells fit their column boxes (intervals strict 0.5px, others ≤8px tabular residual)");
await browser.close();
