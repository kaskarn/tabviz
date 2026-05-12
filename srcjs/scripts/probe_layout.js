import puppeteer from "puppeteer";
import path from "path";

async function main(htmlPath) {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.log("[PAGE ERROR]", e.message));
    await page.goto(`file://${path.resolve(htmlPath)}`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".tabviz-container");
    for (const ratio of [null, 0.3, 0.5, 1.0, 2.0]) {
      const out = await page.evaluate(async (r) => {
        const stores = globalThis.__tabvizStoreRegistry;
        const key = stores instanceof Map ? [...stores.keys()][0] : Object.keys(stores)[0];
        const store = stores instanceof Map ? stores.get(key) : stores[key];
        if (r == null) { store.setTargetAspect(null); }
        else { store.setTargetAspectAnchor("auto"); store.setTargetAspect(r); }
        await new Promise(res => setTimeout(res, 120));
        const L = store.layout;
        const D = store.getExportDimensions();
        return {
          ratio: store.targetAspect,
          anchor: store.targetAspectAnchor,
          aspectTargetWidth: L?.aspectTargetWidth,
          aspectTargetHeight: L?.aspectTargetHeight,
          chromeScale: L?.chromeScale,
          rowHeight: L?.rowHeight,
          headerHeight: L?.headerHeight,
          axisHeight: L?.axisHeight,
          plotHeight: L?.plotHeight,
          rowsCount: L?.rowHeights?.length,
          padding: store.spec?.theme?.spacing?.padding,
          totalWidth: L?.totalWidth,
          totalHeight: L?.totalHeight,
          actualScale: store.actualScale,
          isClamped: store.isClamped,
          dimsW: D?.width, dimsH: D?.height,
          dimsNW: D?.naturalWidth, dimsNH: D?.naturalHeight,
        };
      }, ratio);
      console.log(JSON.stringify(out));
    }
  } finally { await browser.close(); }
}
main(process.argv[2]).catch(e => { console.error(e); process.exit(1); });
