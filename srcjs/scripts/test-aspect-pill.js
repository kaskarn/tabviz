#!/usr/bin/env node
/**
 * Verify the aspect-lock pill appears when targetAspect is set, hides
 * when null, and clears the lock on click.
 */
import puppeteer from "puppeteer";
import path from "path";

async function main(htmlPath, outDir) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 2 });
    await page.goto(`file://${path.resolve(htmlPath)}`, {
      waitUntil: "networkidle0", timeout: 30000,
    });
    await page.waitForSelector(".tabviz-container", { timeout: 10000 });

    const probe = async () => page.evaluate(() => {
      const pill = document.querySelector(".aspect-lock-pill");
      return {
        pillVisible: !!pill,
        pillText: pill?.textContent?.trim().replace(/\s+/g, " "),
      };
    });

    // 1. natural — pill should be hidden
    let p = await probe();
    console.log("natural:", JSON.stringify(p));
    if (p.pillVisible) console.log("  FAIL: pill visible at natural");

    // 2. drag slider to ratio=2
    await page.evaluate(() => {
      const stores = globalThis.__tabvizStoreRegistry;
      const key = stores instanceof Map ? Array.from(stores.keys())[0] : Object.keys(stores)[0];
      const store = stores instanceof Map ? stores.get(key) : stores[key];
      store.setTargetAspectAnchor("auto");
      store.setTargetAspect(2.0);
    });
    await new Promise((r) => setTimeout(r, 150));
    p = await probe();
    console.log("ratio=2:", JSON.stringify(p));
    if (!p.pillVisible) console.log("  FAIL: pill hidden when locked");

    // Hover the widget so the floating toolbar fades in.
    await page.hover(".tabviz-container");
    await new Promise((r) => setTimeout(r, 250));
    await page.screenshot({ path: path.join(outDir, "01-pill-visible.png") });

    // 3. click pill → expect lock cleared
    await page.evaluate(() => {
      const pill = document.querySelector(".aspect-lock-pill");
      pill?.click();
    });
    await new Promise((r) => setTimeout(r, 150));
    p = await probe();
    console.log("after click:", JSON.stringify(p));
    if (p.pillVisible) console.log("  FAIL: pill still visible after click");

    const tgt = await page.evaluate(() => {
      const stores = globalThis.__tabvizStoreRegistry;
      const key = stores instanceof Map ? Array.from(stores.keys())[0] : Object.keys(stores)[0];
      const store = stores instanceof Map ? stores.get(key) : stores[key];
      return store.targetAspect;
    });
    console.log("targetAspect after click:", tgt);

    await page.screenshot({ path: path.join(outDir, "02-after-release.png") });
  } finally { await browser.close(); }
}

const args = process.argv.slice(2);
const fs = await import("fs/promises");
const outDir = args[1] ?? "/tmp/aspect_pill_test";
await fs.mkdir(outDir, { recursive: true });
await main(args[0], outDir);
