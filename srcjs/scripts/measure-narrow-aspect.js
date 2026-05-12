#!/usr/bin/env node
// Measure achieved-vs-requested aspect for narrow + wide ratios.
// Loads a tabviz HTML widget, drives the store at each requested ratio,
// downloads the SVG, parses root <svg> width/height, reports the table.

import puppeteer from "puppeteer";
import path from "path";
import fs from "fs/promises";

function parseSvgDims(svg) {
  // root <svg ... width="..." height="..." viewBox="0 0 W H">
  const head = svg.slice(0, 2000);
  const wMatch = head.match(/<svg[^>]*\swidth="([^"]+)"/);
  const hMatch = head.match(/<svg[^>]*\sheight="([^"]+)"/);
  const vbMatch = head.match(/<svg[^>]*\sviewBox="([^"]+)"/);
  const w = wMatch ? parseFloat(wMatch[1]) : NaN;
  const h = hMatch ? parseFloat(hMatch[1]) : NaN;
  let vb = null;
  if (vbMatch) {
    const parts = vbMatch[1].trim().split(/\s+/).map(Number);
    if (parts.length === 4) vb = { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
  }
  return { w, h, vb };
}

async function main(htmlPath, outDir) {
  await fs.mkdir(outDir, { recursive: true });
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const results = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
    page.on("pageerror", (e) => console.log("[PAGE ERROR]", e.message));
    await page.goto(`file://${path.resolve(htmlPath)}`, {
      waitUntil: "networkidle0", timeout: 30000,
    });
    await page.waitForSelector(".tabviz-container", { timeout: 10000 });

    // First measure natural aspect for reference.
    const natural = await page.evaluate(async () => {
      const stores = globalThis.__tabvizStoreRegistry;
      const key = stores instanceof Map ? Array.from(stores.keys())[0] : Object.keys(stores)[0];
      const store = stores instanceof Map ? stores.get(key) : stores[key];
      store.setTargetAspect(null);
      await new Promise((r) => setTimeout(r, 100));
      const dims = store.getExportDimensions();
      return { dims, naturalAspect: store.naturalAspect ?? null };
    });
    console.log("natural dims:", natural.dims, "naturalAspect:", natural.naturalAspect);

    const ratios = [0.3, 0.5, 0.7, 0.9, 1.0, 1.5, 2.0, 3.0];
    const anchors = ["auto"];

    for (const anchor of anchors) {
      for (const ratio of ratios) {
        const r = await page.evaluate(async ({ ratio, anchor }) => {
          const stores = globalThis.__tabvizStoreRegistry;
          const key = stores instanceof Map ? Array.from(stores.keys())[0] : Object.keys(stores)[0];
          const store = stores instanceof Map ? stores.get(key) : stores[key];
          store.setTargetAspectAnchor(anchor);
          store.setTargetAspect(ratio);
          await new Promise((res) => setTimeout(res, 120));
          const dims = store.getExportDimensions();
          const tabviz = globalThis.__tabvizExports;
          let svg = null, err = null;
          try {
            svg = tabviz.exportToSVG(store.exportSpec ?? store.spec, dims);
          } catch (e) {
            err = e.message;
          }
          return {
            dims,
            targetAspect: store.targetAspect,
            anchor: store.targetAspectAnchor,
            svgLen: svg ? svg.length : 0,
            svgHead: svg ? svg.slice(0, 600) : null,
            error: err,
          };
        }, { ratio, anchor });

        const dims = parseSvgDims(r.svgHead || "");
        const achieved = dims.w && dims.h ? dims.w / dims.h : null;
        const dimsAchieved = r.dims && r.dims.width && r.dims.height
          ? r.dims.width / r.dims.height : null;
        results.push({
          requested: ratio,
          anchor,
          dims_widget: r.dims,
          svg_w: dims.w,
          svg_h: dims.h,
          svg_viewBox: dims.vb,
          aspect_from_svg: achieved,
          aspect_from_widget_dims: dimsAchieved,
          error: r.error,
        });
        if (r.svgHead) {
          await fs.writeFile(path.join(outDir, `r_${ratio}_${anchor}.svg.head.txt`), r.svgHead);
        }
      }
    }
  } finally { await browser.close(); }

  console.log("\n=== RESULTS ===");
  console.log(JSON.stringify({ results }, null, 2));

  // Print compact table
  console.log("\nrequested\tanchor\tsvg_w\tsvg_h\taspect_svg\tdims_w\tdims_h\taspect_dims");
  for (const r of results) {
    console.log([
      r.requested,
      r.anchor,
      r.svg_w?.toFixed(1),
      r.svg_h?.toFixed(1),
      r.aspect_from_svg?.toFixed(3),
      r.dims_widget?.width?.toFixed(1),
      r.dims_widget?.height?.toFixed(1),
      r.aspect_from_widget_dims?.toFixed(3),
    ].join("\t"));
  }
}

main(process.argv[2], process.argv[3] ?? "/tmp/narrow_aspect_measure").catch((e) => {
  console.error(e); process.exit(1);
});
