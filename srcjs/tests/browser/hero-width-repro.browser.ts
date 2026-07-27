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
  // The store registry (and the __tabvizStoreRegistry dev hook the insert
  // check below reads) is keyed by element id — an id-less mount is invisible
  // to it.
  inner.id = "hero-widget";
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
  // The GENERAL floor (3px) absorbs the SMALL residual of the tabular-nums
  // approximation: cells render `font-variant-numeric: tabular-nums` (DOM AND
  // export) but are measured via PROPORTIONAL advances, so the measure
  // normalizes digits to the widest-advance digit (tabularizeDigits) — closing
  // ~6 of the old 7px gap on the hero's widest figure cell ("839/14,752": was
  // 7px over, now ~1px). The true tnum figure is a hair wider than even "0"
  // (needs a regen-measured advance — tracked in arc-history); the ~1px residual
  // lives under this 3px floor, which still catches the bug class this gate
  // exists for (a COMPONENT column at AUTO_WIDTH.MIN → tens-of-px clips; the
  // pvalue regression was 37px).
  const STRICT = 0.5, GENERAL = 3;
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
console.log("✓ hero cells fit their column boxes (intervals strict 0.5px, others ≤3px tabular residual)");

// ── Inserted columns get a REAL width (2026-07-27) ────────────────────
// A runtime-inserted column was never measured: `doMeasurement` iterated
// `spec.columns` (the wire), which by definition excludes runtime inserts, and
// `insertColumn` never triggered a measure pass at all. On a narrow table the
// leftover slack hid it; on THIS table — every column measured, no slack — the
// newcomer's grid track resolved to 0px, so the column was in the DOM and in
// allColumns but INVISIBLE. It read as "insert did nothing".
//
// This lives here rather than in interaction-qa because the bug needs a
// WIDTH-SATURATED table to appear, and that is exactly what the hero is. Note
// the assertion is on the rendered TRACK, not on a header-cell count — counting
// cells is what let this ship (interaction-qa counted +1 header and passed
// while the column was 0px wide). Insert via the store: the menu→editor→commit
// path is interaction-qa's job; what is gated here is the WIDTH.
type HeroStore = {
  allColumns: { id: string }[];
  columnWidths: Record<string, number>;
  insertColumn: (def: unknown, afterId: string) => void;
};
const beforeIds = await page.evaluate(() => {
  const reg = (window as unknown as { __tabvizStoreRegistry?: Map<string, HeroStore> }).__tabvizStoreRegistry;
  if (!reg || reg.size === 0) return null;
  return [...reg.values()][0]!.allColumns.map((c) => c.id);
});
if (!beforeIds) { console.error("no store registry — dev hook missing"); process.exit(1); }
const anchor = beforeIds[1] ?? beforeIds[0]!;
await page.evaluate((a: string) => {
  const reg = (window as unknown as { __tabvizStoreRegistry?: Map<string, HeroStore> }).__tabvizStoreRegistry!;
  // Give the probe an explicit id + a real field: insertColumn mints from
  // `def.id || def.field`, so a def with neither yields an id-less column.
  [...reg.values()][0]!.insertColumn(
    { id: "inserted_probe", type: "text", header: "Inserted", field: "drug" }, a);
}, anchor);
// Let the derived column list + the measure pass settle before reading back.
await new Promise((r) => setTimeout(r, 800));
const insertVerdict = await page.evaluate((before: string[]) => {
  const reg = (window as unknown as { __tabvizStoreRegistry?: Map<string, HeroStore> }).__tabvizStoreRegistry!;
  const store = [...reg.values()][0]!;
  const added = store.allColumns.map((c) => c.id).find((id) => !before.includes(id));
  return { added, width: added ? store.columnWidths[added] : undefined };
}, beforeIds);
if (!insertVerdict.added) {
  console.error(`insert after "${anchor}" produced no column`);
  process.exit(1);
}
const track = await page.evaluate((id: string) => {
  const cell = document.querySelector<HTMLElement>(`[data-header-id="${CSS.escape(id)}"]`);
  return cell ? cell.getBoundingClientRect().width : -1;
}, insertVerdict.added);
if (!(insertVerdict.width! > 0) || !(track > 1)) {
  console.error(`inserted column ${insertVerdict.added}: columnWidths=${insertVerdict.width}, rendered=${track}px `
    + `— an unmeasured insert collapses to a 0px track (invisible column)`);
  process.exit(1);
}
console.log(`✓ inserted column is measured + visible (width ${insertVerdict.width}px, rendered ${Math.round(track)}px)`);
await browser.close();
