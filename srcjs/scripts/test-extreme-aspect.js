#!/usr/bin/env node
/**
 * Probe extreme aspect-ratio values for stack-overflow / NaN /
 * infinite-loop behaviour.
 */
import puppeteer from "puppeteer";
import path from "path";

async function main(htmlPath) {
  const browser = await puppeteer.launch({ headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600 });
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warn")
        console.log(`[${msg.type().toUpperCase()}]`, msg.text());
    });
    page.on("pageerror", (e) => console.log("[PAGE ERROR]", e.message));
    page.on("crash", () => console.log("[PAGE CRASHED]"));
    await page.goto(`file://${path.resolve(htmlPath)}`, {
      waitUntil: "networkidle0", timeout: 30000,
    });
    await page.waitForSelector(".tabviz-container", { timeout: 10000 });

    const tests = [
      { name: "natural", ratio: null },
      { name: "tiny ratio (0.001)", ratio: 0.001 },
      { name: "huge ratio (1000)", ratio: 1000 },
      { name: "extremely huge (1e6)", ratio: 1e6 },
      { name: "Infinity", ratio: Infinity },
      { name: "NaN", ratio: NaN },
      { name: "negative", ratio: -2 },
      { name: "0", ratio: 0 },
      { name: "rapid drag sequence", ratio: "sequence" },
    ];

    for (const t of tests) {
      console.log(`\n=== ${t.name} ===`);
      const result = await page.evaluate(async ({ ratio }) => {
        try {
          const stores = globalThis.__tabvizStoreRegistry;
          const key = stores instanceof Map ? Array.from(stores.keys())[0] : Object.keys(stores)[0];
          const store = stores instanceof Map ? stores.get(key) : stores[key];
          if (ratio === "sequence") {
            // Simulate rapid drag — do many writes back-to-back.
            store.setTargetAspectAnchor("auto");
            const sequence = [];
            for (let i = 0; i < 50; i++) {
              const v = 0.5 + (i % 10) * 0.5;  // 0.5..5
              store.setTargetAspect(v);
              sequence.push({ i, v, layout_w: store.layout?.totalWidth });
            }
            return { ok: true, last5: sequence.slice(-5) };
          }
          store.setTargetAspectAnchor("auto");
          store.setTargetAspect(ratio);
          // Force layout read to trigger derivation.
          const layout = store.layout;
          return {
            ok: true,
            targetAspect: store.targetAspect,
            layout: layout ? {
              totalWidth: layout.totalWidth,
              totalHeight: layout.totalHeight,
              forestWidth: layout.forestWidth,
              rowHeight: layout.rowHeight,
              aspectScale: layout.aspectNonForestScale,
            } : null,
          };
        } catch (e) {
          return { ok: false, error: e.message, stack: e.stack?.split("\n").slice(0, 5).join("\n") };
        }
      }, t);
      console.log(JSON.stringify(result, null, 2));
    }
  } finally { await browser.close(); }
}

main(process.argv[2]).catch((e) => { console.error(e); process.exit(1); });
