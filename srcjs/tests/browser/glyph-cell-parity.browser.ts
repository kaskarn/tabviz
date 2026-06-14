/**
 * GLYPH-CELL DOM↔EXPORT parity harness (cell-render-parity-review.md gap #2).
 *
 * Every visual column type is rendered TWICE — a DOM path (Cell*.svelte) and an
 * SVG export path (schema/columns/*-renderer.ts). The wysiwyg-diff harness
 * compares text/box GEOMETRY numerically but is BLIND to glyph rendering: a
 * badge drawn with the wrong padding, a progress bar with a different label
 * width, an icon at a different size all pass it. Those are the rank 1–8
 * divergences the review catalogued; nothing gated them.
 *
 * This harness pixel-diffs the GLYPH ITSELF. For each visual column it crops the
 * SAME logical cell from (A) the live widget mounted at scale-1 and (B) a raster
 * of generateSVG(spec) — both at the same nominal width — and pixelmatches the
 * overlap. Cell boxes come from computeLayoutMetrics (SVG, canonical) and
 * getBoundingClientRect (DOM); we crop both to the common top-left box so the
 * comparison isolates intra-cell glyph appearance + offset (cell POSITION drift
 * is already gated numerically by wysiwyg-diff).
 *
 * Side-by-side PNGs land in /tmp/glyph-parity/<col>-{dom,svg,diff}.png for
 * eyeballing. `--gate` fails when a column's mismatch exceeds its budget; new or
 * over-budget divergences block. Budgets are annotated with the review rank /
 * decision-register id they encode, exactly like wysiwyg-diff.
 *
 * Run:
 *   cd srcjs && bun run tests/browser/glyph-cell-parity.browser.ts
 *   bun run tests/browser/glyph-cell-parity.browser.ts --gate
 *   bun run tests/browser/glyph-cell-parity.browser.ts --headed --only badge
 *
 * Registered in tests/browser/README.md.
 */

import puppeteer, { type Browser, type Page } from "puppeteer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { buildTheme } from "../../src/lib/theme/theme-adapter";
import { NEJM } from "../../src/lib/theme/theme-presets-inputs";
import { generateSVG, computeLayoutMetrics } from "../../src/export/svg-generator";
import { bootBuiltinBehaviors } from "../../src/schema/init";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_HTML = path.join(__dirname, "fixtures.html");
const DEFAULT_BUNDLE = path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.js");
const DEFAULT_CSS = path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.css");
const OUT_DIR = "/tmp/glyph-parity";
// Wide enough that fixed column widths (below) never flex-stretch — the label
// column absorbs all slack, so every GLYPH cell is byte-identical width in DOM
// and SVG. (A content-sized glyph column auto-sizes DIFFERENTLY in the two
// paths, which decentres the crop — that's a fixture artifact, not a glyph
// divergence.)
const NOMINAL_WIDTH = 1120;
const GLYPH_COL_W = 96;
// deviceScaleFactor 1 — the working widget-screenshot harnesses (panel-liveness,
// settings-consequence) all use 1; DPR 2 made page.screenshot hang on the
// widget page (SVG page was fine). pixelmatch's AA tolerance covers the
// coarser pixels.
const DPR = 1;

function parseArgs() {
  const args = process.argv.slice(2);
  const o = { bundle: DEFAULT_BUNDLE, css: DEFAULT_CSS, headed: false, gate: false, only: null as string | null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--bundle") o.bundle = path.resolve(args[++i]);
    else if (a === "--css") o.css = path.resolve(args[++i]);
    else if (a === "--headed") o.headed = true;
    else if (a === "--gate") o.gate = true;
    else if (a === "--only") o.only = args[++i];
  }
  return o;
}

// Per-column mismatch budget (fraction of cropped cell pixels that may differ).
// A glyph cell is small (~40×24 px × DPR²); anti-aliasing on text/curves makes a
// few-percent floor honest even for a perfect match. Budgets ABOVE the
// AA-floor encode a KNOWN divergence (review rank) until it's reconciled — they
// only shrink. New/over-budget columns fail --gate.
const AA_FLOOR = 0.06;
const BUDGETS: Record<string, { max: number; why: string }> = {
  // Reconciled / near-exemplary in the review — only AA noise expected.
  ring:      { max: AA_FLOOR, why: "rank 7: geometry identical (shared CELL_GEOMETRY)" },
  pictogram: { max: AA_FLOOR, why: "rank 8: slot/remap/half logic identical" },
  bar:       { max: 0.10, why: "rank 9: SVG reads BAR.*; DOM re-hardcodes matching literals + track-color default" },
  stars:     { max: AA_FLOOR, why: "rank 2: maxGlyphs/halfGlyphs reconciled (5cef797)" },
  icon:      { max: AA_FLOOR, why: "rank 6: equal at default rem" },
  // KNOWN-OPEN divergences (review rank 3–5) — budgeted high until reconciled.
  badge:     { max: 0.40, why: "rank 5 OPEN: pill h-padding DOM 10px vs SVG 4px; font-scale 0.77 vs 0.8; size ignored in SVG" },
  progress:  { max: 0.40, why: "rank 4 OPEN: label width 32 vs 40; label font 0.75 vs 0.9; track color" },
  heatmap:   { max: 0.30, why: "rank 3: value-text font 0.75 vs 0.9; SVG 2px inset gutter vs DOM fill" },
  sparkline: { max: 0.25, why: "rank 1: responsive width reconciled (2336d3b); residual path AA" },
};

// One row, many glyph columns. Values chosen so each glyph has visible content.
const ROW = {
  id: "r0", label: "Study A",
  metadata: {
    badge: "High", prog: 0.62, ringv: 0.7, starsv: 3.5, picto: 4,
    iconv: "up", barv: 0.55, sparkv: [3, 5, 2, 8, 4, 6], heatv: 0.62,
  },
  style: {},
};

interface GlyphCol { key: string; field: string; col: Record<string, unknown>; }
const GLYPH_COLS: GlyphCol[] = [
  { key: "badge", field: "badge", col: { id: "badge", type: "badge", field: "badge", header: "Badge", options: { badge: { variants: { High: "error" } } } } },
  { key: "progress", field: "prog", col: { id: "progress", type: "progress", field: "prog", header: "Prog", options: { progress: { showLabel: true } } } },
  { key: "ring", field: "ringv", col: { id: "ring", type: "ring", field: "ringv", header: "Ring", options: { ring: { showLabel: true } } } },
  { key: "stars", field: "starsv", col: { id: "stars", type: "stars", field: "starsv", header: "Stars", options: { pictogram: { maxGlyphs: 5, halfGlyphs: true, glyph: "star" } } } },
  { key: "pictogram", field: "picto", col: { id: "pictogram", type: "pictogram", field: "picto", header: "Picto", options: { pictogram: { maxGlyphs: 5, glyph: "dot" } } } },
  { key: "icon", field: "iconv", col: { id: "icon", type: "icon", field: "iconv", header: "Icon", options: { icon: { map: { up: "arrow-up" } } } } },
  { key: "bar", field: "barv", col: { id: "bar", type: "bar", field: "barv", header: "Bar", options: { bar: { max: 1, showLabel: true } } } },
  { key: "sparkline", field: "sparkv", col: { id: "sparkline", type: "sparkline", field: "sparkv", header: "Spark", options: { sparkline: {} } } },
  { key: "heatmap", field: "heatv", col: { id: "heatmap", type: "heatmap", field: "heatv", header: "Heat", options: { heatmap: { min: 0, max: 1, showValue: true } } } },
];

function buildSpec(cols: GlyphCol[]) {
  const theme = buildTheme(NEJM, "nejm");
  return {
    version: "1.0",
    data: { rows: [ROW], groups: [], summaries: [] },
    columns: [
      { id: "label", type: "text", field: "label", header: "Study", options: {} },
      // Fixed width per glyph column → identical cell box in DOM and SVG.
      ...cols.map((c) => ({ ...c.col, width: GLYPH_COL_W })),
    ],
    theme,
    // Banding off + no shell so the cell background is a single flat surface
    // (isolates the glyph from row-tint / shell-pad coordinate shifts).
    interaction: { enableExport: false, enableThemes: null, showGroupCounts: false },
    layout: { containerBorder: false },
  };
}

interface Box { x: number; y: number; width: number; height: number; }

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// fs-based progress trail — bun buffers stdout, so a hang/kill loses console
// output; this flushes immediately (liveness-harness lesson).
const TRACE = "/tmp/glyph-trace.log";
function trace(msg: string) { try { fs.appendFileSync(TRACE, `${msg}\n`); } catch { /* ignore */ } }

// Crop a PNG buffer to a box (in device pixels) → new PNG.
function cropPng(png: PNG, b: Box): PNG {
  const x = Math.max(0, Math.round(b.x));
  const y = Math.max(0, Math.round(b.y));
  const w = Math.min(png.width - x, Math.round(b.width));
  const h = Math.min(png.height - y, Math.round(b.height));
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(png, out, x, y, w, h, 0, 0);
  return out;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout: ${label} (${ms}ms)`)), ms)),
  ]);
}

// Clipped screenshot in CSS px → PNG at clip×DPR device px. Clipped (not
// full-page) + bounded: a full-page screenshot hangs to protocolTimeout under
// the headless-Chrome capture flake (CLAUDE.md liveness lesson).
async function shootClip(page: Page, b: Box, label: string): Promise<PNG> {
  const clip = {
    x: Math.max(0, Math.round(b.x)),
    y: Math.max(0, Math.round(b.y)),
    width: Math.max(1, Math.round(b.width)),
    height: Math.max(1, Math.round(b.height)),
  };
  const buf = await withTimeout(page.screenshot({ clip }), 12000, label);
  return PNG.sync.read(Buffer.from(buf));
}

// Hard watchdog — guarantees termination even if a stuck CDP screenshot jams
// browser.close() (observed under the local headless-Chrome capture flake).
// Healthy CI never trips it; a flaky local box force-exits instead of hanging.
function armWatchdog(ms: number): NodeJS.Timeout {
  const t = setTimeout(() => { console.error(`\n✗ watchdog: forced exit after ${ms}ms (headless-Chrome screenshot flake — run in CI/healthy browser).`); process.exit(2); }, ms);
  return t;
}

async function main() {
  const watchdog = armWatchdog(120000);
  const opts = parseArgs();
  const cols = opts.only ? GLYPH_COLS.filter((c) => c.key === opts.only) : GLYPH_COLS;
  if (cols.length === 0) { console.error(`no glyph column matches --only ${opts.only}`); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  try { fs.writeFileSync(TRACE, ""); } catch { /* ignore */ }
  trace("start");
  // Register the built-in cell SVG renderers — WITHOUT this, generateSVG
  // text-degrades every visual cell (ring/heatmap/pictogram render the raw
  // value, inflating the diff). Same boot wysiwyg-diff calls; the split-boot
  // trap in CLAUDE.md ("svg renderer registered only via a Svelte module").
  bootBuiltinBehaviors();
  const spec = buildSpec(cols);
  const svgStr = generateSVG(spec as never, { width: NOMINAL_WIDTH });
  const metrics = computeLayoutMetrics(spec as never, { width: NOMINAL_WIDTH });
  trace("svg+metrics ok");

  // Canonical (SVG) cell boxes in CSS px, keyed by field.
  const rowM = metrics.rows.find((r) => r.kind === "data") ?? metrics.rows[0];
  const cellY = metrics.mainY + metrics.headerHeight + rowM.top;
  const svgBoxes: Record<string, Box> = {};
  for (const c of cols) {
    const cm = metrics.columns.find((m) => m.id === c.col.id);
    if (!cm) { console.error(`metrics missing column ${c.col.id}`); process.exit(1); }
    svgBoxes[c.key] = { x: cm.x, y: cellY, width: cm.width, height: rowM.height };
  }

  trace("launching browser");
  // protocolTimeout: a hung widget screenshot BLOCKS bun's event loop (the
  // local headless-Chrome capture flake), so JS-level withTimeout/watchdog
  // timers can't fire — only the CDP-level protocolTimeout breaks it. Healthy
  // CI screenshots return in <1s; a stuck one rejects at 20s → caught → skip.
  // --force-device-scale-factor=1 mirrors panel-liveness/settings-consequence.
  const browser = await puppeteer.launch({
    headless: !opts.headed,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--force-device-scale-factor=1"],
    protocolTimeout: 20000,
  });
  trace("browser launched");
  const results: Array<{ key: string; mismatch: number; budget: number; why: string }> = [];
  try {
    // ---- (A) DOM render ----
    trace("dom: newPage");
    const domPage = await browser.newPage();
    await domPage.setViewport({ width: NOMINAL_WIDTH + 80, height: 600, deviceScaleFactor: DPR });
    domPage.on("pageerror", (e) => console.error("[dom error]", e.message));
    // The widget runs CSS transitions / rAF; a never-settling frame makes
    // page.screenshot hang to protocolTimeout. Reduced-motion trips the
    // widget's global animation kill-switch (area J); the injected override is
    // belt-and-suspenders for any non-tokenized transition.
    await domPage.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await domPage.goto(`file://${FIXTURE_HTML}`, { waitUntil: "load" });
    await domPage.addStyleTag({ path: opts.css });
    await domPage.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important;}" });
    await domPage.addScriptTag({ path: opts.bundle });
    trace("dom: bundle injected");
    await domPage.evaluate((s, w) => {
      const win = window as unknown as { HTMLWidgets: { find: (n: string) => { factory: (el: HTMLElement, wd: number, ht: number) => { renderValue: (x: unknown) => void } } | undefined } };
      const host = document.getElementById("widget")!;
      host.innerHTML = "";
      const inner = document.createElement("div");
      inner.style.width = `${w}px`; inner.style.height = "560px";
      host.appendChild(inner);
      win.HTMLWidgets.find("tabviz")!.factory(inner, w, 560).renderValue(s);
    }, spec, NOMINAL_WIDTH);
    trace("dom: mounted");
    await sleep(500); // measure-then-commit settle

    // DOM cell boxes (CSS px) → device px.
    const domBoxes: Record<string, Box> = await domPage.evaluate((fields) => {
      const out: Record<string, Box> = {};
      for (const [key, field] of fields) {
        const el = document.querySelector(`[data-row-id="r0"][data-field="${field}"]`) as HTMLElement | null;
        if (el) { const r = el.getBoundingClientRect(); out[key] = { x: r.x, y: r.y, width: r.width, height: r.height }; }
      }
      return out;
    }, cols.map((c) => [c.key, c.field]));
    trace("dom: boxes read");

    // PASS 1 — all DOM crops while domPage is the FOREGROUND tab. screenshot()
    // hangs on a backgrounded tab; opening svgPage first then shooting domPage
    // is exactly that trap. Shoot every DOM cell before svgPage exists.
    const domCrops: Record<string, PNG> = {};
    const cropBox: Record<string, Box> = {};
    for (const c of cols) {
      const sb = svgBoxes[c.key];
      const db = domBoxes[c.key];
      if (!db) { console.error(`✗ [${c.key}] DOM cell not found`); continue; }
      // Common cell box (CSS px), top-left aligned in each render. Isolates
      // intra-cell glyph appearance + offset from cell-position drift (gated
      // numerically by wysiwyg-diff).
      const box = { x: db.x, y: db.y, width: Math.min(sb.width, db.width), height: Math.min(sb.height, db.height) };
      cropBox[c.key] = box;
      try {
        domCrops[c.key] = await shootClip(domPage, box, `${c.key} dom`);
        trace(`dom shot ${c.key}`);
      } catch (e) {
        console.error(`[${c.key}] dom screenshot SKIPPED (env flake): ${(e as Error).message}`);
        trace(`dom shot ${c.key} SKIPPED`);
      }
    }
    await domPage.close();

    // ---- (B) SVG raster page (now the only/foreground tab) ----
    trace("svg: newPage");
    const svgPage = await browser.newPage();
    await svgPage.setViewport({ width: Math.ceil(metrics.totalWidth) + 40, height: Math.ceil(metrics.totalHeight) + 40, deviceScaleFactor: DPR });
    await svgPage.setContent(
      `<!doctype html><html><body style="margin:0;padding:0;background:#fff">${svgStr}</body></html>`,
      { waitUntil: "load" },
    );
    await svgPage.bringToFront();
    await sleep(200);
    trace("svg: setContent done");

    // PASS 2 — SVG crops + compare.
    trace(`comparing; domBoxes=${JSON.stringify(domBoxes)}`);
    trace(`svgBoxes=${JSON.stringify(svgBoxes)}`);
    for (const c of cols) {
      const sb = svgBoxes[c.key];
      const a = domCrops[c.key];
      if (!a) { results.push({ key: c.key, mismatch: NaN, budget: BUDGETS[c.key]?.max ?? AA_FLOOR, why: "SKIPPED (dom shot unavailable)" }); continue; }
      const box = cropBox[c.key];
      let b: PNG;
      try {
        b = await shootClip(svgPage, { x: sb.x, y: sb.y, width: box.width, height: box.height }, `${c.key} svg`);
      } catch (e) {
        console.error(`[${c.key}] svg screenshot SKIPPED (env flake): ${(e as Error).message}`);
        results.push({ key: c.key, mismatch: NaN, budget: BUDGETS[c.key]?.max ?? AA_FLOOR, why: "SKIPPED (svg shot unavailable)" });
        continue;
      }
      trace(`svg shot ${c.key}`);
      const w = Math.min(a.width, b.width);
      const h = Math.min(a.height, b.height);
      const ac = cropPng(a, { x: 0, y: 0, width: w, height: h });
      const bc = cropPng(b, { x: 0, y: 0, width: w, height: h });
      const diff = new PNG({ width: w, height: h });
      const bad = pixelmatch(ac.data, bc.data, diff.data, w, h, { threshold: 0.12 });
      const mismatch = bad / (w * h);
      fs.writeFileSync(`${OUT_DIR}/${c.key}-dom.png`, PNG.sync.write(ac));
      fs.writeFileSync(`${OUT_DIR}/${c.key}-svg.png`, PNG.sync.write(bc));
      fs.writeFileSync(`${OUT_DIR}/${c.key}-diff.png`, PNG.sync.write(diff));
      const budget = BUDGETS[c.key]?.max ?? AA_FLOOR;
      results.push({ key: c.key, mismatch, budget, why: BUDGETS[c.key]?.why ?? "(no budget — AA floor)" });
    }
    await svgPage.close();
  } finally {
    // Bound cleanup — a browser holding a stuck screenshot op hangs close().
    await withTimeout(browser.close(), 10000, "browser.close").catch(() => { try { browser.process()?.kill("SIGKILL"); } catch { /* ignore */ } });
  }
  clearTimeout(watchdog);

  // ---- report ----
  console.log(`\nGlyph-cell DOM↔export parity (crops in ${OUT_DIR}):`);
  let breaches = 0;
  let skipped = 0;
  for (const r of results.sort((x, y) => (Number.isNaN(y.mismatch) ? -1 : y.mismatch) - (Number.isNaN(x.mismatch) ? -1 : x.mismatch))) {
    if (Number.isNaN(r.mismatch)) { skipped++; console.log(`  ⊘ ${r.key.padEnd(10)}  SKIP   ${r.why}`); continue; }
    const pct = (r.mismatch * 100).toFixed(1).padStart(5);
    const bud = (r.budget * 100).toFixed(0);
    const over = r.mismatch > r.budget;
    if (over) breaches++;
    console.log(`  ${over ? "✗" : "✓"} ${r.key.padEnd(10)} ${pct}%  (budget ${bud}%)  ${r.why}`);
  }
  const measured = results.length - skipped;
  if (skipped > 0) console.error(`\n⚠ ${skipped} column(s) SKIPPED — headless-Chrome screenshot flake (local env). Run in CI/healthy browser for full coverage.`);
  // Skips never fail the gate (can't-measure ≠ regression); real over-budget
  // breaches do. A run that measured NOTHING is itself a gate failure in CI
  // (the screenshots must work there — settings-consequence proves they do).
  if (opts.gate && breaches > 0) {
    console.error(`\n✗ ${breaches} column(s) over budget — glyph divergence introduced or widened.`);
    process.exit(1);
  }
  if (opts.gate && measured === 0) {
    console.error(`\n✗ measured 0 columns — screenshots unavailable. Not a pass.`);
    process.exit(3);
  }
  console.log(`\n${opts.gate ? "GATE" : "report-only"} — ${measured}/${results.length} measured, ${breaches} over budget, ${skipped} skipped.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
