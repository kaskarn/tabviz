/**
 * Browser correctness test for measure-then-commit row heights.
 *
 * The sizing-model "content-driven height" feature (sizing-model.md §6) has two
 * paths: a pure ESTIMATOR (verified headless by layout-metrics.test.ts) and a
 * browser MEASURE-THEN-COMMIT loop that reads real rendered heights and commits
 * them back into the layout. The measure loop can ONLY be verified in a real
 * browser (it needs the DOM + the ResizeObserver/rAF feedback), so it lives
 * here rather than in the bun/vitest suites.
 *
 * What this asserts, mounting a spec with a narrow wrap-enabled column:
 *   1. Rows with long (wrapping) text render TALLER than rows with short text.
 *   2. The measure→commit→re-measure loop SETTLES — a second read after a
 *      settle delay yields the same heights (no oscillation / runaway ratchet).
 *
 * This is a correctness harness (assert + exit code), distinct from the timing
 * bench in run-bench.ts. Run:
 *   cd srcjs && bun run tests/browser/measure-rows.browser.ts
 *   bun run tests/browser/measure-rows.browser.ts --bundle <path> --headed
 *
 * Registered in tests/browser/README.md alongside the bench.
 */

import puppeteer, { type Page } from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";
import { buildTheme } from "../../src/lib/theme/theme-adapter";
import { COCHRANE } from "../../src/lib/theme/theme-presets-inputs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_HTML = path.join(__dirname, "fixtures.html");
const DEFAULT_BUNDLE = path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.js");
const DEFAULT_CSS = path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.css");

function parseArgs() {
  const args = process.argv.slice(2);
  const o = { bundle: DEFAULT_BUNDLE, css: DEFAULT_CSS, headed: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--bundle") o.bundle = path.resolve(args[++i]);
    else if (a === "--css") o.css = path.resolve(args[++i]);
    else if (a === "--headed") o.headed = true;
  }
  return o;
}

const LONG =
  "A deliberately long study label that wraps across several lines when the " +
  "column is narrow enough to force multiple lines of text in the cell.";

function buildSpec(): unknown {
  const THEME = buildTheme(COCHRANE, "cochrane");
  const rows = [
    { id: "r0", label: "Short A", metadata: { notes: "brief" }, style: {} },
    { id: "r1", label: "Long",    metadata: { notes: LONG },    style: {} },
    { id: "r2", label: "Short B", metadata: { notes: "brief" }, style: {} },
  ];
  return {
    version: "1.0",
    data: { rows, groups: [], summaries: [] },
    columns: [
      { id: "label", type: "text", field: "label", header: "Study", options: {} },
      { id: "notes", type: "text", field: "notes", header: "Notes", width: 140,
        wrap: true, options: {} },
    ],
    theme: THEME,
    interaction: { enableExport: false, enableThemes: null, showGroupCounts: false },
    layout: { plotWidth: 200, containerBorder: false },
  };
}

/** Mount the spec, let the measure loop settle, return per-row rendered heights
 *  (rowId → max cell height) sampled `samples` times `settleMs` apart. */
async function mountAndSample(page: Page, spec: unknown, samples: number, settleMs: number) {
  await page.evaluate((s) => {
    const w = window as unknown as {
      HTMLWidgets: { find: (n: string) => { factory: (el: HTMLElement, wd: number, ht: number) => { renderValue: (x: unknown) => void } } | undefined };
    };
    const binding = w.HTMLWidgets.find("tabviz");
    if (!binding) throw new Error("tabviz binding not found");
    const host = document.getElementById("widget")!;
    host.innerHTML = "";
    const inner = document.createElement("div");
    inner.style.width = "900px";
    inner.style.height = "600px";
    host.appendChild(inner);
    binding.factory(inner, 900, 600).renderValue(s);
  }, spec);

  const readHeights = () =>
    page.evaluate(() => {
      const out: Record<string, number> = {};
      const cells = document.querySelectorAll<HTMLElement>("[data-row-id]");
      for (const c of cells) {
        const id = c.dataset.rowId;
        if (!id) continue;
        const h = c.getBoundingClientRect().height;
        out[id] = Math.max(out[id] ?? 0, Math.round(h));
      }
      return out;
    });

  const snaps: Record<string, number>[] = [];
  for (let i = 0; i < samples; i++) {
    await new Promise((r) => setTimeout(r, settleMs));
    snaps.push(await readHeights());
  }
  return snaps;
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

async function main() {
  const opts = parseArgs();
  const browser = await puppeteer.launch({
    headless: !opts.headed,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 700, deviceScaleFactor: 1 });
    page.on("pageerror", (e) => console.error("[browser error]", e));
    page.on("console", (m) => { if (m.type() === "error") console.error("[browser console]", m.text()); });

    await page.goto(`file://${FIXTURE_HTML}`, { waitUntil: "load" });
    await page.addStyleTag({ path: opts.css });
    await page.addScriptTag({ path: opts.bundle });

    const snaps = await mountAndSample(page, buildSpec(), 3, 250);
    const last = snaps[snaps.length - 1];
    const prev = snaps[snaps.length - 2];

    console.log("row heights (settled):", JSON.stringify(last));

    // 1. Wrapped row taller than the short rows.
    if (!(last.r1 > last.r0) || !(last.r1 > last.r2)) {
      fail(`wrapped row r1 (${last.r1}) should exceed short rows r0 (${last.r0}), r2 (${last.r2})`);
    }
    // 2. Loop settled: last two samples identical (±1px raster).
    for (const id of Object.keys(last)) {
      if (Math.abs((last[id] ?? 0) - (prev[id] ?? 0)) > 1) {
        fail(`row ${id} not settled: ${prev[id]} → ${last[id]} (measure loop oscillating)`);
      }
    }

    console.log("✓ measure-then-commit: wrapped rows grow and the loop settles");
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
