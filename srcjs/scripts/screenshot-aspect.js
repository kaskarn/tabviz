#!/usr/bin/env node
/**
 * Aspect-ratio slider visual investigation. For each (ratio, anchor)
 * combination, drives the store programmatically and screenshots the
 * widget. Output: a directory of PNGs you can flip through to see what
 * the user sees.
 *
 * Usage:
 *   node scripts/screenshot-aspect.js <widget.html> [outdir] [--canvas=800]
 */

import puppeteer from "puppeteer";
import path from "path";
import fs from "fs/promises";

async function shoot(page, outDir, name) {
  // Viewport-only screenshot — what the user actually sees in their
  // canvas area. Per-element shots (page.$().screenshot()) extend
  // beyond the canvas when content overflows + auto-fit transforms.
  await page.screenshot({
    path: path.join(outDir, `${name}.png`),
    fullPage: false,
  });
}

async function setAspect(page, ratio, anchor) {
  return page.evaluate(({ ratio, anchor }) => {
    const stores = globalThis.__tabvizStoreRegistry;
    if (!stores) return { error: "no registry" };
    const key = stores instanceof Map ? Array.from(stores.keys())[0] : Object.keys(stores)[0];
    const store = stores instanceof Map ? stores.get(key) : stores[key];
    if (ratio == null) {
      store.setTargetAspect(null);
    } else {
      store.setTargetAspectAnchor(anchor);
      store.setTargetAspect(ratio);
    }
    // Snapshot what the store reports for this configuration.
    return {
      targetAspect: store.targetAspect,
      anchor: store.targetAspectAnchor,
      layoutTotal: store.layout?.totalWidth + "x" + store.layout?.totalHeight,
      forestWidth: store.layout?.forestWidth,
      rowHeight: store.layout?.rowHeight,
      aspectDiag: store._aspectDiag,
    };
  }, { ratio, anchor });
}

async function probeDom(page) {
  return page.evaluate(() => {
    const c = document.querySelector(".tabviz-container");
    const s = document.querySelector(".tabviz-scalable");
    const main = document.querySelector(".tabviz-main");
    const cs = c ? getComputedStyle(c) : null;
    const ss = s ? getComputedStyle(s) : null;
    const ms = main ? getComputedStyle(main) : null;
    return {
      classes: c?.className,
      overflow: cs?.overflow,
      transform: ss?.transform,
      gridTemplate: ms?.gridTemplateColumns,
      containerW: c?.getBoundingClientRect().width,
      mainW: main?.getBoundingClientRect().width,
      mainH: main?.getBoundingClientRect().height,
      mainScrollW: main?.scrollWidth,
      scalableW: s?.getBoundingClientRect().width,
      scalableH: s?.getBoundingClientRect().height,
    };
  });
}

async function main(htmlPath, outDir, opts = {}) {
  const canvas = opts.canvas ?? 800;
  await fs.mkdir(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: canvas, height: 600, deviceScaleFactor: 2 });
    page.on("console", (msg) => {
      if (msg.type() === "warn" || msg.type() === "error") {
        console.log(`[${msg.type().toUpperCase()}]`, msg.text());
      }
    });

    const absolutePath = path.resolve(htmlPath);
    await page.goto(`file://${absolutePath}`, {
      waitUntil: "networkidle0", timeout: 30000,
    });
    await page.waitForSelector(".tabviz-container", { timeout: 10000 });

    const scenarios = [
      { name: "01-natural",        ratio: null,  anchor: "auto" },
      { name: "02-ratio-1.5-auto", ratio: 1.5,   anchor: "auto" },
      { name: "03-ratio-2.0-auto", ratio: 2.0,   anchor: "auto" },
      { name: "04-ratio-3.0-auto", ratio: 3.0,   anchor: "auto" },
      { name: "05-ratio-2.0-width",ratio: 2.0,   anchor: "width" },
      { name: "06-ratio-0.7-auto", ratio: 0.7,   anchor: "auto" },
      { name: "07-ratio-0.4-auto", ratio: 0.4,   anchor: "auto" },
    ];

    const summary = [];
    for (const s of scenarios) {
      const storeReport = await setAspect(page, s.ratio, s.anchor);
      await new Promise((r) => setTimeout(r, 400));
      const dom = await probeDom(page);
      await shoot(page, outDir, s.name);
      summary.push({ ...s, storeReport, dom });
      console.log(`[${s.name}] store=${JSON.stringify(storeReport)}`);
      console.log(`           dom=${JSON.stringify(dom)}`);
    }

    await fs.writeFile(
      path.join(outDir, "summary.json"),
      JSON.stringify(summary, null, 2),
    );
    console.log(`\nScreenshots + summary.json written to ${outDir}`);
  } finally {
    await browser.close();
  }
}

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: screenshot-aspect.js <widget.html> [outdir] [--canvas=800]");
  process.exit(1);
}
const opts = {};
const positional = [];
for (const a of args) {
  if (a.startsWith("--canvas=")) opts.canvas = parseInt(a.split("=")[1], 10);
  else positional.push(a);
}
main(positional[0], positional[1] ?? "/tmp/aspect_screenshots", opts).catch((e) => {
  console.error(e); process.exit(1);
});
