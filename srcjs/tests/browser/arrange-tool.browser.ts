/**
 * Browser correctness test for the ARRANGE TOOL + seam grammar
 * (interactivity-UX arc P2). Real puppeteer input only — Svelte 5's
 * untrusted-event fallback masks the portal×delegation bug class, and
 * pointer-capture drags can't be simulated with synthetic events.
 *
 * Asserts:
 *   1. Opt-out: no arrange button when enableArrange is EXPLICITLY false
 *      (D9 reversal 2026-06-13: enableArrange defaults ON; unset ⇒ shown).
 *   2. With interaction.enableArrange: the toolbar shows the arrange button;
 *      arming it reveals row-kind handles + armed spacing seams.
 *   3. Hovering a row handle ghost-highlights every row of that KIND.
 *   4. Dragging a row handle down grows EVERY data row (per-kind pin), with
 *      a live readout, and the height change survives pointerup.
 *   5. Escape mid-drag CANCELS (heights restore to the drag-start value).
 *   6. Double-click on a row handle releases the pin (back to default).
 *   7. Column resize: dragging the (widened) header handle pins the width;
 *      double-click autosizes back toward the measured width.
 *
 * Run:  cd srcjs && bun run tests/browser/arrange-tool.browser.ts
 *       (after `npm run build` — it loads inst/htmlwidgets/tabviz.js)
 */

import puppeteer, { type Page } from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";
import { buildTheme } from "../../src/lib/theme/theme-adapter";
import { NEJM } from "../../src/lib/theme/theme-presets-inputs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_HTML = path.join(__dirname, "fixtures.html");
const DEFAULT_BUNDLE = path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.js");
const DEFAULT_CSS = path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.css");

function buildSpec(opts: { arrange: boolean }): unknown {
  const THEME = buildTheme(NEJM, "nejm");
  const mk = (id: string, label: string, groupId: string) =>
    ({ id, label, groupId, metadata: { note: "ok", n: 42 }, style: {} });
  return {
    version: "1.4",
    data: {
      rows: [
        mk("r1", "Alpha", "g1"), mk("r2", "Beta", "g1"),
        mk("r3", "Gamma", "g2"), mk("r4", "Delta", "g2"),
      ],
      groups: [
        { id: "g1", label: "Group One", collapsed: false, depth: 0 },
        { id: "g2", label: "Group Two", collapsed: false, depth: 0 },
      ],
      summaries: [],
    },
    columns: [
      { id: "label", type: "text", field: "label", header: "Study", options: {} },
      { id: "note", type: "text", field: "note", header: "Notes", options: {} },
      { id: "n", type: "numeric", field: "n", header: "N", options: {} },
    ],
    theme: THEME,
    interaction: {
      enableExport: false, enableThemes: null,
      // D9 reversal (2026-06-13): enableArrange now defaults ON (maximal
      // interaction defaults), so the OFF state must be set EXPLICITLY to
      // test that the button is absent — an unset flag resolves to ON.
      enableArrange: opts.arrange === true,
    },
    layout: { plotWidth: "auto" },
  };
}

async function mount(page: Page, spec: unknown) {
  await page.evaluate((s) => {
    const w = window as unknown as {
      HTMLWidgets: { find: (n: string) => { factory: (el: HTMLElement, wd: number, ht: number) => { renderValue: (x: unknown) => void } } | undefined };
    };
    const binding = w.HTMLWidgets.find("tabviz");
    if (!binding) throw new Error("tabviz binding not found");
    const host = document.getElementById("widget")!;
    host.innerHTML = "";
    const inner = document.createElement("div");
    inner.style.width = "900px";
    inner.style.height = "600px";
    host.appendChild(inner);
    binding.factory(inner, 900, 600).renderValue(s);
  }, spec);
  await new Promise((r) => setTimeout(r, 700)); // settle measure loops
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}
function ok(msg: string) {
  console.log(`✓ ${msg}`);
}

/** Max rendered height across data-row cells, keyed by row id. */
async function dataRowHeights(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const out: Record<string, number> = {};
    for (const c of document.querySelectorAll<HTMLElement>("[data-row-id]")) {
      const id = c.dataset.rowId;
      if (!id) continue;
      out[id] = Math.max(out[id] ?? 0, Math.round(c.getBoundingClientRect().height));
    }
    return out;
  });
}

async function run() {
  const browser = await puppeteer.launch({
    headless: true, protocolTimeout: 120000, args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 900, deviceScaleFactor: 1 });
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(`file://${FIXTURE_HTML}`, { waitUntil: "load" });
  await page.addStyleTag({ path: DEFAULT_CSS });
  await page.addScriptTag({ path: path.resolve(__dirname, "../../node_modules/jquery/dist/jquery.min.js") }).catch(() => {});
  await page.addScriptTag({ path: DEFAULT_BUNDLE });

  // ── 1. Opt-out: no arrange button when enableArrange is explicitly false
  //      (D9 reversal: arrange defaults ON, so OFF must be explicit) ──────
  await mount(page, buildSpec({ arrange: false }));
  if (await page.$(".arrange-btn")) fail("arrange button rendered with enableArrange: false");
  ok("opt-out: no arrange button when enableArrange: false");

  // ── 2. Arm the tool ─────────────────────────────────────────────────────
  await mount(page, buildSpec({ arrange: true }));
  await page.waitForSelector(".arrange-btn", { timeout: 5000 })
    .catch(() => fail("arrange button missing with enableArrange: true"));
  await page.$eval(".arrange-btn", (el) => (el as HTMLElement).click());
  await page.waitForSelector(".row-edge-handle", { timeout: 5000 })
    .catch(() => fail("row-edge handles did not appear after arming arrange"));
  const seams = await page.$$(".edge-resize.armed");
  if (seams.length < 1) fail("no armed spacing seams in arrange mode");
  ok(`armed: ${(await page.$$(".row-edge-handle")).length} row handles + ${seams.length} spacing seams`);

  // ── 3. Ghost highlight on hover ─────────────────────────────────────────
  const firstHandle = await page.$(".row-edge-handle");
  const hb = (await firstHandle!.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await new Promise((r) => setTimeout(r, 150));
  const ghosts = await page.$$(".row-kind-ghost");
  if (ghosts.length < 2) fail(`expected ≥2 ghost rows for the hovered kind, got ${ghosts.length}`);
  ok(`ghost highlight: ${ghosts.length} rows of the hovered kind`);

  // ── 4. Drag = per-kind pin + readout; survives release ─────────────────
  const before = await dataRowHeights(page);
  // Find a DATA row handle: handle vertically aligned with row r1's bottom.
  const handles = await page.$$(".row-edge-handle");
  let dataHandleBox: { x: number; y: number; width: number; height: number } | null = null;
  const r1Box = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-row-id="r1"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { bottom: r.bottom };
  });
  if (!r1Box) fail("row r1 not found");
  for (const h of handles) {
    const b = await h.boundingBox();
    if (b && Math.abs(b.y + b.height / 2 - r1Box.bottom) < 4) { dataHandleBox = b; break; }
  }
  if (!dataHandleBox) fail("no handle aligned with data row r1's bottom edge");
  const hx = dataHandleBox.x + dataHandleBox.width / 2;
  const hy = dataHandleBox.y + dataHandleBox.height / 2;
  await page.mouse.move(hx, hy);
  await page.mouse.down();
  await page.mouse.move(hx, hy + 12, { steps: 6 });
  await new Promise((r) => setTimeout(r, 150));
  const readout = await page.$(".row-edge-readout");
  if (!readout) fail("no live readout during row drag");
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 300));
  const after = await dataRowHeights(page);
  const grew = ["r1", "r2", "r3", "r4"].filter((id) => (after[id] ?? 0) > (before[id] ?? 0) + 8);
  if (grew.length !== 4) {
    fail(`per-kind drag should grow ALL 4 data rows ~12px; grew: [${grew.join(", ")}] (before=${JSON.stringify(before)} after=${JSON.stringify(after)})`);
  }
  ok("dragging one row handle grew all rows of the kind (+ readout shown)");

  // ── 5. Escape mid-drag cancels ──────────────────────────────────────────
  const preCancel = await dataRowHeights(page);
  const handles2 = await page.$$(".row-edge-handle");
  let hb2: { x: number; y: number; width: number; height: number } | null = null;
  const r1b2 = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-row-id="r1"]');
    return el ? { bottom: el.getBoundingClientRect().bottom } : null;
  });
  for (const h of handles2) {
    const b = await h.boundingBox();
    if (b && r1b2 && Math.abs(b.y + b.height / 2 - r1b2.bottom) < 4) { hb2 = b; break; }
  }
  if (!hb2) fail("no handle for cancel test");
  await page.mouse.move(hb2.x + 60, hb2.y + hb2.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb2.x + 60, hb2.y + hb2.height / 2 + 20, { steps: 5 });
  await new Promise((r) => setTimeout(r, 150));
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 300));
  const postCancel = await dataRowHeights(page);
  for (const id of ["r1", "r2"]) {
    if (Math.abs((postCancel[id] ?? 0) - (preCancel[id] ?? 0)) > 2) {
      fail(`Escape did not cancel the row drag (row ${id}: ${preCancel[id]} → ${postCancel[id]})`);
    }
  }
  ok("Escape mid-drag cancels (heights restored)");

  // ── 6. Double-click releases the pin ────────────────────────────────────
  const pinned = await dataRowHeights(page);
  const handles3 = await page.$$(".row-edge-handle");
  let hb3: { x: number; y: number; width: number; height: number } | null = null;
  const r1b3 = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-row-id="r1"]');
    return el ? { bottom: el.getBoundingClientRect().bottom } : null;
  });
  for (const h of handles3) {
    const b = await h.boundingBox();
    if (b && r1b3 && Math.abs(b.y + b.height / 2 - r1b3.bottom) < 4) { hb3 = b; break; }
  }
  if (!hb3) fail("no handle for release test");
  await page.mouse.click(hb3.x + 100, hb3.y + hb3.height / 2, { clickCount: 2 });
  await new Promise((r) => setTimeout(r, 300));
  const released = await dataRowHeights(page);
  if (!((released["r1"] ?? 0) < (pinned["r1"] ?? 0) - 8)) {
    fail(`double-click did not release the pin (r1: ${pinned["r1"]} → ${released["r1"]})`);
  }
  ok("double-click releases the per-kind pin");

  // ── 7. Column resize: widened handle + double-click autosize ───────────
  const widthOf = (id: string) =>
    page.evaluate((cid) => {
      const el = document.querySelector<HTMLElement>(`[data-header-id="${cid}"]`);
      return el ? Math.round(el.getBoundingClientRect().width) : null;
    }, id);
  const w0 = await widthOf("label");
  if (w0 == null) fail("label header not found");
  const handleBox = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>('[data-header-id="label"]');
    const h = header?.querySelector<HTMLElement>(".resize-handle");
    if (!h) return null;
    const r = h.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (!handleBox) fail("label column resize handle not found");
  await page.mouse.move(handleBox.x, handleBox.y);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 60, handleBox.y, { steps: 6 });
  await new Promise((r) => setTimeout(r, 150));
  const colReadout = await page.$(".column-resize-readout");
  if (!colReadout) fail("no live readout during column drag");
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 300));
  const w1 = await widthOf("label");
  if (!(w1! > w0 + 40)) fail(`column drag did not widen label (got ${w0} → ${w1})`);
  ok(`column drag widened label ${w0} → ${w1} (+ readout shown)`);
  // Double-click the handle → autosize back toward content width.
  const handleBox2 = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>('[data-header-id="label"]');
    const h = header?.querySelector<HTMLElement>(".resize-handle");
    if (!h) return null;
    const r = h.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  const atPoint = await page.evaluate((pt) => {
    const el = document.elementFromPoint(pt.x, pt.y);
    if (!el) return "none";
    const closestNamed = el.closest("[aria-label], [data-tooltip], button, .control-toolbar");
    const name = closestNamed
      ? `${closestNamed.tagName}[${closestNamed.getAttribute("aria-label") ?? closestNamed.className}]`
      : "?";
    return `${el.tagName} inside ${name} at (${Math.round(pt.x)},${Math.round(pt.y)})`;
  }, handleBox2!);
  await page.mouse.click(handleBox2!.x, handleBox2!.y, { clickCount: 2 });
  await new Promise((r) => setTimeout(r, 400));
  const w2 = await widthOf("label");
  if (!(w2! < w1! - 30)) fail(`double-click did not autosize back (got ${w1} → ${w2}; element at point: ${atPoint})`);
  ok(`double-click autosized label ${w1} → ${w2}`);

  // ── 7b. Group-gap seam is reachable + drags (review pass: it used to be
  //        100% occluded by the row handle sharing the same 10px band) ────
  const gapSeam = await page.$('.edge-resize.armed[aria-label="Row group padding"]');
  if (!gapSeam) fail("no armed group-gap seam on a grouped fixture");
  const gapBox = (await gapSeam.boundingBox())!;
  const gapBefore = await gapSeam.evaluate((el) => Number(el.getAttribute("aria-valuenow")));
  await page.mouse.move(gapBox.x + 150, gapBox.y + gapBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(gapBox.x + 150, gapBox.y + gapBox.height / 2 + 8, { steps: 4 });
  await new Promise((r) => setTimeout(r, 150));
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 250));
  const gapAfter = await page.$eval(
    '.edge-resize.armed[aria-label="Row group padding"]',
    (el) => Number(el.getAttribute("aria-valuenow")),
  );
  if (!(gapAfter > gapBefore + 4)) {
    fail(`group-gap seam drag did not grow the gap (${gapBefore} → ${gapAfter}) — is it occluded by a row handle again?`);
  }
  ok(`group-gap seam draggable: ${gapBefore}px → ${gapAfter}px`);

  // ── 8. Disarm via toolbar; seams disappear ──────────────────────────────
  await page.$eval(".arrange-btn", (el) => (el as HTMLElement).click());
  await new Promise((r) => setTimeout(r, 200));
  if (await page.$(".row-edge-handle")) fail("row handles still present after disarming");
  ok("disarm removes all seams");

  if (pageErrors.length) {
    fail(`page errors:\n  ${pageErrors.join("\n  ")}`);
  }
  console.log("\nALL ARRANGE-TOOL CHECKS PASSED");
  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
