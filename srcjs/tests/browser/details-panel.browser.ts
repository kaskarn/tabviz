/**
 * Browser correctness test for details/disclosure panels (row-types.md §6).
 *
 * A data row with `details` markdown owns a full-width disclosure panel. Asserts,
 * in a real browser (the panel render + measure + disclosure state are DOM-only):
 *   1. A row pre-expanded via initialState.expandedRows renders its panel with
 *      the markdown rendered to HTML (here: <strong> from **bold**).
 *   2. A row WITHOUT details renders no panel and no disclosure toggle.
 *   3. Clicking a closed row's disclosure toggle reveals its panel.
 *
 * Saves a screenshot to /tmp/details-panel.png for eyeballing.
 *
 *   cd srcjs && bun run tests/browser/details-panel.browser.ts [--headed]
 *
 * Registered in tests/browser/README.md.
 */

import puppeteer from "puppeteer";
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
    if (args[i] === "--bundle") o.bundle = path.resolve(args[++i]);
    else if (args[i] === "--css") o.css = path.resolve(args[++i]);
    else if (args[i] === "--headed") o.headed = true;
  }
  return o;
}

function buildSpec(): unknown {
  const theme = buildTheme(COCHRANE, "cochrane");
  return {
    version: "1.0",
    data: {
      rows: [
        { id: "r0", label: "Boston", metadata: { hr: 0.72, lo: 0.58, hi: 0.89 },
          details: "**Risk of bias:** low. Allocation concealed; blinded outcome.\n\n- ITT analysis\n- 12-month follow-up", style: {} },
        { id: "r1", label: "Tokyo", metadata: { hr: 0.65, lo: 0.50, hi: 0.85 }, style: {} },
        { id: "r2", label: "Berlin", metadata: { hr: 0.69, lo: 0.55, hi: 0.87 },
          details: "See [protocol](https://example.com) for `pre-registration` details.", style: {} },
      ],
      groups: [], summaries: [],
    },
    columns: [
      { id: "label", type: "text", field: "label", header: "Site", options: {} },
      { id: "fc", type: "forest", field: "hr", header: "HR", options: {
        forest: { point: "hr", lower: "lo", upper: "hi", scale: "linear", nullValue: 1, axisLabel: "HR", showAxis: true } } },
    ],
    theme,
    interaction: { enableExport: false, enableThemes: null, showGroupCounts: false },
    layout: { plotWidth: 280, containerBorder: false },
    initialState: { expandedRows: ["r0"] }, // r0 pre-expanded
  };
}

function fail(msg: string): never { console.error(`✗ ${msg}`); process.exit(1); }

async function main() {
  const opts = parseArgs();
  const browser = await puppeteer.launch({ headless: !opts.headed, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 600, deviceScaleFactor: 2 });
    page.on("pageerror", (e) => console.error("[browser error]", e));
    page.on("console", (m) => { if (m.type() === "error") console.error("[browser console]", m.text()); });

    await page.goto(`file://${FIXTURE_HTML}`, { waitUntil: "load" });
    await page.addStyleTag({ path: opts.css });
    await page.addScriptTag({ path: opts.bundle });

    await page.evaluate((s) => {
      const w = window as unknown as { HTMLWidgets: { find: (n: string) => { factory: (el: HTMLElement, wd: number, ht: number) => { renderValue: (x: unknown) => void } } | undefined } };
      const binding = w.HTMLWidgets.find("tabviz");
      if (!binding) throw new Error("tabviz binding not found");
      const host = document.getElementById("widget")!;
      host.innerHTML = "";
      const inner = document.createElement("div");
      inner.style.width = "860px"; inner.style.height = "520px";
      host.appendChild(inner);
      binding.factory(inner, 860, 520).renderValue(s);
    }, buildSpec());

    await new Promise((r) => setTimeout(r, 400));

    const state = () => page.evaluate(() => {
      const panels = Array.from(document.querySelectorAll<HTMLElement>("[data-panel-row-id]"));
      const toggles = Array.from(document.querySelectorAll<HTMLElement>(".details-toggle"));
      return {
        panelRowIds: panels.map((p) => p.dataset.panelRowId),
        hasStrong: panels.some((p) => p.querySelector("strong") != null),
        toggleCount: toggles.length,
      };
    });

    // 1. r0 pre-expanded → its panel renders with markdown HTML; 2. two toggles
    //    (r0, r2 have details; r1 does not).
    const s1 = await state();
    if (!s1.panelRowIds.includes("r0")) fail(`expected r0 panel rendered, got panels: ${JSON.stringify(s1.panelRowIds)}`);
    if (!s1.hasStrong) fail("expected markdown <strong> rendered in the panel");
    if (s1.toggleCount !== 2) fail(`expected 2 disclosure toggles (r0, r2), got ${s1.toggleCount}`);
    if (s1.panelRowIds.includes("r2")) fail("r2 panel should be closed initially (not in expandedRows)");

    // 3. Click r2's toggle → its panel appears.
    await page.evaluate(() => {
      const toggles = Array.from(document.querySelectorAll<HTMLElement>(".details-toggle"));
      // r0 is open (its toggle has .open); click the closed one.
      const closed = toggles.find((t) => !t.classList.contains("open"));
      closed?.click();
    });
    await new Promise((r) => setTimeout(r, 300));
    const s2 = await state();
    if (!s2.panelRowIds.includes("r2")) fail(`clicking the toggle should reveal r2's panel; panels: ${JSON.stringify(s2.panelRowIds)}`);

    await page.screenshot({ path: "/tmp/details-panel.png" });
    console.log(`✓ details panels: pre-expanded render + markdown + toggle reveal (${s2.panelRowIds.length} open). Screenshot → /tmp/details-panel.png`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
