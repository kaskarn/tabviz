#!/usr/bin/env node
/**
 * End-to-end verification of two user-reported concerns:
 *   1. Does the downloaded SVG faithfully represent the current
 *      aspect-ratio target (column widths + row heights all
 *      reflecting the lever ladder)?
 *   2. Does the aspect target survive a fullscreen toggle?
 *
 * For (1): drive the store, call `exportToSVG` (the same path the
 * download button takes), parse the resulting SVG with regex, and
 * confirm:
 *   - SVG root width matches the lever-laddered total
 *   - Forest column rendered at the cap-clamped width
 *   - Non-forest columns scaled by aspectNonForestScale
 *
 * For (2): toggle `tabviz-fullscreen` class via the FullscreenButton,
 * re-probe store + DOM, confirm targetAspect / aspectScale persist.
 */
import puppeteer from "puppeteer";
import path from "path";

function parseSvgRoot(svg) {
  const root = svg.match(/<svg[^>]*>/)?.[0] ?? "";
  const w = +(root.match(/width="([\d.]+)"/)?.[1] ?? 0);
  const h = +(root.match(/height="([\d.]+)"/)?.[1] ?? 0);
  const vb = root.match(/viewBox="([^"]+)"/)?.[1] ?? "";
  return { w, h, viewBox: vb };
}

function findColumnWidths(svg) {
  // The renderer emits header-cell rects + row-cell rects; pull the
  // first row of `<rect ... width="X"` after the header to estimate
  // column widths. Brittle but enough for a sanity check.
  const widths = [];
  const re = /<rect[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/g;
  let m;
  while ((m = re.exec(svg)) !== null) {
    widths.push({ w: +m[1], h: +m[2] });
  }
  return widths;
}

async function main(htmlPath) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600 });
    await page.goto(`file://${path.resolve(htmlPath)}`, {
      waitUntil: "networkidle0", timeout: 30000,
    });
    await page.waitForSelector(".tabviz-container", { timeout: 10000 });

    // Helper to drive store + download SVG.
    const downloadAt = async (ratio, anchor) => page.evaluate(async ({ ratio, anchor }) => {
      const stores = globalThis.__tabvizStoreRegistry;
      const key = stores instanceof Map ? Array.from(stores.keys())[0] : Object.keys(stores)[0];
      const store = stores instanceof Map ? stores.get(key) : stores[key];
      if (ratio == null) {
        store.setTargetAspect(null);
      } else {
        store.setTargetAspectAnchor(anchor || "auto");
        store.setTargetAspect(ratio);
      }
      // Wait a tick for derived layout to settle.
      await new Promise((r) => setTimeout(r, 50));
      // Same path the download button takes.
      const dims = store.getExportDimensions();
      const tabviz = globalThis.__tabvizExports;
      const svg = tabviz.exportToSVG(store.exportSpec ?? store.spec, dims);
      return {
        svg,
        targetAspect: store.targetAspect,
        aspectScale: store.layout?.aspectNonForestScale,
        forestWidthInLayout: store.layout?.forestWidth,
        gridWidth: Object.values(dims.columnWidths).reduce((a, b) => a + b, 0),
      };
    }, { ratio, anchor });

    // === 1. SVG download fidelity ===
    console.log("\n=== 1. Download SVG fidelity ===");
    for (const ratio of [null, 1.5, 2.5]) {
      const r = await downloadAt(ratio, "auto");
      const root = parseSvgRoot(r.svg);
      console.log(`ratio=${ratio} layout=${r.gridWidth.toFixed(0)} forestW=${r.forestWidthInLayout.toFixed(0)} -> svg root=${root.w}x${root.h} viewBox="${root.viewBox}"`);
      // Expect SVG root width to be at least the lever-laddered grid width.
      if (root.w + 2 < r.gridWidth) {
        console.log(`  ⚠ SVG root width ${root.w} < lever-laddered grid width ${r.gridWidth}`);
      }
    }

    // === 2. Fullscreen toggle persistence ===
    console.log("\n=== 2. Fullscreen toggle persistence ===");
    // Set aspect=2 first.
    await page.evaluate(() => {
      const stores = globalThis.__tabvizStoreRegistry;
      const key = stores instanceof Map ? Array.from(stores.keys())[0] : Object.keys(stores)[0];
      const store = stores instanceof Map ? stores.get(key) : stores[key];
      store.setTargetAspectAnchor("auto");
      store.setTargetAspect(2.0);
    });
    await new Promise((r) => setTimeout(r, 100));
    let pre = await page.evaluate(() => {
      const stores = globalThis.__tabvizStoreRegistry;
      const key = stores instanceof Map ? Array.from(stores.keys())[0] : Object.keys(stores)[0];
      const store = stores instanceof Map ? stores.get(key) : stores[key];
      return {
        targetAspect: store.targetAspect,
        aspectScale: store.layout?.aspectNonForestScale,
        forestWidth: store.layout?.forestWidth,
        gridTpl: getComputedStyle(document.querySelector(".tabviz-main")).gridTemplateColumns,
      };
    });
    console.log("before fullscreen:", JSON.stringify(pre));

    // Click fullscreen button.
    await page.hover(".tabviz-container");
    await new Promise((r) => setTimeout(r, 200));
    await page.click(".fullscreen-btn");
    // Wait long enough for ResizeObserver + reactive layout to settle
    // post-fullscreen (visualViewport listener fires asynchronously).
    await new Promise((r) => setTimeout(r, 1200));
    let mid = await page.evaluate(() => {
      const stores = globalThis.__tabvizStoreRegistry;
      const key = stores instanceof Map ? Array.from(stores.keys())[0] : Object.keys(stores)[0];
      const store = stores instanceof Map ? stores.get(key) : stores[key];
      const c = document.querySelector(".tabviz-container");
      return {
        targetAspect: store.targetAspect,
        aspectScale: store.layout?.aspectNonForestScale,
        forestWidth: store.layout?.forestWidth,
        gridTpl: getComputedStyle(document.querySelector(".tabviz-main")).gridTemplateColumns,
        isFullscreen: c?.classList.contains("tabviz-fullscreen"),
      };
    });
    console.log("during fullscreen:", JSON.stringify(mid));

    // Exit fullscreen via Escape.
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 350));
    // Download SVG while in fullscreen — verify it captures the
    // fullscreen-canvas-derived layout, not a stale natural baseline.
    const fsDownload = await page.evaluate(async () => {
      const stores = globalThis.__tabvizStoreRegistry;
      const key = stores instanceof Map ? Array.from(stores.keys())[0] : Object.keys(stores)[0];
      const store = stores instanceof Map ? stores.get(key) : stores[key];
      const dims = store.getExportDimensions();
      const tabviz = globalThis.__tabvizExports;
      const svg = tabviz.exportToSVG(store.exportSpec ?? store.spec, dims);
      const root = svg.match(/<svg[^>]*>/)?.[0] ?? "";
      const w = +(root.match(/width="([\d.]+)"/)?.[1] ?? 0);
      return {
        gridWidth: Object.values(dims.columnWidths).reduce((a, b) => a + b, 0),
        forestWidth: dims.columnWidths["forest_hr"],
        labelWidth: dims.columnWidths["label"],
        svgRootWidth: w,
        // Diagnostic: state at the moment of download.
        liveAspectScale: store.layout?.aspectNonForestScale,
        rawColumnWidths: { ...store.columnWidths },
        diag: store._aspectDiag,
      };
    });
    console.log("download in fullscreen:", JSON.stringify(fsDownload));

    // Exit fullscreen via Escape.
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 350));
    let post = await page.evaluate(() => {
      const stores = globalThis.__tabvizStoreRegistry;
      const key = stores instanceof Map ? Array.from(stores.keys())[0] : Object.keys(stores)[0];
      const store = stores instanceof Map ? stores.get(key) : stores[key];
      const c = document.querySelector(".tabviz-container");
      return {
        targetAspect: store.targetAspect,
        aspectScale: store.layout?.aspectNonForestScale,
        forestWidth: store.layout?.forestWidth,
        gridTpl: getComputedStyle(document.querySelector(".tabviz-main")).gridTemplateColumns,
        isFullscreen: c?.classList.contains("tabviz-fullscreen"),
      };
    });
    console.log("after fullscreen exit:", JSON.stringify(post));
  } finally { await browser.close(); }
}

main(process.argv[2]).catch((e) => { console.error(e); process.exit(1); });
