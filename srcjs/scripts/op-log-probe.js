import puppeteer from "puppeteer";
import path from "path";

async function main(htmlPath) {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.log("[ERR]", e.message));
    await page.goto(`file://${path.resolve(htmlPath)}`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".tabviz-container");
    const out = await page.evaluate(async () => {
      const stores = globalThis.__tabvizStoreRegistry;
      const key = stores instanceof Map ? [...stores.keys()][0] : Object.keys(stores)[0];
      const store = stores instanceof Map ? stores.get(key) : stores[key];
      // Simulate slider drag: 10 ratio changes
      store.setTargetAspectAnchor("auto");
      const values = [0.929, 0.961, 0.975, 1.002, 1.023, 1.059, 1.074, 1.112, 1.120, 1.143];
      for (const r of values) {
        store.setTargetAspect(r);
        await new Promise(res => setTimeout(res, 5));
      }
      return {
        opLogCount: store.opLog?.length,
        opLogKinds: store.opLog?.map(o => o.kind),
        opLogCalls: store.opLog?.map(o => o.rCall),
      };
    });
    console.log("op log length:", out.opLogCount);
    console.log("kinds:", out.opLogKinds);
    console.log("calls:", out.opLogCalls);
  } finally { await browser.close(); }
}
main(process.argv[2]).catch(e => { console.error(e); process.exit(1); });
