/**
 * Browser correctness test for forest mark x-positions (WYSIWYG scale contract).
 *
 * A forest point marker must render at the x the canonical forest scale dictates
 * — the SAME scale the V8/SVG export uses, so the live widget and the downloaded
 * SVG agree pixel-for-pixel. The scale is built from `plotRegion` (axisLimits +
 * marker margin); the export has always done this, and as of the per-context
 * scale work the DOM does too (docs/dev/region-tree.md §5).
 *
 * This guards against the DOM drifting back onto a different domain (e.g. the
 * historical `axisLimits`-without-margin, which put live marks a few px off from
 * the export). It can only run in a real browser (needs the rendered SVG
 * overlay), so it lives here rather than in bun/vitest.
 *
 * Run:
 *   cd srcjs && bun run tests/browser/forest-marks.browser.ts
 *   bun run tests/browser/forest-marks.browser.ts --bundle <path> --headed
 *
 * Registered in tests/browser/README.md.
 */

import puppeteer, { type Page } from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";
import { buildTheme } from "../../src/lib/theme/theme-adapter";
import { COCHRANE } from "../../src/lib/theme/theme-presets-inputs";
import { computeAxis } from "../../src/lib/axis-utils";
import { buildForestScale } from "../../src/lib/layout/forest-scale";

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

// Points clustered near the null (1.0) so the marker-margin difference between
// plotRegion and axisLimits is several px — i.e. a domain regression is a clear
// failure, not sub-pixel noise.
const POINTS = [0.72, 0.78, 0.65, 0.81, 0.69];
const LOWERS = [0.58, 0.64, 0.52, 0.66, 0.55];
const UPPERS = [0.89, 0.95, 0.81, 0.99, 0.87];
const NULL_VALUE = 1;

function buildSpec(): { spec: unknown; theme: ReturnType<typeof buildTheme> } {
  const theme = buildTheme(COCHRANE, "cochrane");
  const rows = POINTS.map((p, i) => ({
    id: `r${i}`,
    label: `S${i}`,
    metadata: { hr: p, lo: LOWERS[i], hi: UPPERS[i] },
    style: {},
  }));
  const spec = {
    version: "1.0",
    data: { rows, groups: [], summaries: [] },
    columns: [
      { id: "label", type: "text", field: "label", header: "Study", options: {} },
      {
        id: "fc", type: "forest", field: "hr", header: "HR", options: {
          forest: { point: "hr", lower: "lo", upper: "hi", scale: "linear", nullValue: NULL_VALUE, axisLabel: "HR", showAxis: true },
        },
      },
    ],
    theme,
    interaction: { enableExport: false, enableThemes: null, showGroupCounts: false },
    layout: { plotWidth: 320, containerBorder: false },
  };
  return { spec, theme };
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

async function main() {
  const opts = parseArgs();
  const { spec, theme } = buildSpec();

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

    // Let the layout / measure loop settle, then read the overlay width and the
    // point-estimate marker cx values (in DOM = row order).
    await new Promise((r) => setTimeout(r, 400));
    const dom = await page.evaluate(() => {
      const overlay = document.querySelector<SVGSVGElement>("svg.plot-overlay");
      const width = overlay ? parseFloat(overlay.getAttribute("width") ?? "0") : 0;
      const cxs = Array.from(document.querySelectorAll<SVGCircleElement>("svg.plot-overlay circle.point-estimate"))
        .map((c) => parseFloat(c.getAttribute("cx") ?? "NaN"));
      return { width, cxs };
    });

    if (!dom.width) fail("no forest plot overlay rendered (width 0)");
    if (dom.cxs.length !== POINTS.length) {
      fail(`expected ${POINTS.length} point markers, found ${dom.cxs.length}`);
    }

    // Canonical scale: built from plotRegion at the rendered overlay width — the
    // same construction the export uses (computeAxis → plotRegion → buildForestScale).
    const { plotRegion } = computeAxis({
      rows: (spec as { data: { rows: never[] } }).data.rows,
      config: theme.axis,
      scale: "linear",
      nullValue: NULL_VALUE,
      forestWidth: dom.width,
      pointSize: theme.plot.pointSize,
      effects: [],
      pointCol: "hr",
      lowerCol: "lo",
      upperCol: "hi",
      domainOverride: null,
    });
    const scale = buildForestScale({
      columnId: "fc", groupId: null, scaleType: "linear", domain: plotRegion, width: dom.width,
    });
    const expected = POINTS.map((p) => scale(p));

    const TOL = 1; // px
    for (let i = 0; i < POINTS.length; i++) {
      const diff = Math.abs(dom.cxs[i] - expected[i]);
      if (diff > TOL) {
        fail(
          `marker ${i} (value ${POINTS[i]}): cx ${dom.cxs[i].toFixed(2)} != expected ${expected[i].toFixed(2)} ` +
          `(Δ ${diff.toFixed(2)}px > ${TOL}px). DOM forest marks must use the plotRegion scale (match the export).`,
        );
      }
    }

    console.log(`✓ forest marks: ${POINTS.length} markers match the canonical plotRegion scale (≤${TOL}px)`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
