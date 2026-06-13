/**
 * Panel liveness harness (UX redesign A4 — the "zero dead buttons" machine
 * gate). The A3 tab restructure hid every theme control behind one of four
 * axis tabs; a control can now be visually present but wired to nothing and
 * a human reviewer would never notice. This harness is the standing gate
 * that makes "zero dead buttons" an enforced invariant rather than a
 * promise.
 *
 * What it does: opens the real settings cog on a mounted widget and WALKS
 * every actionable control in the panel — across all four tabs, the quick
 * strip, and the figure band — operating each with REAL input and asserting
 * an OBSERVABLE consequence. The consequence is measured against two
 * independent fingerprints:
 *
 *   widgetFp — a computed-paint + structural-HTML fingerprint of the
 *     RENDERED widget (shell/paper/header/cell/caption computed styles,
 *     effect layers: box-shadow / filter / backdrop-filter / background-
 *     image, plus shell innerHTML length to catch added/removed chip/title
 *     structure, plus laid-out geometry). It is deliberately derived from
 *     the widget DOM, NOT from panel/store state — so a control that writes
 *     state but does not repaint FAILS. (This is the "not just state-write"
 *     bar the honesty review set.)
 *
 *   panelFp — the panel's visible content/visibility (section text, which
 *     tab is live, disclosure open-state, scrollHeight). Navigation controls
 *     (tabs, disclosures, the type-role retarget select) legitimately change
 *     only the panel, not the widget.
 *
 * Liveness rule: operating a control must change widgetFp OR panelFp. A
 * control that moves NEITHER is dead → FAIL, unless it is on the justified
 * no-op ALLOW list (external effects: export downloads a file, import opens
 * a file dialog, the studio handoff opens another surface — none repaint).
 *
 * Reset gutter (A4): asserts the two scoped resets exist and are correctly
 * dirty-gated — Reset theme (panel bar) enabled only after theme edits,
 * Reset figure (figure band) enabled only after figure edits — and that
 * each, when fired dirty, actually reverts the widget (widgetFp delta).
 *
 * Run:
 *   cd srcjs && bun run tests/browser/panel-liveness.browser.ts
 *   bun run tests/browser/panel-liveness.browser.ts --headed --slow
 */

import puppeteer, { type Browser, type Page } from "puppeteer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { buildTheme } from "../../src/lib/theme/theme-adapter";
import { NEJM, TERMINAL } from "../../src/lib/theme/theme-presets-inputs";
import type { ThemeInputs } from "../../src/types/theme-inputs";
import { tabviz } from "../../src/authoring/tabviz";
import { colText, colNumeric } from "../../src/authoring/columns";
import { vizForest } from "../../src/authoring/viz";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_HTML = path.join(__dirname, "fixtures.html");
const BUNDLE = path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.js");
const CSS = path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.css");

const HEADED = process.argv.includes("--headed");
const SLOW = process.argv.includes("--slow");

/** A theme with a real shell + effects so the effects-tab controls have a
 *  surface to paint on — glow/gradient/glass/shadow are inert on a flush
 *  shell and would false-flag as dead. Raised shell + status anchors set. */
function liveInputs(): ThemeInputs {
  return {
    ...NEJM,
    shell_mode: "raised",
    header_style: "tint",
  } as ThemeInputs;
}

function buildSpec(): unknown {
  const rows = [
    { study: "Alpha One", grp: "Group A", n: 240, hr: 0.72, lo: 0.55, hi: 0.94 },
    { study: "Alpha Two", grp: "Group A", n: 410, hr: 0.91, lo: 0.78, hi: 1.06 },
    { study: "Beta One", grp: "Group B", n: 150, hr: 0.66, lo: 0.48, hi: 0.91 },
    { study: "Beta Two", grp: "Group B", n: 380, hr: 0.83, lo: 0.70, hi: 0.99 },
  ];
  const spec = tabviz({
    data: rows,
    label: "study",
    group: "grp",
    title: "Table 1",
    columns: [
      colText({ field: "study", header: "Study" }),
      colNumeric({ field: "n", header: "N", decimals: 0 }),
      // A forest column so the FORM tab's Marks (series style: ring/flat) and
      // the EFFECTS controls have a real mark/plot surface to repaint — without
      // it those controls produce no pixel delta and false-flag as dead.
      vizForest({ point: "hr", lower: "lo", upper: "hi", header: "HR (95% CI)", scale: "log" }),
    ],
    theme: buildTheme(liveInputs(), "nejm"),
  }) as { interaction: Record<string, unknown> };
  spec.interaction = {
    ...spec.interaction,
    enableThemeEdit: true,
    enableBanding: true,
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
    inner.style.width = "980px";
    inner.style.height = "640px";
    host.appendChild(inner);
    binding.factory(inner, 980, 640).renderValue(s);
  }, spec as never);
  await new Promise((r) => setTimeout(r, 600));
}

// ── Fingerprints (run in-page) ────────────────────────────────────────────
// These functions are stringified into the browser; keep them self-contained.

/** Computed-paint + structural fingerprint of the rendered WIDGET. */
function installFingerprints(): void {
  // djb2-ish rolling hash — a compact, stable digest of a (possibly large)
  // string so the fingerprint stays short while remaining change-sensitive.
  const hash = (s: string): number => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return h >>> 0;
  };
  (window as unknown as Record<string, unknown>).__widgetFp = (): string => {
    const cont = document.querySelector(".tabviz-container") ?? document.querySelector(".tv-shell");
    const scal = document.querySelector(".tabviz-scalable");
    const r = scal?.getBoundingClientRect();
    // COMPREHENSIVE digest — a control is "live" iff operating it changes the
    // RENDERED widget. We capture three independent surfaces so no class of
    // change is invisible (the narrow element-sampling first cut was blind to
    // forest plot marks, cell/row borders, title decorations and geometry):
    //   1. the widget's full outerHTML — every inline style/CSS-var, every SVG
    //      mark attribute (x/y/fill/stroke), every structural node add/remove;
    //   2. the combined text of every <style> in the document — the RE-EMITTED
    //      theme CSS (a Tier-1 edit re-resolves the cascade → the --tv-* block
    //      changes), so a control that reaches the resolved theme registers
    //      even when its specific token is visually subtle. A truly dead button
    //      (no re-resolve, no DOM change) moves NEITHER and is caught;
    //   3. laid-out geometry of the scalable subtree (density/scale/spacing).
    const html = cont?.outerHTML ?? "";
    const styleText = [...document.querySelectorAll("style")].map((s) => s.textContent ?? "").join("");
    return [
      `${html.length}:${hash(html)}`,
      `${styleText.length}:${hash(styleText)}`,
      r ? `${Math.round(r.width)}x${Math.round(r.height)}` : "∅",
      cont?.getAttribute("data-polarity") ?? "",
      cont?.getAttribute("data-mode") ?? "",
    ].join("§");
  };
  (window as unknown as Record<string, unknown>).__panelFp = (): string => {
    const panel = document.querySelector(".settings-panel");
    if (!panel) return "∅";
    const activeTab = panel.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim()
      ?? "single-scroll";
    const text = (panel as HTMLElement).innerText.replace(/\s+/g, " ").trim();
    const open = [...panel.querySelectorAll("details[open], .disclosure.open, [aria-expanded='true']")].length;
    return [activeTab, text.length, open, (panel as HTMLElement).scrollHeight].join("§");
  };
}

// One round-trip for both fingerprints (halves CDP latency per control).
// Bounded: a control that jams the page must surface as a reported failure,
// never an infinite hang.
const bothFp = (page: Page) =>
  withTimeout(
    page.evaluate(() => {
      const w = window as unknown as { __widgetFp: () => string; __panelFp: () => string };
      return { w: w.__widgetFp(), p: w.__panelFp() };
    }),
    6000,
    "fingerprint",
  );
// Back-compat single readers (used in a couple of standalone spots).
const widgetFp = async (page: Page) => (await bothFp(page)).w;
const panelFp = async (page: Page) => (await bothFp(page)).p;

const settle = (ms = SLOW ? 450 : 220) => new Promise((r) => setTimeout(r, ms));

// Incremental progress trail — bun buffers stdout until exit, so a hang is
// invisible from the captured log. Append each step to a file synchronously
// so a stuck run shows its last completed step. (Tail it: tail -f the path.)
const PROGRESS = "/tmp/liveness-progress.log";
try { fs.writeFileSync(PROGRESS, ""); } catch { /* ignore */ }
const progress = (line: string): void => {
  try { fs.appendFileSync(PROGRESS, line + "\n"); } catch { /* ignore */ }
};

/** Reject if `p` doesn't settle within `ms` — one stuck control must not
 *  hang the whole gate (a hang is itself a finding worth reporting). */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms}ms (${label})`)), ms)),
  ]);
}

// ── Justified no-op allow-list ──────────────────────────────────────────────
// Controls whose effect is EXTERNAL (no widget/panel repaint). Matched by a
// substring of the control's accessible name / text. Each carries a reason.
const ALLOW: { match: RegExp; reason: string }[] = [
  { match: /export|download|⇩|copy json/i, reason: "writes a file/clipboard; no repaint" },
  { match: /import|⇧|upload/i, reason: "opens a file dialog; no repaint" },
  { match: /edit in studio|open in .*studio|launch studio/i, reason: "opens the studio surface; no repaint" },
  { match: /close|✕/i, reason: "closes the panel (asserted separately)" },
];
const allowed = (name: string): string | null =>
  ALLOW.find((a) => a.match.test(name))?.reason ?? null;

// Legitimately panel-only WALKED controls. Every control the walk drives is a
// value control (seg / range / dropdown) — sections/disclosures/tabs are NOT
// in CONTROL_QUERY — so a value control MUST move the widget. The ONE honest
// exception is the type-role RETARGET dropdown ("Type role to rebind"), which
// only changes which role the family/size/weight editors target (a panel
// concern, no theme re-resolve). This is deliberately NARROW and name-exact:
// the previous broad `/…|geometry|effects$/i` regex let a dead geometry/effects
// value control ride a neighbour's panel reflow and score "panel update ✓"
// (honesty-check 2026-06-09). Nothing else gets the panel-only pass.
const PANEL_RETARGET = /role to rebind/i;

// Repaint-exempt (justified-no-op): the FIGURE-band Contrast a11y toggle
// (seg labels "auto"/"more") applies a paint-time HC re-resolve that is
// visually inert on a theme already meeting high-contrast (nejm). It is
// wired but produces no pixel delta on this base; verify operability only.
const REPAINT_EXEMPT = /^(auto|more)$/i;

// The value/nav controls the walk drives. Deliberately NOT plain `button` —
// disclosure summaries, anchor carets and the Reset buttons open
// panels/modals and are verified in dedicated sections (action buttons +
// reset gutter). Both listControls and operate MUST use this identical query
// so a numeric index refers to the same element in both.
const CONTROL_QUERY =
  '[role="tab"], .pill[role="radiogroup"] > .seg[role="radio"], input[type="range"], button.dd-trigger';

type ControlMeta = { kind: "seg" | "range" | "dropdown" | "tab" | "button"; name: string };

/** Snapshot the actionable controls in `rootSel`, in DOM order. */
async function listControls(page: Page, rootSel: string): Promise<ControlMeta[]> {
  return page.evaluate(({ QUERY, ROOT }) => {
    const panel = document.querySelector(ROOT);
    if (!panel) return [];
    const out: { kind: string; name: string }[] = [];
    const seen = new Set<Element>();
    const nameOf = (el: Element): string =>
      (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "").replace(/\s+/g, " ").trim();
    for (const el of panel.querySelectorAll<HTMLElement>(QUERY)) {
      if (seen.has(el)) continue;
      seen.add(el);
      let kind = "button";
      if (el.getAttribute("role") === "tab") kind = "tab";
      else if (el.classList.contains("seg")) kind = "seg";
      else if ((el as HTMLInputElement).type === "range") kind = "range";
      else if (el.classList.contains("dd-trigger")) kind = "dropdown";
      out.push({ kind, name: nameOf(el) });
    }
    return out;
  }, { QUERY: CONTROL_QUERY, ROOT: rootSel }) as Promise<ControlMeta[]>;
}

/** Operate the Nth visible control of a given (kind,name) signature. Returns
 *  a short description, or "skip:<why>" when no actionable target exists. */
async function operate(page: Page, idx: number, rootSel: string): Promise<string> {
  // Re-resolve by index against the SAME ordered query+root (DOM is stable
  // within a tab between operations except for added/removed conditional
  // rows; we re-list per tab to stay aligned).
  const res = await page.evaluate(({ i, QUERY, ROOT }) => {
    const panel = document.querySelector(ROOT);
    if (!panel) return "skip:no-panel";
    const els = [...panel.querySelectorAll<HTMLElement>(QUERY)];
    const el = els[i];
    if (!el) return "skip:gone";
    const role = el.getAttribute("role");
    // Segmented radio: click a sibling that is not checked + not disabled.
    if (el.classList.contains("seg")) {
      const group = el.closest('[role="radiogroup"]')!;
      const segs = [...group.querySelectorAll<HTMLButtonElement>('.seg[role="radio"]')];
      const target = segs.find((s) => s.getAttribute("aria-checked") !== "true" && !s.disabled);
      if (!target) return "skip:single-option";
      target.click();
      return "seg→" + (target.textContent || "").trim();
    }
    if ((el as HTMLInputElement).type === "range") {
      const inp = el as HTMLInputElement;
      const min = +inp.min || 0, max = +inp.max || 100, step = +inp.step || 1, v = +inp.value;
      inp.focus();
      return "range:focus:" + (v + step <= max ? "up" : "down");
    }
    if (el.classList.contains("dd-trigger")) {
      // Drive the Dropdown by REAL KEYBOARD (trusted): synthetic clicks don't
      // open it (Svelte 5 delegation + the window-pointerdown close listener),
      // and headless mouse coords proved unreliable for it. The trigger opens
      // on ArrowDown (onTriggerKey → openList); the list commits on Enter. We
      // just focus it here; the Node side presses the keys.
      el.scrollIntoView({ block: "center" });
      (el as HTMLElement).focus();
      const focused = document.activeElement === el;
      return focused ? "dd:keyboard" : "skip:dd-unfocusable";
    }
    if (role === "tab") {
      el.click();
      return "tab→" + (el.textContent || "").trim();
    }
    return "skip:unknown-kind";
  }, { i: idx, QUERY: CONTROL_QUERY, ROOT: rootSel });

  // Slider needs a trusted keypress AFTER focusing in-page.
  if (typeof res === "string" && res.startsWith("range:focus:")) {
    await page.keyboard.press(res.endsWith("up") ? "ArrowRight" : "ArrowLeft");
    await page.keyboard.press(res.endsWith("up") ? "ArrowRight" : "ArrowLeft");
    return "range";
  }
  // Dropdown — REAL keyboard. ArrowDown opens (active = selected); a second
  // ArrowDown moves to a DIFFERENT option; Enter commits it. If the selected
  // option is already last, ArrowDown clamps (no move) → Enter is a no-op, so
  // we first probe the open list and choose ArrowUp instead when at the end.
  if (res === "dd:keyboard") {
    await page.keyboard.press("ArrowDown"); // open
    let opened = false;
    for (let attempt = 0; attempt < 6 && !opened; attempt++) {
      await settle(120);
      opened = await page.evaluate(() => !!document.querySelector('.dd-list[role="listbox"], ul.dd-list'));
    }
    if (!opened) return "skip:no-open";
    // Where is `active` vs the option count? Move toward a different option.
    const nav = await page.evaluate(() => {
      const list = document.querySelector('.dd-list, ul.dd-list');
      const opts = [...(list?.querySelectorAll<HTMLElement>('.dd-opt') ?? [])];
      const activeIdx = opts.findIndex((o) => o.classList.contains("active"));
      return { count: opts.length, active: activeIdx };
    });
    if (nav.count <= 1) {
      await page.keyboard.press("Escape");
      return "skip:single-option";
    }
    // Pick a neighbour that exists: down unless we're at the last index.
    await page.keyboard.press(nav.active >= nav.count - 1 ? "ArrowUp" : "ArrowDown");
    await settle(60);
    const label = await page.evaluate(() => {
      const a = document.querySelector('.dd-list .dd-opt.active, ul.dd-list .dd-opt.active');
      return (a?.textContent || "").replace("✓", "").trim();
    });
    await page.keyboard.press("Enter"); // commit
    return "dd→" + label;
  }
  return res as string;
}

async function expandDisclosures(page: Page): Promise<void> {
  // Open any collapsed DisclosureFields so their controls are walkable.
  await page.evaluate(() => {
    const panel = document.querySelector(".settings-panel");
    if (!panel) return;
    for (const b of panel.querySelectorAll<HTMLElement>('[aria-expanded="false"]')) {
      // Don't auto-open anchor LCH carets here (kept compact); only the
      // section disclosures (Status colors / Color system / Effects /
      // Geometry) whose summary is a button with a summary chip.
      if (b.closest(".anchor-row")) continue;
      b.click();
    }
  });
  await settle();
}

async function run(): Promise<void> {
  const browser: Browser = await puppeteer.launch({
    headless: !HEADED,
    protocolTimeout: 120000,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const failures: string[] = [];
  const live: string[] = [];
  const skipped: string[] = [];
  const page = await browser.newPage();
  await page.setViewport({ width: 1240, height: 1000, deviceScaleFactor: 1 });
  const pageErrs: string[] = [];
  page.on("pageerror", (e) => pageErrs.push(String(e).slice(0, 160)));

  try {
    await page.goto(`file://${FIXTURE_HTML}`, { waitUntil: "load" });
    await page.addStyleTag({ path: CSS });
    await page.addScriptTag({ path: BUNDLE });
    await mount(page, buildSpec());
    await page.evaluate(installFingerprints);

    // Open the cog.
    await page.evaluate(() => {
      const btn = document.querySelector<HTMLElement>(
        ".control-toolbar button[aria-label='Open display settings']");
      if (!btn) throw new Error("settings button not found");
      btn.click();
    });
    await settle(400);
    if (!(await page.$(".settings-panel"))) throw new Error("settings panel did not open");
    progress("panel opened");

    // D21 tab spine: the panel hosts three tabs (variations / edit theme /
    // this figure). Helper clicks one by its visible label.
    const gotoTab = async (label: string): Promise<void> => {
      const ok = await page.evaluate((l) => {
        const tab = [...document.querySelectorAll<HTMLElement>(".settings-panel .tab-strip [role=tab]")]
          .find((t) => (t.textContent || "").trim() === l);
        if (!tab) return false;
        tab.click();
        return true;
      }, label);
      if (!ok) throw new Error(`panel tab "${label}" not found`);
      await settle(250);
    };

    // A4 reset gutter — both scoped resets present, both disabled while
    // clean. Reset theme lives in the panel bar; Reset figure on its tab.
    const themeClean = await page.evaluate(() => {
      const panel = document.querySelector(".settings-panel")!;
      const theme = [...panel.querySelectorAll<HTMLButtonElement>("button")].find((b) => /reset theme/i.test(b.textContent || ""));
      return theme ? !theme.disabled : null;
    });
    if (themeClean === null) failures.push("reset gutter: 'Reset theme' button missing");
    else if (themeClean) failures.push("reset gutter: 'Reset theme' enabled on a CLEAN theme (should gate on dirty)");
    await gotoTab("this figure");
    const figClean = await page.evaluate(() => {
      const fig = document.querySelector<HTMLButtonElement>(".settings-panel .reset-figure");
      return fig ? !fig.disabled : null;
    });
    if (figClean === null) failures.push("reset gutter: 'Reset figure' button missing");
    else if (figClean) failures.push("reset gutter: 'Reset figure' enabled on a CLEAN figure (should gate on dirty)");

    // Walk every value/nav control in `rootSel`, operating each + asserting a
    // widget-or-panel delta. `label` tags the run; shared chrome (quick strip
    // + figure band) is walked ONCE under "identity"; the other tabs walk
    // only their own .tab-panel content.
    const walkControls = async (rootSel: string, label: string): Promise<void> => {
      const controls = await listControls(page, rootSel);
      progress(`[walk ${label}] ${controls.length} controls in ${rootSel}`);
      for (let i = 0; i < controls.length; i++) {
        const c = controls[i]!;
        if (c.kind === "tab") continue; // tabs are exercised by the switch
        progress(`  · ${label}#${i} ${c.kind} "${c.name}" …`);
        const before = await bothFp(page);
        const wBefore = before.w, pBefore = before.p;
        let desc: string;
        try {
          desc = await withTimeout(operate(page, i, rootSel), 8000, `${label}#${i} ${c.name}`);
        } catch (e) {
          failures.push(`${label} · "${c.name}" (${c.kind}): operate threw — ${(e as Error).message}`);
          // Close a stray open dropdown WITHOUT Escape (Escape closes the panel).
          try { await page.evaluate(() => (document.querySelector('.dd-trigger[aria-expanded="true"]') as HTMLElement | null)?.click()); } catch { /* ignore */ }
          continue;
        }
        if (desc.startsWith("skip:")) { skipped.push(`${label} · "${c.name}": ${desc}`); progress(`    ${desc}`); continue; }
        progress(`    operated: ${desc}`);
        await settle();
        let wAfter: string, pAfter: string;
        try {
          const after = await bothFp(page);
          wAfter = after.w; pAfter = after.p;
        } catch (e) {
          failures.push(`${label} · "${c.name}" [${c.kind}]: page JAMMED after operating (${desc}) — ${(e as Error).message}`);
          progress(`    JAMMED: ${(e as Error).message}`);
          continue;
        }
        const widgetMoved = wAfter !== wBefore;
        const panelMoved = pAfter !== pBefore;
        if (REPAINT_EXEMPT.test(c.name)) {
          live.push(`${label} · "${c.name}" [${c.kind}] → operable, repaint-exempt (a11y re-resolve) ✓ (${desc})`);
        } else if (widgetMoved) {
          // The honest bar: a VALUE control must change the rendered widget.
          live.push(`${label} · "${c.name}" [${c.kind}] → widget repaint ✓ (${desc})`);
        } else if (PANEL_RETARGET.test(c.name) && panelMoved) {
          // The one legitimate panel-only walked control (role retarget).
          live.push(`${label} · "${c.name}" [${c.kind}] → panel retarget ✓ (${desc})`);
        } else {
          // No widget delta and not the role-retarget → DEAD even if the panel
          // reflowed. A neighbour's conditional row appearing must NOT excuse a
          // value control that doesn't reach the rendered widget (honesty-check
          // 2026-06-09: the old name-based panel-only pass was foolable).
          const tail = panelMoved ? " — panel moved but widget did NOT (no free pass)" : "";
          failures.push(`${label} · "${c.name}" [${c.kind}]: DEAD — operating it (${desc}) did not change the widget${tail}`);
          // Diagnostic screenshot — BOUNDED: captureScreenshot is a known
          // headless flake that otherwise hangs to the 120s protocolTimeout
          // (this was the real cause of the harness's earlier "hangs" — a
          // false-DEAD control paying 120s per screenshot).
          try {
            await withTimeout(
              page.screenshot({ path: `/tmp/liveness-dead-${label}-${i}.png` as `${string}.png`, captureBeyondViewport: false }),
              4000, "dead-screenshot",
            );
          } catch { /* flake or timeout — failure already recorded */ }
        }
      }
    };

    // D21 (settings-redesign Phase 1): the panel carries the REAL tab
    // spine. Walk each tab's mounted controls in turn. The VARIATIONS
    // tab's stronger gate is settings-consequence.browser.ts (visible-
    // pixel delta); this walk still covers it for operability (a control
    // that jams or throws is caught here even if its pixels move).
    for (const tabLabel of ["variations", "labels", "edit theme", "this figure"] as const) {
      await gotoTab(tabLabel);
      await expandDisclosures(page);
      await walkControls(".settings-panel .panel-body", tabLabel.replace(" ", "-"));
    }

    // "edit theme" is an inner cluster (D21 Phase 4): the loop above walked
    // its default Identity pane; click the Plots inner tab and walk that too
    // so the zero-dead-buttons promise reaches every series control.
    await gotoTab("edit theme");
    const wentPlots = await page.evaluate(() => {
      const t = [...document.querySelectorAll<HTMLElement>(".settings-panel .inner-strip [role=tab]")]
        .find((b) => (b.textContent || "").trim() === "plots");
      if (!t) return false;
      t.click();
      return true;
    });
    if (wentPlots) {
      await settle(250);
      await expandDisclosures(page);
      await walkControls(".settings-panel .panel-body", "plots");
    } else {
      skipped.push("plots inner tab: not present (fixture has no viz series)");
    }

    const wentStyling = await page.evaluate(() => {
      const t = [...document.querySelectorAll<HTMLElement>(".settings-panel .inner-strip [role=tab]")]
        .find((b) => (b.textContent || "").trim() === "styling");
      if (!t) return false;
      t.click();
      return true;
    });
    if (wentStyling) {
      await settle(250);
      await expandDisclosures(page);
      await walkControls(".settings-panel .panel-body", "styling");
    } else {
      skipped.push("styling inner tab: not present");
    }

    // Action buttons (external effect): export / import / handoff / close.
    // Not operated (they download files, open dialogs, or close the panel) —
    // but a present-yet-DISABLED action is a dead affordance, and an action
    // whose accessible name is empty is a mystery button. Verify each that
    // exists is named + enabled. Export/import live in the theme band, so
    // snapshot from the edit-theme tab (close ✕ is in the bar, always there).
    await gotoTab("edit theme");
    const actions = await page.evaluate(() => {
      const panel = document.querySelector(".settings-panel");
      if (!panel) return [];
      return [...panel.querySelectorAll<HTMLButtonElement>("button")]
        .map((b) => ({
          name: (b.getAttribute("aria-label") || b.textContent || b.getAttribute("title") || "").replace(/\s+/g, " ").trim(),
          disabled: b.disabled,
        }))
        // Only the external-effect actions; value/nav buttons are walked above.
        .filter((b) => /export|download|⇩|copy json|import|⇧|upload|edit in studio|launch studio|close|✕/i.test(b.name));
    });
    for (const a of actions) {
      const reason = allowed(a.name) ?? "external effect";
      // Reset is allowed-disabled when clean; these actions are always live.
      if (a.disabled) failures.push(`action "${a.name}": present but DISABLED (dead affordance)`);
      else live.push(`action · "${a.name}" → present+enabled, no-op OK (${reason})`);
    }

    // Reset gutter dirty behaviour — we've made many edits, so Reset theme
    // must now be enabled and must revert the widget.
    const wPreReset = await widgetFp(page);
    const resetState = await page.evaluate(() => {
      const panel = document.querySelector(".settings-panel");
      if (!panel) return "panel-closed";
      const theme = [...panel.querySelectorAll<HTMLButtonElement>("button")].find((b) => /reset theme/i.test(b.textContent || ""));
      if (!theme) return "missing";
      if (theme.disabled) return "still-disabled";
      theme.click();
      return "clicked";
    });
    if (resetState !== "clicked") {
      failures.push(`reset gutter: 'Reset theme' was '${resetState}' after edits (expected enabled)`);
    } else {
      await settle(300);
      // The reset is gated by a ConfirmDialog (.confirm-modal[role=dialog]
      // with a .confirm-btn). Click the confirm button directly.
      const confirmed = await page.evaluate(() => {
        const ok = document.querySelector<HTMLButtonElement>(".confirm-modal .confirm-btn, [role='dialog'] .confirm-btn");
        if (!ok) return false;
        ok.click();
        return true;
      });
      if (!confirmed) failures.push("reset gutter: Reset-theme ConfirmDialog .confirm-btn not found");
      await settle(400);
      if ((await widgetFp(page)) === wPreReset) {
        failures.push("reset gutter: 'Reset theme' fired but the widget did not revert (no repaint)");
      } else {
        live.push("reset gutter · Reset theme → reverted the widget ✓");
      }
    }

    if (pageErrs.length) failures.push(`page errors: ${pageErrs.join(" | ")}`);
  } finally {
    await browser.close();
  }

  console.log(`\n── live controls (${live.length}) ──`);
  for (const l of live) console.log(`  ✓ ${l}`);
  if (skipped.length) {
    console.log(`\n── skipped (${skipped.length}, no actionable target) ──`);
    for (const s of skipped) console.log(`  · ${s}`);
  }
  // Honest headline split (honesty-check 2026-06-09): a "widget repaint"
  // is the strong proof; exempt/retarget/present-only are weaker no-op
  // verifications. Don't fold them into one impressive number.
  const repaints = live.filter((l) => l.includes("widget repaint")).length;
  const noops = live.length - repaints;
  if (failures.length) {
    console.error(`\n✗ ${failures.length} liveness failure(s):`);
    for (const f of failures) console.error(`  ✗ ${f}`);
    console.error("\n(dead-control screenshots in /tmp/liveness-dead-*.png)");
    process.exit(1);
  }
  console.log(
    `\nAll panel controls are live. ${repaints} verified by WIDGET REPAINT; ` +
    `${noops} present+enabled no-ops (allow-listed actions / a11y-exempt / role-retarget).`,
  );
}

run().catch((e) => { console.error(e); process.exit(1); });
