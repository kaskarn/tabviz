// Drives the widget at ratio=2 anchor=auto, downloads the SVG to disk,
// then renders it back to PNG so we can eyeball whether it looks like
// what the user sees on screen.
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

    for (const [name, ratio] of [["natural", null], ["ratio_2_auto", 2.0], ["ratio_3_auto", 3.0]]) {
      const svg = await page.evaluate(async ({ ratio }) => {
        const stores = globalThis.__tabvizStoreRegistry;
        const key = stores instanceof Map ? Array.from(stores.keys())[0] : Object.keys(stores)[0];
        const store = stores instanceof Map ? stores.get(key) : stores[key];
        if (ratio == null) {
          store.setTargetAspect(null);
        } else {
          store.setTargetAspectAnchor("auto");
          store.setTargetAspect(ratio);
        }
        await new Promise((r) => setTimeout(r, 100));
        const dims = store.getExportDimensions();
        const tabviz = globalThis.__tabvizExports;
        return tabviz.exportToSVG(store.exportSpec ?? store.spec, dims);
      }, { ratio });
      const out = path.join(outDir, `${name}.svg`);
      await fs.writeFile(out, svg);
      console.log(`wrote ${out} (${svg.length} bytes)`);
    }
  } finally { await browser.close(); }
}

main(process.argv[2], process.argv[3] ?? "/tmp/aspect_svg_dump").catch((e) => {
  console.error(e); process.exit(1);
});
