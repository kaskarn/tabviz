#!/usr/bin/env node
/**
 * Headless test: confirm row-reorder flows into the SVG export.
 *
 * Loads a rendered tabviz HTML file, reaches into the store via a temporary
 * global hook, performs a programmatic moveRowItem, captures exportSpec row
 * order and the generated SVG, then reports whether the SVG reflects the
 * reorder.
 */

import puppeteer from "puppeteer";
import path from "path";

async function main() {
  const htmlPath = path.resolve(process.argv[2] || "/tmp/tabviz_reorder_test.html");
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.on("console", (m) => console.log("[browser]", m.type(), m.text()));
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));

  await page.goto("file://" + htmlPath, { waitUntil: "networkidle0" });
  await page.waitForSelector(".tabviz-container", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 500));

  // Expose the store registry to window so we can reach into it.
  // htmlwidgets stores widget state via window.HTMLWidgets.widgets; tabviz keeps its
  // own registry keyed by element id. We traverse via the DOM.
  const result = await page.evaluate(() => {
    const el = document.querySelector(".tabviz-container");
    const host = el?.closest("[id]");
    const id = host?.id;
    // Look for tabvizStoreRegistry on window; if not exported, we'll expose it.
    const reg = window.__tabvizStoreRegistry || window.tabvizStoreRegistry;
    if (!reg) return { error: "no store registry exposed" };

    // Find a store — just take the first one
    const store = [...reg.values()][0];
    if (!store) return { error: "no store instance" };

    const before = store.exportSpec.data.rows.map((r) => r.id);
    const beforeGroups = store.exportSpec.data.groups.map((g) => g.id);

    // Test group-reorder: move the last TOP-LEVEL group to index 0 among siblings.
    const topGroups = store.spec.data.groups.filter((g) => !g.parentId);
    const lastGroup = topGroups[topGroups.length - 1];
    store.moveRowGroupItem(lastGroup.id, 0);
    // Also reorder a row within its group: swap the first two "Main Trials" rows.
    const mainRows = store.spec.data.rows.filter((r) => r.groupId === "Main Trials");
    if (mainRows.length >= 2) store.moveRowItem(mainRows[1].id, 0);
    const after = store.exportSpec.data.rows.map((r) => r.id);
    const afterGroups = store.exportSpec.data.groups.map((g) => g.id);

    // Capture the actual SVG
    const dims = store.getExportDimensions();
    const { exportToSVG } = window.__tabvizExports || {};
    let svgOrder = null;
    if (exportToSVG) {
      const svg = exportToSVG(store.exportSpec, dims);
      // Extract text elements that look like row labels — this is approximate.
      const labels = [...svg.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map((m) => m[1]);
      svgOrder = labels;
    }
    return { before, after, beforeGroups, afterGroups, svgOrder, movedGroupId: lastGroup.id };
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
