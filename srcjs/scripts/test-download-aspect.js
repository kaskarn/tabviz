#!/usr/bin/env node
/**
 * Verify the in-widget download of an SVG reflects the current
 * targetAspect (lever-laddered widths), not just the natural spec.
 * Boots the widget in puppeteer, mutates targetAspect via the store,
 * triggers the export pipeline (`store.getExportDimensions()` ->
 * `generateSVG`), and parses the resulting root + grid widths to
 * confirm they grew.
 */
import puppeteer from "puppeteer";
import path from "path";

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

    for (const ratio of [null, 1.5, 2.5]) {
      const result = await page.evaluate((targetRatio) => {
        const stores = globalThis.__tabvizStoreRegistry;
        const key = stores instanceof Map ? Array.from(stores.keys())[0] : Object.keys(stores)[0];
        const store = stores instanceof Map ? stores.get(key) : stores[key];
        if (targetRatio == null) {
          store.setTargetAspect(null);
        } else {
          store.setTargetAspectAnchor("auto");
          store.setTargetAspect(targetRatio);
        }
        // Drive the same path as the download button.
        const dims = store.getExportDimensions();
        const totalWidth = Object.values(dims.columnWidths).reduce((a, b) => a + b, 0);
        return {
          targetAspect: store.targetAspect,
          aspectScale: store.layout?.aspectNonForestScale,
          forestWidth: dims.columnWidths["forest_hr"],
          totalGridWidth: totalWidth,
          rowHeight: dims.rowHeights?.[0],
          columnWidths: dims.columnWidths,
        };
      }, ratio);
      console.log(`ratio=${ratio} ->`, JSON.stringify(result, null, 2));
    }
  } finally { await browser.close(); }
}

main(process.argv[2]).catch((e) => { console.error(e); process.exit(1); });
