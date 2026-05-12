/**
 * WYSIWYG verification: side-by-side of (a) live-widget viewport
 * screenshot at ratio=2 anchor=auto and (b) downloaded SVG -> PNG at
 * the same settings. The two should be visually equivalent — same
 * column widths, same row heights, same overall layout.
 */
import puppeteer from "puppeteer";
import path from "path";
import fs from "fs/promises";

async function main(htmlPath, outDir) {
  await fs.mkdir(outDir, { recursive: true });
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

    const ratio = 2.0;
    // Set aspect.
    await page.evaluate((r) => {
      const stores = globalThis.__tabvizStoreRegistry;
      const key = stores instanceof Map ? Array.from(stores.keys())[0] : Object.keys(stores)[0];
      const store = stores instanceof Map ? stores.get(key) : stores[key];
      store.setTargetAspectAnchor("auto");
      store.setTargetAspect(r);
    }, ratio);
    await new Promise((r) => setTimeout(r, 400));

    // Capture live-widget viewport (with toolbar hidden, so it doesn't
    // contaminate the comparison).
    await page.screenshot({ path: path.join(outDir, "live-widget.png"), fullPage: false });

    // Download SVG via the same path the download button uses.
    const svgString = await page.evaluate(() => {
      const stores = globalThis.__tabvizStoreRegistry;
      const key = stores instanceof Map ? Array.from(stores.keys())[0] : Object.keys(stores)[0];
      const store = stores instanceof Map ? stores.get(key) : stores[key];
      const dims = store.getExportDimensions();
      const tabviz = globalThis.__tabvizExports;
      return tabviz.exportToSVG(store.exportSpec ?? store.spec, dims);
    });
    await fs.writeFile(path.join(outDir, "downloaded.svg"), svgString);

    // Diagnostic info: store / layout state at the moment of capture.
    const diag = await page.evaluate(() => {
      const stores = globalThis.__tabvizStoreRegistry;
      const key = stores instanceof Map ? Array.from(stores.keys())[0] : Object.keys(stores)[0];
      const store = stores instanceof Map ? stores.get(key) : stores[key];
      const main = document.querySelector(".tabviz-main");
      const mainBox = main?.getBoundingClientRect();
      const scalable = document.querySelector(".tabviz-scalable");
      const scalableTransform = scalable ? getComputedStyle(scalable).transform : null;
      return {
        targetAspect: store.targetAspect,
        layoutTotalWidth: store.layout?.totalWidth,
        layoutTotalHeight: store.layout?.totalHeight,
        aspectScale: store.layout?.aspectNonForestScale,
        forestWidth: store.layout?.forestWidth,
        gridTemplate: getComputedStyle(main).gridTemplateColumns,
        mainBox: mainBox ? { w: mainBox.width, h: mainBox.height } : null,
        scalableTransform,
        actualScale: store._aspectDiag?.actualScale,
      };
    });
    console.log(JSON.stringify(diag, null, 2));
  } finally { await browser.close(); }
}

main(process.argv[2], process.argv[3] ?? "/tmp/wysiwyg_compare").catch((e) => {
  console.error(e); process.exit(1);
});
