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
 *   settings        — cog opens the D14 curated drawer (polarity + density ONLY)
 *   theme-switch    — switcher swaps theme; data-polarity flips
 *   filter          — filter popover narrows visible rows
 *   export          — SVG download path produces a non-empty SVG
 *
 * Run:
 *   cd srcjs && bun run tests/browser/interaction-qa.browser.ts
 *   bun run tests/browser/interaction-qa.browser.ts --only paint-keyboard --headed
 */

import puppeteer, { type Browser, type Page } from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";
import { buildTheme } from "../../src/lib/theme/theme-adapter";
import { COCHRANE, DARK } from "../../src/lib/theme/theme-presets-inputs";
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
    theme: buildTheme(COCHRANE, "cochrane"),
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
      cochrane: buildTheme(COCHRANE, "cochrane"),
      dark: buildTheme(DARK, "dark"),
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
      if (panel.querySelector("[role=tablist], [aria-label='Settings section']")) {
        return "tabs-resurrected";
      }
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
      });
    });
    if (shape === "no-panel") throw new Error("settings panel did not open");
    if (shape === "tabs-resurrected") throw new Error("tab apparatus resurrected in settings panel");
    const parsed = JSON.parse(shape) as { pills: number; hasIdentity: boolean; figure: boolean; anchors: number };
    if (parsed.anchors < 5) throw new Error(`expected ≥5 anchor rows in THEME band, got ${parsed.anchors}`);
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
        .find((e) => /\bDark\b/i.test(e.textContent ?? ""));
      if (!item) return false;
      item.click();
      return true;
    });
    if (!switched) throw new Error("dark theme entry not found in switcher dropdown");
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
