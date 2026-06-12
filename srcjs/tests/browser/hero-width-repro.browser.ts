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
  // Select interval cells by content shape (data-field carries the
  // ROW-level field only on some cell kinds; text-match is robust).
  const cells = [...document.querySelectorAll<HTMLElement>(".grid-cell.data-cell")]
    .filter((c) => /\(\d+\.\d+, \d+\.\d+\)/.test(c.textContent ?? ""));
  const bad: string[] = [];
  for (const cell of cells) {
    const content = cell.querySelector<HTMLElement>(".cell-content");
    if (!content) continue;
    const pad = parseFloat(getComputedStyle(cell).paddingLeft) + parseFloat(getComputedStyle(cell).paddingRight);
    // offsetWidth: UNSCALED layout boxes on both sides.
    const room = cell.offsetWidth - pad;
    if (content.offsetWidth > room + 0.5) {
      bad.push(`${content.textContent!.trim().slice(0, 24)} content=${content.offsetWidth} room=${Math.round(room)}`);
    }
  }
  return { checked: cells.length, bad };
});
console.log(`interval cells checked: ${verdict.checked}; overflows: ${verdict.bad.length}`);
if (verdict.bad.length > 0) {
  console.error(verdict.bad.join("\n"));
  process.exit(1);
}
console.log("✓ hero interval cells fit their boxes");
await browser.close();
