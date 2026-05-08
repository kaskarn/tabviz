#!/usr/bin/env node
/**
 * Aspect-ratio slider diagnostic. Renders a tabviz widget HTML in
 * Puppeteer, exercises the aspect-ratio slider programmatically (via
 * direct store mutation), and reports back what changed in the DOM.
 *
 * Use this when the live slider "doesn't visibly do anything" so we
 * can see exactly which layer is misbehaving:
 *   - Is the store accepting the targetAspect / anchor?
 *   - Is the layout-derived getter producing different values?
 *   - Is the rendered DOM actually wider / taller?
 *   - Is the auto-fit transform shrinking content back?
 *
 * Usage:
 *   node scripts/diagnose-aspect.js <widget.html> [--canvas=800] [--ratio=2]
 */

import puppeteer from "puppeteer";
import path from "path";

async function diagnose(htmlPath, opts = {}) {
  const canvas = opts.canvas ?? 800;
  const ratio = opts.ratio ?? 2;
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // Surface console logs so the in-store/component debug emits show.
    page.on("console", (msg) => {
      const t = msg.type();
      if (t === "debug" || t === "log" || t === "warn") {
        console.log(`[${t.toUpperCase()}]`, msg.text());
      }
    });

    await page.setViewport({ width: canvas, height: 600 });
    const absolutePath = path.resolve(htmlPath);
    await page.goto(`file://${absolutePath}`, {
      waitUntil: "networkidle0", timeout: 30000,
    });
    await page.waitForSelector(".tabviz-container", { timeout: 10000 });

    // Probe pre-state.
    const before = await page.evaluate(() => {
      const c = document.querySelector(".tabviz-container");
      const s = document.querySelector(".tabviz-scalable");
      const main = document.querySelector(".tabviz-main");
      const containerStyle = c ? getComputedStyle(c) : null;
      const scalableStyle = s ? getComputedStyle(s) : null;
      return {
        containerClasses: c?.className,
        containerOverflow: containerStyle?.overflow,
        scalableTransform: scalableStyle?.transform,
        scalableWidth: s?.getBoundingClientRect().width,
        scalableHeight: s?.getBoundingClientRect().height,
        mainWidth: main?.getBoundingClientRect().width,
        mainHeight: main?.getBoundingClientRect().height,
        cssVars: c ? {
          actualScale: containerStyle?.getPropertyValue("--tv-actual-scale"),
          zoom: containerStyle?.getPropertyValue("--tv-zoom"),
        } : null,
      };
    });

    console.log("\n=== BEFORE ===");
    console.log(JSON.stringify(before, null, 2));

    // Drive the store directly. The widget exposes its store via the
    // global `tabvizStores` registry keyed by container element id.
    const storeProbe = await page.evaluate((targetRatio) => {
      // Find the store. The htmlwidgets binding stashes it in a Map
      // somewhere; we'll look for it on the global scope first.
      const stores = (globalThis).__tabvizStoreRegistry
        || (globalThis).__tabvizStores
        || (globalThis).tabvizStores;
      if (!stores) return { error: "no store registry on globalThis", keys: Object.keys(globalThis).filter(k => k.toLowerCase().includes("tabviz")) };
      const keys = stores instanceof Map ? Array.from(stores.keys()) : Object.keys(stores);
      if (keys.length === 0) return { error: "store registry is empty" };
      const store = stores instanceof Map ? stores.get(keys[0]) : stores[keys[0]];
      const probe = {
        targetAspectBefore: store.targetAspect,
        anchorBefore: store.targetAspectAnchor,
      };
      // Mutate.
      store.setTargetAspectAnchor("auto");
      store.setTargetAspect(targetRatio);
      probe.targetAspectAfter = store.targetAspect;
      probe.anchorAfter = store.targetAspectAnchor;
      // Layout snapshot.
      probe.layoutSnapshot = {
        totalWidth: store.layout?.totalWidth,
        totalHeight: store.layout?.totalHeight,
        forestWidth: store.layout?.forestWidth,
        rowHeight: store.layout?.rowHeight,
      };
      // Spec column inspection — is forest column carrying an
      // explicit width that's overriding layout.forestWidth?
      const spec = store.spec;
      const forestCol = spec?.columns?.find?.((c) => c.type === "forest");
      probe.forestColInspect = forestCol ? {
        width: forestCol.width,
        optionsForestWidth: forestCol.options?.forest?.width,
      } : null;
      // What does the store say about per-column widths?
      probe.columnWidths = store.columnWidths;
      // And the plotWidth override (resizable forest)?
      probe.plotWidthOverride = store.getPlotWidth ? store.getPlotWidth() : "n/a";
      return probe;
    }, ratio);

    console.log("\n=== STORE MUTATION ===");
    console.log(JSON.stringify(storeProbe, null, 2));

    // Wait a tick for reactive layout.
    await new Promise((r) => setTimeout(r, 300));

    // Force reflow + window resize to nudge any stale ResizeObserver paths.
    await page.evaluate(() => {
      window.dispatchEvent(new Event("resize"));
      void document.body.offsetWidth;
    });
    await new Promise((r) => setTimeout(r, 300));

    const after = await page.evaluate(() => {
      const c = document.querySelector(".tabviz-container");
      const s = document.querySelector(".tabviz-scalable");
      const main = document.querySelector(".tabviz-main");
      const body = document.body;
      const containerStyle = c ? getComputedStyle(c) : null;
      const scalableStyle = s ? getComputedStyle(s) : null;
      const mainStyle = main ? getComputedStyle(main) : null;
      return {
        containerClasses: c?.className,
        containerOverflow: containerStyle?.overflow,
        containerWidth: c?.getBoundingClientRect().width,
        scalableTransform: scalableStyle?.transform,
        scalableWidth: s?.getBoundingClientRect().width,
        scalableHeight: s?.getBoundingClientRect().height,
        mainWidth: main?.getBoundingClientRect().width,
        mainHeight: main?.getBoundingClientRect().height,
        mainScrollWidth: main?.scrollWidth,
        mainGridTemplate: mainStyle?.gridTemplateColumns,
        bodyWidth: body.getBoundingClientRect().width,
        windowInnerWidth: window.innerWidth,
        cssVars: c ? {
          actualScale: containerStyle?.getPropertyValue("--tv-actual-scale"),
          zoom: containerStyle?.getPropertyValue("--tv-zoom"),
        } : null,
      };
    });

    console.log("\n=== AFTER ===");
    console.log(JSON.stringify(after, null, 2));

    console.log("\n=== DELTA ===");
    console.log(`mainWidth: ${before.mainWidth} -> ${after.mainWidth} (Δ ${(after.mainWidth - before.mainWidth).toFixed(1)})`);
    console.log(`mainHeight: ${before.mainHeight} -> ${after.mainHeight} (Δ ${(after.mainHeight - before.mainHeight).toFixed(1)})`);
    console.log(`scalable WxH: ${before.scalableWidth}x${before.scalableHeight} -> ${after.scalableWidth}x${after.scalableHeight}`);
    console.log(`transform: ${before.scalableTransform} -> ${after.scalableTransform}`);
    console.log(`overflow: ${before.containerOverflow} -> ${after.containerOverflow}`);
    console.log(`classes: ${before.containerClasses} -> ${after.containerClasses}`);
  } finally {
    await browser.close();
  }
}

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: diagnose-aspect.js <widget.html> [--canvas=800] [--ratio=2]");
  process.exit(1);
}
const opts = {};
const positional = [];
for (const a of args) {
  if (a.startsWith("--canvas=")) opts.canvas = parseInt(a.split("=")[1], 10);
  else if (a.startsWith("--ratio=")) opts.ratio = parseFloat(a.split("=")[1]);
  else positional.push(a);
}
diagnose(positional[0], opts).catch((e) => {
  console.error(e);
  process.exit(1);
});
