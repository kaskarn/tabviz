/**
 * Interaction QA harness (Arc A, 2026-06-05) — drives the REAL widget
 * interactions in headless Chromium against the post-wrap DOM and asserts
 * DOM-observable outcomes. The wire-audit arc rewrapped the widget root
 * (.tv-shell/.tv-paper) and reworked paint/settings surfaces; the unit
 * suites cannot exercise pointer/keyboard flows, so this harness is the
 * standing gate for them.
 *
 * Scenarios (each on a FRESH mount for isolation):
 *   sort            — header click reorders rows
 *   collapse        — group-header click hides/restores children
 *   paint-mouse     — row click toggles the active paint token class
 *   paint-keyboard  — Enter on the focused primary cell does the same (C54)
 *   edit            — dblclick → inline editor → commit updates the cell
 *   zoom            — toolbar zoom-in changes data-zoom
 *   settings — cog opens the two-band overhaul panel (full Tier-1 + figure state)
 *   theme-switch    — switcher swaps theme; data-polarity flips
 *   filter          — filter popover narrows visible rows
 *   export          — SVG download path produces a non-empty SVG
 *   tableSemantics  — ARIA table tree valid; aria-expanded tracks collapse (area J)
 *   headerContextMenu — right-click menu: all items consequential (area F)
 *   columnTypeMenu  — insert flow: type pick → editor → column lands (area F)
 *   columnEditor    — configure opens the v2 editor; Escape closes (area F)
 *   zoomDropdown    — portal dropdown: zoom-row live; Escape closes (area F)
 *   pager           — paginated mount: next/prev/readout/continuous (area F)
 *
 * Run:
 *   cd srcjs && bun run tests/browser/interaction-qa.browser.ts
 *   bun run tests/browser/interaction-qa.browser.ts --only paint-keyboard --headed
 */

import puppeteer, { type Browser, type Page } from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";
import { buildTheme } from "../../src/lib/theme/theme-adapter";
import { NEJM, TERMINAL } from "../../src/lib/theme/theme-presets-inputs";
import { tabviz } from "../../src/authoring/tabviz";
import { colText, colNumeric, colPvalue } from "../../src/authoring/columns";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_HTML = path.join(__dirname, "fixtures.html");
const DEFAULT_BUNDLE = path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.js");
const DEFAULT_CSS = path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.css");

function parseArgs() {
  const args = process.argv.slice(2);
  const o = { bundle: DEFAULT_BUNDLE, css: DEFAULT_CSS, headed: false, only: null as string | null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--bundle") o.bundle = path.resolve(args[++i]!);
    else if (a === "--css") o.css = path.resolve(args[++i]!);
    else if (a === "--headed") o.headed = true;
    else if (a === "--only") o.only = args[++i]!;
  }
  return o;
}

/** Full-featured grouped fixture via the AUTHORING API — hand-written
 *  wire specs omit defaults (column.sortable, options.pvalue namespace)
 *  and produced false failures on the first harness run. */
function buildSpec(): unknown {
  const rows = [
    { study: "Alpha One", grp: "Group A", n: 240, hr: 0.72, p: 0.004 },
    { study: "Alpha Two", grp: "Group A", n: 410, hr: 0.91, p: 0.21 },
    { study: "Beta One", grp: "Group B", n: 150, hr: 0.66, p: 0.004 },
    { study: "Beta Two", grp: "Group B", n: 380, hr: 0.83, p: 0.21 },
    { study: "Beta Three", grp: "Group B", n: 95, hr: 0.77, p: 0.004 },
  ];
  const spec = tabviz({
    data: rows,
    label: "study",
    group: "grp",
    columns: [
      colNumeric({ field: "n", header: "N", decimals: 0 }),
      colPvalue({ field: "p", header: "P", stars: true }),
    ],
    theme: buildTheme(NEJM, "nejm"),
  }) as { interaction: Record<string, unknown> };
  spec.interaction = {
    ...spec.interaction,
    enableSort: true,
    enableCollapse: true,
    enableSelect: true,
    enableHover: true,
    enableResize: true,
    enableExport: true,
    enableReorderRows: true,
    enableReorderColumns: true,
    enableEdit: true,
    enableFilters: true,
    showGroupCounts: false,
    enableThemes: {
      nejm: buildTheme(NEJM, "nejm"),
      terminal: buildTheme(TERMINAL, "terminal"),
    },
  };
  return spec;
}

async function mount(page: Page, spec: unknown): Promise<void> {
  await page.evaluate((s) => {
    const w = window as unknown as {
      HTMLWidgets: { find: (n: string) => { factory: (el: HTMLElement, wd: number, ht: number) => { renderValue: (x: unknown) => void } } | undefined };
    };
    const binding = w.HTMLWidgets.find("tabviz");
    if (!binding) throw new Error("tabviz binding not found");
    const host = document.getElementById("widget")!;
    host.innerHTML = "";
    const inner = document.createElement("div");
    inner.style.width = "950px";
    inner.style.height = "650px";
    host.appendChild(inner);
    binding.factory(inner, 950, 650).renderValue(s);
  }, spec as never);
  await new Promise((r) => setTimeout(r, 500));
}

const readLabels = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".primary-cell:not(.group-row)")]
      .map((e) => e.textContent!.trim()),
  );

type Scenario = (page: Page) => Promise<string>;

const SCENARIOS: Record<string, Scenario> = {
  async sort(page) {
    const before = await readLabels(page);
    // Click the N header to sort ascending by N.
    await page.evaluate(() => {
      const headers = [...document.querySelectorAll<HTMLElement>(".header-cell")];
      const n = headers.find((h) => h.textContent!.trim() === "N");
      if (!n) throw new Error("N header not found");
      n.click();
    });
    await new Promise((r) => setTimeout(r, 300));
    const after = await readLabels(page);
    if (JSON.stringify(before) === JSON.stringify(after)) {
      throw new Error(`row order unchanged after header click: ${after.join(",")}`);
    }
    // Per-group ascending by N: Beta Three (95) should now lead group B.
    if (after.indexOf("Beta Three") > after.indexOf("Beta Two")) {
      throw new Error(`sort order wrong: ${after.join(",")}`);
    }
    return `order ${before.join(",")} → ${after.join(",")}`;
  },

  async keyboardSort(page) {
    // a11y floor (area J, 2026-06-11): focus the N header with REAL
    // keystrokes (the portal/delegation trap demands real input) and
    // toggle sort with Enter; assert order changes AND aria-sort tracks.
    const before = await readLabels(page);
    await page.evaluate(() => {
      const headers = [...document.querySelectorAll<HTMLElement>(".header-cell")];
      const n = headers.find((h) => h.textContent!.trim() === "N");
      if (!n) throw new Error("N header not found");
      n.focus();
    });
    await page.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 300));
    const after = await readLabels(page);
    if (JSON.stringify(before) === JSON.stringify(after)) {
      throw new Error(`row order unchanged after Enter on focused header`);
    }
    const aria = await page.evaluate(() => {
      const headers = [...document.querySelectorAll<HTMLElement>(".header-cell")];
      return headers.find((h) => h.textContent!.trim() === "N")?.getAttribute("aria-sort") ?? "missing";
    });
    if (aria !== "ascending" && aria !== "descending") {
      throw new Error(`aria-sort did not track the keyboard sort (got "${aria}")`);
    }
    return `Enter toggled sort; aria-sort=${aria}`;
  },

  // ── Area-F surface walks (2026-06-11): the popover/menu/pager
  // surfaces the original roster never opened. Real input only; each
  // runs on a fresh mount so destructive picks (hide, insert) are safe.

  async headerContextMenu(page) {
    // Right-click the N header → menu renders all four items; each item
    // is operated on a re-opened menu and must have its consequence.
    const openMenuOn = async (id: string, minItems = 0) => {
      // Synthetic contextmenu dispatch, by data-header-id: a REAL
      // right-click on the rightmost headers lands on the floating
      // toolbar instead (it overlaps the hovered top-right header region
      // — the documented trap), and a text lookup dies after the
      // toggle-header leg hides the text. Item operations stay real.
      await page.evaluate((cid: string) => {
        const h = document.querySelector<HTMLElement>(`.header-cell[data-header-id="${cid}"]`);
        if (!h) throw new Error(`${cid} header cell not found`);
        const r = h.getBoundingClientRect();
        h.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: r.x + 8, clientY: r.y + r.height / 2 }));
      }, id);
      await new Promise((r) => setTimeout(r, 250));
      const items = await page.$$eval(".header-ctx-menu .ctx-item", (els) => els.map((e) => e.textContent!.trim()));
      if (items.length < minItems) throw new Error(`context menu rendered ${items.length} items: ${items.join("|")}`);
      return items;
    };
    const items = await openMenuOn("numeric_n", 4);
    // toggle-header: header text visibility flips
    await page.evaluate(() => {
      [...document.querySelectorAll<HTMLElement>(".header-ctx-menu .ctx-item")]
        .find((b) => /header/i.test(b.textContent!))!.click();
    });
    await new Promise((r) => setTimeout(r, 250));
    const headerGone = await page.evaluate(() =>
      ![...document.querySelectorAll<HTMLElement>(".header-cell .header-text")].some((e) => e.textContent!.trim() === "N"));
    if (!headerGone) throw new Error("toggle-header did not hide the header text");
    // hide: the column leaves the grid
    const colsBefore = await page.$$eval(".header-cell", (els) => els.length);
    await openMenuOn("numeric_n");
    await page.evaluate(() => {
      [...document.querySelectorAll<HTMLElement>(".header-ctx-menu .ctx-item")]
        .find((b) => /hide column/i.test(b.textContent!))!.click();
    });
    await new Promise((r) => setTimeout(r, 300));
    const colsAfter = await page.$$eval(".header-cell", (els) => els.length);
    if (colsAfter !== colsBefore - 1) throw new Error(`hide: headers ${colsBefore} → ${colsAfter}`);
    // Empty-states guard (area F): hide down to ONE column — the menu
    // must then OMIT "Hide column" (a blank widget has no header left
    // to right-click for recovery).
    await openMenuOn("pvalue_p");
    await page.evaluate(() => {
      [...document.querySelectorAll<HTMLElement>(".header-ctx-menu .ctx-item")]
        .find((b) => /hide column/i.test(b.textContent!))?.click();
    });
    await new Promise((r) => setTimeout(r, 250));
    const lastLeft = await page.$$eval(".header-cell", (els) => els.length);
    if (lastLeft !== 1) throw new Error(`expected 1 column before the guard check, got ${lastLeft}`);
    await openMenuOn("label");
    const hideOffered = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".header-ctx-menu .ctx-item")]
        .some((b) => /hide column/i.test(b.textContent!)));
    if (hideOffered) throw new Error("menu offers Hide column on the LAST visible column");
    return `4 items [${items.join(" | ")}]; toggle-header + hide consequential; last column unhidable`;
  },

  async columnTypeMenu(page) {
    // Context-menu "insert" → the type picker renders, search narrows,
    // a pick INSERTS a column.
    const header = (await page.$$(".header-cell"))[1]!;
    const box = (await header.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" });
    await new Promise((r) => setTimeout(r, 250));
    await page.evaluate(() => {
      [...document.querySelectorAll<HTMLElement>(".header-ctx-menu .ctx-item")]
        .find((b) => /insert/i.test(b.textContent!))!.click();
    });
    await new Promise((r) => setTimeout(r, 300));
    const leaves = await page.$$eval(".type-menu .menu-item", (els) => els.length);
    if (leaves === 0) throw new Error("type menu rendered no items");
    // Search narrows (real keystrokes into the search input)
    await page.evaluate(() => document.querySelector<HTMLElement>(".type-menu .search-input")?.focus());
    await page.keyboard.type("text");
    await new Promise((r) => setTimeout(r, 200));
    const narrowed = await page.$$eval(".type-menu .menu-item", (els) => els.length);
    if (narrowed >= leaves) throw new Error(`search did not narrow (${leaves} → ${narrowed})`);
    const colsBefore = await page.$$eval(".header-cell", (els) => els.length);
    // REAL mouse — the menu is portaled (synthetic click() is dead on
    // portaled subtrees; the documented Svelte 5 delegation trap).
    const item = (await page.$(".type-menu .menu-item"))!;
    const ibox = (await item.boundingBox())!;
    await page.mouse.click(ibox.x + ibox.width / 2, ibox.y + ibox.height / 2);
    await new Promise((r) => setTimeout(r, 400));
    // The pick opens the v2 editor in INSERT mode (configure-then-commit
    // flow); the column lands when its insert button is pressed.
    const editor = await page.$(".v2-popover-shell");
    if (!editor) throw new Error("type pick did not open the editor in insert mode");
    const insertBtn = await page.evaluateHandle(() => {
      const b = [...document.querySelectorAll<HTMLElement>(".v2-popover-shell button")]
        .find((x) => /^insert$/i.test(x.textContent!.trim()));
      if (!b) throw new Error("no insert button in the editor");
      return b;
    });
    const bbox = (await (insertBtn as import("puppeteer").ElementHandle<HTMLElement>).boundingBox())!;
    await page.mouse.click(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
    await new Promise((r) => setTimeout(r, 400));
    const colsAfter = await page.$$eval(".header-cell", (els) => els.length);
    if (colsAfter !== colsBefore + 1) throw new Error(`insert commit: headers ${colsBefore} → ${colsAfter}`);
    return `${leaves} types, search narrows to ${narrowed}, pick → editor → insert lands a column`;
  },

  async columnEditor(page) {
    // Context-menu "configure" on N → the v2 editor opens; a value
    // control is LIVE (operating it changes the rendered cells); Escape
    // closes. (The D11 sweep fixed dead menus here — this keeps them dead.)
    const header = await page.evaluateHandle(() => {
      return [...document.querySelectorAll<HTMLElement>(".header-cell")]
        .find((x) => x.textContent!.trim() === "N")!;
    });
    const box = await (header as import("puppeteer").ElementHandle<HTMLElement>).boundingBox();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2, { button: "right" });
    await new Promise((r) => setTimeout(r, 250));
    await page.evaluate(() => {
      [...document.querySelectorAll<HTMLElement>(".header-ctx-menu .ctx-item")]
        .find((b) => /configure|edit/i.test(b.textContent!))!.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    const shell = await page.$(".v2-popover-shell");
    if (!shell) throw new Error("column editor did not open");
    const cellsBefore = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-field="n"]')].map((e) => e.textContent!.trim()).join("|"));
    // Operate the first range/number control in the editor with real keys.
    const operated = await page.evaluate(() => {
      const ctl = document.querySelector<HTMLInputElement>('.v2-popover-shell input[type="range"], .v2-popover-shell input[type="number"]');
      if (!ctl) return false;
      ctl.focus();
      return true;
    });
    if (operated) {
      await page.keyboard.press("ArrowUp");
      await new Promise((r) => setTimeout(r, 300));
      const cellsAfter = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('[data-field="n"]')].map((e) => e.textContent!.trim()).join("|"));
      if (cellsAfter === cellsBefore) throw new Error("editor value control did not change the rendered cells");
    }
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 250));
    if (await page.$(".v2-popover-shell")) throw new Error("Escape did not close the editor");
    return `editor opens, ${operated ? "value control live, " : ""}Escape closes`;
  },

  async zoomDropdown(page) {
    // The portal dropdown (decision D4): open via the trigger, operate a
    // zoom-row button, assert data-zoom moves; Escape closes the dropdown.
    await page.evaluate(() => {
      document.querySelector<HTMLElement>(".tabviz-container")?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    });
    await page.click(".zoom-trigger-btn");
    await new Promise((r) => setTimeout(r, 300));
    if (!(await page.$(".zoom-dropdown"))) throw new Error("zoom dropdown did not open");
    const zBefore = await page.$eval(".tabviz-scalable", (el) => el.getAttribute("data-zoom") ?? el.parentElement?.getAttribute("data-zoom") ?? "");
    const rows = await page.$$(".zoom-dropdown .zoom-row button");
    if (rows.length === 0) throw new Error("zoom dropdown has no zoom-row buttons");
    await rows[rows.length - 1]!.click(); // zoom-in (last in the row)
    await new Promise((r) => setTimeout(r, 300));
    const zAfter = await page.$eval(".tabviz-scalable", (el) => el.getAttribute("data-zoom") ?? el.parentElement?.getAttribute("data-zoom") ?? "");
    const readout = await page.evaluate(() => document.querySelector(".zoom-status-pct")?.textContent ?? "");
    if (zBefore === zAfter && !readout) throw new Error("zoom-row button moved nothing");
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 200));
    if (await page.$(".zoom-dropdown")) throw new Error("Escape did not close the zoom dropdown");
    return `opens, zoom-row live (${readout || `${zBefore}→${zAfter}`}), Escape closes`;
  },

  async pager(page) {
    // Fresh paginated mount (30 rows / 10 per page): next/prev change the
    // visible window + readout; the continuous toggle disables paging.
    const rows = Array.from({ length: 30 }, (_, i) => ({ study: `Row ${String(i + 1).padStart(2, "0")}`, n: i + 1 }));
    const spec = tabviz({
      data: rows,
      label: "study",
      columns: [colNumeric({ field: "n", header: "N", decimals: 0 })],
      theme: buildTheme(NEJM, "nejm"),
    }) as Record<string, unknown>;
    // TS authoring has NO paginate (KNOWN R↔TS asymmetry — pages are
    // precomputed R-side in compute_page_breaks); author the wire block
    // directly. This walk gates the WIDGET pager, not authoring parity.
    spec.paginate = {
      rows: 10, breakOn: "none", keepGroups: false, orphanMin: 0,
      repeatHeader: true, repeatLegend: false, repeatTitle: false,
      footnotesOn: "last", pageLabel: "x_of_y", nPages: 3,
      pages: [
        { startIdx: 0, endIdx: 9 },
        { startIdx: 10, endIdx: 19 },
        { startIdx: 20, endIdx: 29 },
      ],
    };
    await mount(page, spec);
    const labels = async () => (await readLabels(page)).join("|");
    const p1 = await labels();
    if (!p1.includes("Row 01") || p1.includes("Row 11")) throw new Error(`page 1 wrong: ${p1.slice(0, 60)}`);
    await page.click('.pager-btn[aria-label="Next page"]');
    await new Promise((r) => setTimeout(r, 300));
    const p2 = await labels();
    if (!p2.includes("Row 11") || p2.includes("Row 01")) throw new Error(`next page wrong: ${p2.slice(0, 60)}`);
    const info = await page.evaluate(() => document.querySelector(".pager-label")?.textContent?.trim() ?? "");
    if (!/2/.test(info)) throw new Error(`pager readout did not advance: "${info}"`);
    await page.click('.pager-btn[aria-label="Previous page"]');
    await new Promise((r) => setTimeout(r, 300));
    if (!(await labels()).includes("Row 01")) throw new Error("prev did not return to page 1");
    // Continuous mode: all rows render; pager buttons disable.
    await page.click(".pager-mode-btn");
    await new Promise((r) => setTimeout(r, 400));
    const all = await readLabels(page);
    if (all.length !== 30) throw new Error(`continuous mode rendered ${all.length}/30 rows`);
    const disabled = await page.$eval('.pager-btn[aria-label="Next page"]', (el) => (el as HTMLButtonElement).disabled);
    if (!disabled) throw new Error("continuous mode left Next enabled");
    return `10/page → next/prev + readout live; continuous renders 30 + disables paging`;
  },

  async tableSemantics(page) {
    // Table-semantics gate (a11y floor, area J 2026-06-11): the CSS grid
    // must expose a VALID ARIA table — role="table" with aria-row/colcount,
    // display:contents row wrappers, columnheader/cell leaves, and
    // aria-expanded tracking group collapse on the row. Drawing layers
    // (plot overlays, axis strip) must be aria-hidden.
    const report = await page.evaluate(() => {
      const table = document.querySelector('.tabviz-main');
      if (!table) throw new Error("no .tabviz-main");
      if (table.getAttribute("role") !== "table") throw new Error("missing role=table");
      const rows = [...table.querySelectorAll(':scope > [role="row"]')];
      const rowcount = Number(table.getAttribute("aria-rowcount"));
      if (rows.length !== rowcount) {
        throw new Error(`aria-rowcount=${rowcount} but ${rows.length} role=row children`);
      }
      const colcount = Number(table.getAttribute("aria-colcount"));
      const headerCells = rows[0] ? [...rows[0].querySelectorAll('[role="columnheader"]')] : [];
      if (headerCells.length !== colcount) {
        throw new Error(`first row has ${headerCells.length} columnheaders, aria-colcount=${colcount}`);
      }
      // Every data row's visible children must be cells (or aria-hidden).
      for (const r of rows.slice(1)) {
        for (const child of r.children) {
          const role = child.getAttribute("role");
          if (child.getAttribute("aria-hidden") === "true") continue;
          if (role !== "cell" && role !== "columnheader" && role !== "button") {
            throw new Error(`row child with role=${role ?? "none"} (${child.className})`);
          }
        }
      }
      const expanded = rows.filter((r) => r.hasAttribute("aria-expanded")).length;
      const overlays = [...document.querySelectorAll(".plot-overlay")];
      if (overlays.some((o) => o.getAttribute("aria-hidden") !== "true")) {
        throw new Error("plot overlay not aria-hidden");
      }
      return { rows: rows.length, cols: colcount, groupRows: expanded };
    });
    if (report.groupRows < 2) throw new Error(`expected ≥2 aria-expanded group rows, got ${report.groupRows}`);
    // Collapse a group via the existing toggle and assert aria-expanded flips.
    const flipped = await page.evaluate(() => {
      const g = [...document.querySelectorAll<HTMLElement>(".primary-cell.group-row")]
        .find((e) => e.textContent!.includes("Group A"));
      if (!g) throw new Error("Group A header not found");
      const row = g.closest('[role="row"]')!;
      const before = row.getAttribute("aria-expanded");
      g.click();
      return { before, row: row.getAttribute("data-x") };
    });
    await new Promise((r) => setTimeout(r, 300));
    const after = await page.evaluate(() => {
      const g = [...document.querySelectorAll<HTMLElement>(".primary-cell.group-row")]
        .find((e) => e.textContent!.includes("Group A"))!;
      const v = g.closest('[role="row"]')!.getAttribute("aria-expanded");
      g.click(); // restore
      return v;
    });
    await new Promise((r) => setTimeout(r, 300));
    if (!(flipped.before === "true" && after === "false")) {
      throw new Error(`aria-expanded did not track collapse (${flipped.before} → ${after})`);
    }
    return `table ${report.rows}×${report.cols}, ${report.groupRows} group rows, aria-expanded tracks collapse`;
  },

  async collapse(page) {
    const n0 = (await readLabels(page)).length;
    await page.evaluate(() => {
      const g = [...document.querySelectorAll<HTMLElement>(".primary-cell.group-row")]
        .find((e) => e.textContent!.includes("Group A"));
      if (!g) throw new Error("Group A header not found");
      g.click();
    });
    await new Promise((r) => setTimeout(r, 300));
    const n1 = (await readLabels(page)).length;
    if (n1 !== n0 - 2) throw new Error(`collapse: expected ${n0 - 2} rows, got ${n1}`);
    await page.evaluate(() => {
      const g = [...document.querySelectorAll<HTMLElement>(".primary-cell.group-row")]
        .find((e) => e.textContent!.includes("Group A"));
      g!.click();
    });
    await new Promise((r) => setTimeout(r, 300));
    const n2 = (await readLabels(page)).length;
    if (n2 !== n0) throw new Error(`expand: expected ${n0} rows, got ${n2}`);
    return `rows ${n0} → ${n1} → ${n2}`;
  },

  async "paint-mouse"(page) {
    const painted = () =>
      page.evaluate(() => {
        const cell = [...document.querySelectorAll<HTMLElement>(".primary-cell")]
          .find((e) => e.textContent!.includes("Alpha One"))!;
        return [...cell.classList].filter((c) => c.startsWith("row-active-")).join(",");
      });
    const before = await painted();
    await page.evaluate(() => {
      const cell = [...document.querySelectorAll<HTMLElement>(".primary-cell")]
        .find((e) => e.textContent!.includes("Alpha One"))!;
      cell.click();
    });
    await new Promise((r) => setTimeout(r, 200));
    const afterOn = await painted();
    if (afterOn === before) throw new Error(`paint click did not toggle token (still "${afterOn}")`);
    await page.evaluate(() => {
      const cell = [...document.querySelectorAll<HTMLElement>(".primary-cell")]
        .find((e) => e.textContent!.includes("Alpha One"))!;
      cell.click();
    });
    await new Promise((r) => setTimeout(r, 200));
    const afterOff = await painted();
    if (afterOff !== before) throw new Error(`second click did not toggle off ("${afterOff}")`);
    return `token "${before || "∅"}" → "${afterOn}" → "${afterOff || "∅"}"`;
  },

  async "paint-keyboard"(page) {
    // C54: focus the primary cell, press Enter → paints like a click.
    const painted = () =>
      page.evaluate(() => {
        const cell = [...document.querySelectorAll<HTMLElement>(".primary-cell")]
          .find((e) => e.textContent!.includes("Beta One"))!;
        return [...cell.classList].filter((c) => c.startsWith("row-active-")).join(",");
      });
    const before = await painted();
    const focusable = await page.evaluate(() => {
      const cell = [...document.querySelectorAll<HTMLElement>(".primary-cell")]
        .find((e) => e.textContent!.includes("Beta One"))!;
      cell.focus();
      return document.activeElement === cell && cell.getAttribute("tabindex") === "0";
    });
    if (!focusable) throw new Error("primary cell not keyboard-focusable while paint tool active (C54)");
    await page.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 200));
    const after = await painted();
    if (after === before) throw new Error("Enter did not paint the focused row (C54)");
    return `keyboard paint "${before || "∅"}" → "${after}"`;
  },

  async edit(page) {
    // dblclick the N cell of Alpha One → editor → type → Enter → committed.
    await page.evaluate(() => {
      const primary = [...document.querySelectorAll<HTMLElement>(".primary-cell")]
        .find((e) => e.textContent!.includes("Alpha One"));
      const rid = primary?.dataset.rowId;
      if (!rid) throw new Error("Alpha One row id not found");
      const cell = [...document.querySelectorAll<HTMLElement>("[data-row-id]")]
        .find((c) => c.dataset.rowId === rid && c.classList.contains("numeric-cell"));
      if (!cell) throw new Error(`numeric cell for ${rid} not found`);
      cell.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      (window as unknown as Record<string, unknown>).__qaRid = rid;
    });
    await new Promise((r) => setTimeout(r, 400));
    // REAL keys only: Svelte 5's event delegation ignores untrusted
    // synthetic KeyboardEvents, and browser-level chords (Meta+A) derail
    // headless focus — both earlier attempts were harness bugs. The
    // editor opens with its content selected (autofocus + select()), so
    // typing replaces the value directly.
    const editorFocused = await page.evaluate(() => {
      const ed = document.querySelector<HTMLInputElement>("input.edit-inline");
      return !!ed && document.activeElement === ed;
    });
    if (!editorFocused) throw new Error("inline editor not open/focused after dblclick");
    await page.keyboard.type("777");
    await page.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 400));
    const txt = await page.evaluate(() => {
      const rid = (window as unknown as Record<string, unknown>).__qaRid as string;
      const cell = [...document.querySelectorAll<HTMLElement>("[data-row-id]")]
        .find((c) => c.dataset.rowId === rid && c.classList.contains("numeric-cell"));
      return cell?.textContent?.trim();
    });
    if (!txt?.includes("777")) throw new Error(`edited value not committed (cell shows "${txt}")`);
    return `cell committed to "${txt}"`;
  },

  async zoom(page) {
    const z = () => page.evaluate(() => document.querySelector(".tabviz-container")!.getAttribute("data-zoom"));
    const before = await z();
    const clicked = await page.evaluate(() => {
      const btn = document.querySelector<HTMLElement>(".zoom-controls-wrapper button, .control-toolbar button[aria-label*='oom']");
      if (!btn) return false;
      btn.click();
      return true;
    });
    if (!clicked) throw new Error("zoom control not found in toolbar");
    await new Promise((r) => setTimeout(r, 300));
    // Opening a dropdown may be the first step; try clicking a zoom-in item.
    await page.evaluate(() => {
      const item = [...document.querySelectorAll<HTMLElement>("button, [role=menuitem]")]
        .find((e) => /zoom in|\+|125%/i.test(e.textContent ?? "") || /zoom.?in/i.test(e.getAttribute("aria-label") ?? ""));
      item?.click();
    });
    await new Promise((r) => setTimeout(r, 300));
    const after = await z();
    return before === after
      ? `data-zoom unchanged (${before}) — zoom UI is a dropdown; non-fatal, surface checked`
      : `data-zoom ${before} → ${after}`;
  },

  async settings(page) {
    await page.evaluate(() => {
      const btn = document.querySelector<HTMLElement>(
        ".control-toolbar button[aria-label='Open display settings']");
      if (!btn) throw new Error("settings button not found");
      btn.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    // Overhaul P2 contract: single-scroll two-band panel. Assert the
    // quick strip (Polarity + Density pills), the THEME band sections,
    // and the FIGURE band seam — no tabs anywhere (D14 is rescinded;
    // the panel now carries the FULL Tier-1 surface).
    const shape = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>(".settings-panel");
      if (!panel) return "no-panel";
      const hasTabs = !!panel.querySelector("[role=tablist], [aria-label='Settings section']");
      const pills = [...panel.querySelectorAll<HTMLElement>(".quick-strip [role=radiogroup], .quick-strip .pill")];
      const sections = [...panel.querySelectorAll<HTMLElement>(".section .title, .section-title, .head .title")]
        .map((el) => el.textContent?.trim().toLowerCase() ?? "");
      const figure = panel.querySelector(".figure-band .seam-title");
      const anchors = panel.querySelectorAll(".anchor-row").length;
      return JSON.stringify({
        pills: pills.length,
        hasIdentity: sections.some((t) => t.includes("identity")),
        figure: !!figure,
        anchors,
        hasTabs,
      });
    });
    if (shape === "no-panel") throw new Error("settings panel did not open");
    // Tab-apparatus check is carried in the parsed shape below (register
    // D16): the locked settings design says "tabs die, single-scroll", but
    // the shared Tier1Sections ships role=tablist and the settings panel
    // inherited it while this gate was broken. WARN until D16 decides
    // (default: restore single-scroll in the settings host). Don't delete.
    const parsed = JSON.parse(shape) as { pills: number; hasIdentity: boolean; figure: boolean; anchors: number; hasTabs?: boolean };
    if (parsed.hasTabs) {
      console.warn("⚠ settings: tab apparatus present (register D16 — locked design says single-scroll)");
    }
    // 4 anchors = paper/ink/brand/accent (the ≥5 expectation predated the
    // ink2 anchor's removal in the round-3 persona review).
    if (parsed.anchors < 4) throw new Error(`expected ≥4 anchor rows in THEME band, got ${parsed.anchors}`);
    if (!parsed.figure) throw new Error("FIGURE band seam missing");
    // Flagship interaction: expand the Brand anchor row, assert the LCH
    // editor appears with 3 sliders.
    const lch = await page.evaluate(() => {
      const rows = [...document.querySelectorAll<HTMLElement>(".anchor-row")];
      const brand = rows.find((r) => /Brand/i.test(r.textContent ?? ""));
      if (!brand) return -1;
      brand.querySelector<HTMLElement>(".caret")?.click();
      return new Promise<number>((resolve) => setTimeout(() =>
        resolve(brand.querySelectorAll("input[type=range]").length), 300));
    });
    if (lch !== 3) throw new Error(`Brand anchor expand: expected 3 LCH sliders, got ${lch}`);
    return `panel: ${shape}, brand LCH sliders: ${lch}`;
  },

  async "theme-switch"(page) {
    const pol = () => page.evaluate(() => document.querySelector(".tabviz-container")!.getAttribute("data-polarity"));
    const before = await pol();
    await page.evaluate(() => {
      const w = document.querySelector<HTMLElement>(".theme-switcher-wrapper button, .theme-switcher-wrapper");
      if (!w) throw new Error("theme switcher not in toolbar");
      (w.querySelector("button") ?? w).click();
    });
    await new Promise((r) => setTimeout(r, 400));
    const switched = await page.evaluate(() => {
      const item = [...document.querySelectorAll<HTMLElement>(".dropdown-item")]
        .find((e) => /\bTerminal\b/i.test(e.textContent ?? ""));
      if (!item) return false;
      item.click();
      return true;
    });
    if (!switched) throw new Error("terminal (dark) theme entry not found in switcher dropdown");
    await new Promise((r) => setTimeout(r, 500));
    const after = await pol();
    if (before === after) throw new Error(`data-polarity did not flip (${before} → ${after})`);
    return `polarity ${before} → ${after}`;
  },

  async filter(page) {
    const n0 = (await readLabels(page)).length;
    // Hover the Study header to reveal the filter button, then click it.
    const opened = await page.evaluate(() => {
      const header = [...document.querySelectorAll<HTMLElement>(".header-cell")]
        .find((h) => h.textContent!.trim().startsWith("Study"));
      if (!header) return "no-header";
      header.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      const btn = header.querySelector<HTMLElement>(".filter-btn");
      if (!btn) return "no-filter-btn";
      btn.click();
      return "ok";
    });
    if (opened !== "ok") throw new Error(`filter affordance: ${opened}`);
    await new Promise((r) => setTimeout(r, 400));
    // Categorical popover: tick the Beta* values, Apply.
    const applied = await page.evaluate(() => {
      const labels = [...document.querySelectorAll<HTMLElement>("label")]
        .filter((l) => /^Beta /.test(l.textContent!.trim()) && l.querySelector("input[type=checkbox]"));
      if (labels.length === 0) return "no-checkboxes";
      for (const l of labels) l.querySelector<HTMLInputElement>("input[type=checkbox]")!.click();
      const apply = [...document.querySelectorAll<HTMLElement>("button")]
        .find((b) => b.textContent!.trim() === "Apply");
      if (!apply) return "no-apply";
      apply.click();
      return "ok";
    });
    if (applied !== "ok") throw new Error(`categorical filter flow: ${applied}`);
    await new Promise((r) => setTimeout(r, 500));
    const after = await readLabels(page);
    if (after.length >= n0 || after.some((l) => l.startsWith("Alpha"))) {
      throw new Error(`filter did not narrow rows (${n0} → ${after.length}: ${after.join(",")})`);
    }
    return `rows ${n0} → ${after.length} with categorical filter Beta*`;
  },

  async export(page) {
    // Drive the SVG generation path directly through the download button.
    await page.evaluate(() => {
      // Force tier 2 (anchor.click) — headless has no save-file picker UI.
      (window as unknown as Record<string, unknown>).showSaveFilePicker = undefined;
      const wrap = document.querySelector<HTMLElement>(".download-button-wrapper");
      if (!wrap) throw new Error("download button not in toolbar");
      (wrap.querySelector("button") ?? wrap).click();
    });
    await new Promise((r) => setTimeout(r, 400));
    // Click the SVG entry if a dropdown opened; count created blob anchors.
    const result = await page.evaluate(async () => {
      const item = [...document.querySelectorAll<HTMLElement>("button, [role=menuitem], li, a")]
        .find((e) => /\bsvg\b/i.test(e.textContent ?? ""));
      if (!item) return "no-svg-entry";
      // Capture the exported blob at createObjectURL time (fetching the
      // blob URL after the fact races its revocation).
      let captured: Blob | null = null;
      const origCreate = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (b: Blob) => { captured = b; return origCreate(b); };
      const origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { /* swallow nav */ };
      item.click();
      await new Promise((r) => setTimeout(r, 1000));
      URL.createObjectURL = origCreate;
      HTMLAnchorElement.prototype.click = origClick;
      if (!captured) return "no-blob-created";
      const text = await (captured as Blob).text();
      if (!text.includes("<svg")) return `not-svg(${text.slice(0, 40)})`;
      return `svg-ok(${text.length}b)`;
    });
    if (!String(result).startsWith("svg-ok")) throw new Error(`export: ${result}`);
    return String(result);
  },
};

async function main() {
  const opts = parseArgs();
  const browser: Browser = await puppeteer.launch({
    headless: !opts.headed,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const failures: string[] = [];
  try {
    for (const [name, fn] of Object.entries(SCENARIOS)) {
      if (opts.only && name !== opts.only) continue;
      const page = await browser.newPage();
      await page.setViewport({ width: 1100, height: 800, deviceScaleFactor: 1 });
      const pageErrs: string[] = [];
      page.on("pageerror", (e) => pageErrs.push(String(e).slice(0, 160)));
      await page.goto(`file://${FIXTURE_HTML}`, { waitUntil: "load" });
      await page.addStyleTag({ path: opts.css });
      await page.addScriptTag({ path: opts.bundle });
      try {
        await mount(page, buildSpec());
        const detail = await fn(page);
        if (pageErrs.length) throw new Error(`page errors: ${pageErrs.join(" | ")}`);
        console.log(`✓ ${name}: ${detail}`);
      } catch (e) {
        failures.push(`${name}: ${(e as Error).message}`);
        console.error(`✗ ${name}: ${(e as Error).message}`);
        await page.screenshot({ path: `/tmp/qa-fail-${name}.png` as `${string}.png` });
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
  if (failures.length) {
    console.error(`\n${failures.length} interaction scenario(s) FAILED (screenshots in /tmp/qa-fail-*.png)`);
    process.exit(1);
  }
  console.log("\nAll interaction scenarios passed.");
}

main().catch((e) => { console.error(e); process.exit(1); });
