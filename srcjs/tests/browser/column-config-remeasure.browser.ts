/**
 * Browser correctness gate: interactive column-config edits RE-MEASURE widths.
 *
 * Reported bug (2026-06-16): "columns don't re-measure after I interactively
 * change column config." Root cause: the granular `updateColumn` path stored
 * the spec override + appended an op but never called `measureAutoColumns()`,
 * AND `doMeasurement` iterated raw `spec.columns` (overrides live in
 * `columnSpecOverrides`, merged only into `effectiveColumnDefs` for the render
 * path). So a config change that alters content width kept the stale width.
 *
 * This can ONLY be verified in a real browser (Canvas measurement + the store's
 * reactive width map). It drives the store directly via the `__tabvizStoreRegistry`
 * dev hook (the same registry Shiny proxy uses) rather than the editor UI, so it
 * tests the measurement wiring deterministically.
 *
 * Asserts:
 *   1. Widening a column's HEADER re-measures the (auto) column WIDER.
 *   2. Narrowing options (fewer decimals) re-measures NARROWER.
 *   3. Setting an EXPLICIT width drops the stale auto entry so `col.width` wins
 *      (render priority is measured-map > col.width).
 *   4. A user-RESIZED column is NOT clobbered by a later config edit.
 *
 * Run: cd srcjs && bun run tests/browser/column-config-remeasure.browser.ts
 */
import puppeteer from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE = path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.js");
const CSS = path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.css");

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const SPEC = {
  version: "1.4.0",
  data: { rows: [
    { id: "r0", label: "Alpha", metadata: { x: "hi", n: 5.123 } },
    { id: "r1", label: "Beta", metadata: { x: "ho", n: 12.987 } },
  ], groups: [] },
  columns: [
    { id: "lab", header: "Study", field: "label", type: "text", align: "left", width: "auto", options: {} },
    { id: "x", header: "X", field: "x", type: "text", align: "left", width: "auto", options: {} },
    { id: "n", header: "N", field: "n", type: "numeric", align: "right", width: "auto", options: { numeric: { decimals: 3 } } },
  ],
  theme: { name: "nejm" }, interaction: {}, layout: {},
};

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(`file://${path.join(__dirname, "fixtures.html")}`, { waitUntil: "load" });
    await page.addStyleTag({ path: CSS });
    await page.addScriptTag({ path: BUNDLE });

    const r = await page.evaluate((spec) => {
      const w = window as never as {
        HTMLWidgets: { find: (n: string) => { factory: (el: HTMLElement, a: number, b: number) => { renderValue: (x: unknown) => void } } };
        __tabvizStoreRegistry?: Map<string, never>;
      };
      const host = document.getElementById("widget")!;
      host.innerHTML = "";
      const inner = document.createElement("div");
      inner.id = "wdg1"; inner.style.width = "600px"; inner.style.height = "300px";
      host.appendChild(inner);
      w.HTMLWidgets.find("tabviz").factory(inner, 600, 300).renderValue(spec);
      const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type Store = { columnWidths: Record<string, number>; updateColumnPatch: (id: string, p: any) => void; setColumnWidth: (id: string, wpx: number) => void };
      return (async () => {
        await wait(1200);
        const store = w.__tabvizStoreRegistry?.get("wdg1") as unknown as Store | undefined;
        if (!store) return { err: "store not found in __tabvizStoreRegistry" };

        // 1. widen header
        const xBefore = store.columnWidths["x"];
        store.updateColumnPatch("x", { header: "A Very Long Header That Should Widen This Column" });
        await wait(80);
        const xAfter = store.columnWidths["x"];

        // 2. narrower options (3 → 0 decimals shrinks "12.987" → "13")
        const nBefore = store.columnWidths["n"];
        store.updateColumnPatch("n", { options: { numeric: { decimals: 0 } } });
        await wait(80);
        const nAfter = store.columnWidths["n"];

        // 3. explicit width drops the stale auto entry
        store.updateColumnPatch("n", { width: 333 });
        await wait(80);
        const nAutoEntry = store.columnWidths["n"];

        // 4. user-resized column survives a later config edit
        store.setColumnWidth("x", 222);
        await wait(80);
        store.updateColumnPatch("x", { header: "Yet Another Even Longer Header That Would Otherwise Re-grow It" });
        await wait(80);
        const xAfterResizeThenEdit = store.columnWidths["x"];

        return { xBefore, xAfter, nBefore, nAfter, nAutoEntry, xAfterResizeThenEdit };
      })();
    }, SPEC as never) as Record<string, number | undefined> & { err?: string };

    if (r.err) fail(r.err);
    // 1
    if (!(typeof r.xAfter === "number" && typeof r.xBefore === "number" && r.xAfter > r.xBefore + 10))
      fail(`header widen did not re-measure: ${r.xBefore} → ${r.xAfter}`);
    console.log(`✓ header widen re-measures: x ${r.xBefore} → ${r.xAfter}px`);
    // 2
    if (!(typeof r.nAfter === "number" && typeof r.nBefore === "number" && r.nAfter < r.nBefore))
      fail(`fewer decimals did not re-measure narrower: ${r.nBefore} → ${r.nAfter}`);
    console.log(`✓ option change re-measures: n ${r.nBefore} → ${r.nAfter}px`);
    // 3
    if (r.nAutoEntry !== undefined)
      fail(`explicit width left a stale auto entry (n=${r.nAutoEntry}); col.width would be shadowed`);
    console.log("✓ explicit width drops the stale auto entry (col.width wins)");
    // 4
    if (r.xAfterResizeThenEdit !== 222)
      fail(`user-resized column clobbered by config edit: expected 222, got ${r.xAfterResizeThenEdit}`);
    console.log("✓ user-resized width survives a later config edit");
    console.log("✓ all column-config re-measure assertions passed");
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
