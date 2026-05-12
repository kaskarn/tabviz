// WYSIWYG probe: at ratio=0.75 anchor=auto, capture both
//   (a) the live store's reported scaled rowHeight / headerHeight / axisHeight
//   (b) the downloaded SVG's actual row spacing & SVG dimensions
// Compares them to expose any divergence.
import puppeteer from "puppeteer";
import path from "path";
import fs from "fs/promises";

async function main(htmlPath, outDir) {
  await fs.mkdir(outDir, { recursive: true });
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.log("[PAGE ERROR]", e.message));
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
    await page.goto(`file://${path.resolve(htmlPath)}`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".tabviz-container");

    for (const ratio of [0.5, 0.75, 1.0]) {
      const out = await page.evaluate(async (r) => {
        const stores = globalThis.__tabvizStoreRegistry;
        const key = stores instanceof Map ? [...stores.keys()][0] : Object.keys(stores)[0];
        const store = stores instanceof Map ? stores.get(key) : stores[key];
        store.setTargetAspectAnchor("auto");
        store.setTargetAspect(r);
        await new Promise(res => setTimeout(res, 150));
        const L = store.layout;
        const D = store.getExportDimensions();
        const tabviz = globalThis.__tabvizExports;
        const svg = tabviz.exportToSVG(store.exportSpec ?? store.spec, D);
        return {
          live: {
            rowHeight: L?.rowHeight,
            headerHeight: L?.headerHeight,
            axisHeight: L?.axisHeight,
            chromeScale: L?.chromeScale,
            aspectTargetWidth: L?.aspectTargetWidth,
            aspectTargetHeight: L?.aspectTargetHeight,
            totalWidth: L?.totalWidth,
            totalHeight: L?.totalHeight,
          },
          exportDims: {
            width: D?.width, height: D?.height,
            naturalWidth: D?.naturalWidth, naturalHeight: D?.naturalHeight,
            firstRowHeight: D?.rowHeights?.[0],
            totalRowsHeight: D?.totalRowsHeight,
            exportHeaderHeight: D?.headerHeight,
          },
          svg,
        };
      }, ratio);

      const svgHead = out.svg.slice(0, 800);
      const wM = svgHead.match(/<svg[^>]*\swidth="([^"]+)"/);
      const hM = svgHead.match(/<svg[^>]*\sheight="([^"]+)"/);
      const svgW = wM ? parseFloat(wM[1]) : NaN;
      const svgH = hM ? parseFloat(hM[1]) : NaN;
      await fs.writeFile(path.join(outDir, `ratio_${ratio}.svg`), out.svg);

      // Probe SVG: look for the first <g class="row"> and parse its transform
      // to get the actual rendered row position (proxy for row height).
      const rowMatches = [...out.svg.matchAll(/<g[^>]*class="[^"]*\brow\b[^"]*"[^>]*transform="translate\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)\)/g)];
      const firstRowY = rowMatches[0] ? parseFloat(rowMatches[0][2]) : null;
      const secondRowY = rowMatches[1] ? parseFloat(rowMatches[1][2]) : null;
      const inferredRowHeight = (firstRowY != null && secondRowY != null) ? secondRowY - firstRowY : null;

      console.log(`\n=== ratio ${ratio} ===`);
      console.log(`  live:  rowH=${out.live.rowHeight?.toFixed(1)}  headerH=${out.live.headerHeight?.toFixed(1)}  axisH=${out.live.axisHeight?.toFixed(1)}  chromeScale=${out.live.chromeScale?.toFixed(2)}  total=${out.live.totalWidth?.toFixed(0)}x${out.live.totalHeight?.toFixed(0)}`);
      console.log(`  dims:  w=${out.exportDims.width?.toFixed(0)}  h=${out.exportDims.height?.toFixed(0)}  firstRowH=${out.exportDims.firstRowHeight?.toFixed(1)}  exportHeaderH=${out.exportDims.exportHeaderHeight?.toFixed(1)}`);
      console.log(`  svg:   ${svgW.toFixed(0)}x${svgH.toFixed(0)}  inferredRowH=${inferredRowHeight?.toFixed(1) ?? 'n/a'}`);
      const match = Math.abs((out.live.rowHeight ?? 0) - (inferredRowHeight ?? 0)) < 1.0 ? "MATCH" : "DIVERGE";
      console.log(`  WYSIWYG row-height check: ${match}`);
    }
  } finally { await browser.close(); }
}

main(process.argv[2], process.argv[3] ?? "/tmp/wysiwyg_probe").catch(e => {
  console.error(e); process.exit(1);
});
