/**
 * Settings CONSEQUENCE harness (settings-redesign D21, first principle 1:
 * consequence or absence). The per-tab merge bar for the rebuilt panel.
 *
 * Where panel-liveness asserts OPERABILITY (operating a control changes
 * a DOM fingerprint — panel or widget), this harness asserts MEANING:
 * operating a control changes VISIBLE PIXELS in the rendered figure.
 * A control that moves DOM but not pixels is decoration, and decoration
 * does not merge (settings-redesign.md, tab exit gates).
 *
 * Method: mount a fixture armed for every Variations control (groups →
 * banding, forest column → series, title + tag → chrome rows), open the
 * settings cog, walk every `[data-vt]` control on the Variations tab in
 * DOM order (re-queried each step — conditionals like banding-level
 * mount mid-walk), operate it with REAL input (segment click / range
 * keyboard), and pixel-diff a screenshot of the FIGURE region (the area
 * left of the 400px panel) before/after via pixelmatch. Each control
 * must move ≥ MIN_PIXELS pixels.
 *
 * Run after `npm run build`:
 *   cd srcjs && bun run tests/browser/settings-consequence.browser.ts
 */

import puppeteer, { type Page } from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { buildTheme } from "../../src/lib/theme/theme-adapter";
import { NEJM } from "../../src/lib/theme/theme-presets-inputs";
import { tabviz } from "../../src/authoring/tabviz";
import { colNumeric, colPvalue } from "../../src/authoring/columns";
import { vizForest, effectForest } from "../../src/authoring/viz";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_HTML = path.join(__dirname, "fixtures.html");
const BUNDLE = path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.js");
const CSS = path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.css");

/** Pixels that must differ for a control to count as consequential.
 *
 *  Diffing runs at pixelmatch threshold 0 (exact RGB inequality): headless
 *  deterministic rendering produces byte-identical screenshots for an
 *  unchanged figure, so ANY nonzero diff is caused by the operated
 *  control — and several legitimate variations are deliberately faint
 *  (nejm's banding tint is Δ≈4/255; a subtle gradient's angle moves each
 *  pixel ~1/255 — both INVISIBLE to the perceptual 0.05 threshold while
 *  being exactly the theme-blessed look). The floor filters trivia. */
const MIN_PIXELS = 100;

const WIDGET_W = 950;
const WIDGET_H = 650;
const PANEL_W = 400; // .settings-panel fixed width — clip stops left of it

// --only a,b,c : operate just those [data-vt] ids from the fresh mount
// (diagnosis mode — isolates a control from walk-order state accumulation).
const ONLY = (() => {
  const i = process.argv.indexOf("--only");
  return i >= 0 ? new Set(process.argv[i + 1]!.split(",")) : null;
})();

function buildSpec(): unknown {
  // Point estimates deliberately SMALL (0.2–0.4) so the forest markers
  // fall in the LEFT half of the plot region — the part visible left of
  // the 400px settings panel. With HR near 1.0 the markers sat at the
  // right of the plot, behind the panel, and the Plots fill/shape walk
  // measured them off-screen (1px). The axis is pinned [0,1] to keep the
  // mapping stable.
  const rows = [
    { study: "Alpha One", grp: "Group A", n: 240, hr: 0.24, lo: 0.16, hi: 0.34, hr2: 0.31, lo2: 0.22, hi2: 0.42, p: 0.004 },
    { study: "Alpha Two", grp: "Group A", n: 410, hr: 0.30, lo: 0.21, hi: 0.40, hr2: 0.37, lo2: 0.27, hi2: 0.48, p: 0.21 },
    { study: "Beta One", grp: "Group B", n: 150, hr: 0.20, lo: 0.12, hi: 0.30, hr2: 0.27, lo2: 0.18, hi2: 0.37, p: 0.04 },
    { study: "Beta Two", grp: "Group B", n: 380, hr: 0.28, lo: 0.19, hi: 0.38, hr2: 0.34, lo2: 0.24, hi2: 0.45, p: 0.05 },
  ];
  return tabviz({
    data: rows,
    label: "study",
    group: "grp",
    // Every Variations consequence gate armed: title (title row), tag
    // (tag row), forest column (series row), groups (banding group seg).
    title: "Consequence fixture",
    tag: "TABLE 1",
    columns: [
      colNumeric({ field: "n", header: "N", decimals: 0 }),
      // TWO effects → series slots 0 AND 1, so the Identity scheme picker
      // is present and consequential (slot 1+ takes the categorical
      // palette). A single-effect forest would correctly HIDE the scheme.
      vizForest({
        effects: [
          effectForest({ point: "hr", lower: "lo", upper: "hi", label: "Primary" }),
          effectForest({ point: "hr2", lower: "lo2", upper: "hi2", label: "Adjusted" }),
        ],
        axisRange: [0, 1],
        header: "HR (95% CI)",
      }),
      colPvalue({ field: "p", header: "P" }),
    ],
    // caption_style "chip" is BAKED INTO the fixture theme so the Labels
    // tab's tag-text field is consequential REGARDLESS of walk order: the
    // chip renders labels.tag, and reset-theme reverts to this same
    // chip-on theme (not "none"), so the chip survives every reset the
    // walk performs before reaching Labels. Without it the tag field is
    // a real cross-tab dependency the harness rightly flagged.
    theme: buildTheme({ ...NEJM, effects: { ...NEJM.effects, caption_style: "chip" } }, "nejm"),
  });
}

async function settle(page: Page, ms = 350): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** Screenshot the figure region (left of the settings panel), decoded. */
async function shotFigure(page: Page): Promise<PNG> {
  const host = await page.$("#widget");
  const box = (await host!.boundingBox())!;
  const buf = await page.screenshot({
    clip: { x: box.x, y: box.y, width: WIDGET_W - PANEL_W, height: WIDGET_H },
  });
  return PNG.sync.read(Buffer.from(buf));
}

function diffCount(a: PNG, b: PNG): number {
  if (a.width !== b.width || a.height !== b.height) return Number.MAX_SAFE_INTEGER;
  return pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0 });
}

/** Screenshot the figure once it has gone QUIESCENT: poll until two
 *  consecutive shots are pixel-identical (or ~3s). A fixed delay raced
 *  the theme re-resolve — a slow repaint landed during the NEXT op's
 *  window, producing constant small false-positive deltas while the op
 *  that caused them read 0. */
async function shotQuiescent(page: Page): Promise<PNG> {
  let prev = await shotFigure(page);
  for (let i = 0; i < 12; i++) {
    await settle(page, 250);
    const cur = await shotFigure(page);
    if (diffCount(prev, cur) === 0) return cur;
    prev = cur;
  }
  return prev;
}

async function main(): Promise<void> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--force-device-scale-factor=1"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
  await page.goto(`file://${FIXTURE_HTML}`, { waitUntil: "load" });
  await page.addStyleTag({ path: CSS });
  await page.addScriptTag({ path: BUNDLE });

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
  }, buildSpec() as never);
  await settle(page, 700);

  // Open the cog → the panel lands on the Variations tab.
  await page.evaluate(() => {
    const btn = document.querySelector<HTMLElement>(
      ".control-toolbar button[aria-label='Open display settings']");
    if (!btn) throw new Error("settings button not found");
    btn.click();
  });
  await settle(page);
  if (!(await page.$(".settings-panel"))) throw new Error("settings panel did not open");
  if (!(await page.$("[data-vt]"))) throw new Error("Variations tab has no [data-vt] controls");

  const failures: string[] = [];
  const passes: string[] = [];
  const operated = new Set<string>();

  // Walk until a full pass over the CURRENT roster finds nothing new —
  // conditional controls (banding-level/start, glow-anchor, gradient-
  // angle, watermark color/opacity) mount only after their parent is
  // switched on. `attr` selects the tab's control marker (data-vt for
  // Variations, data-lt for Labels).
  async function walk(attr = "data-vt"): Promise<void> {
  for (let round = 0; round < 6; round++) {
    // Open collapsed disclosures so their [data-*] controls are walkable
    // (geometry, status colors). Anchor-row carets stay closed — anchors
    // operate via their hex field.
    await page.evaluate(() => {
      const panel = document.querySelector(".settings-panel");
      if (!panel) return;
      for (const b of panel.querySelectorAll<HTMLElement>('[aria-expanded="false"]')) {
        if (b.closest(".anchor-row")) continue;
        b.click();
      }
    });
    await settle(page, 150);
    const ids = await page.evaluate((a) =>
      [...document.querySelectorAll<HTMLElement>(`[${a}]`)].map((el) => el.getAttribute(a)!),
    attr);
    // Namespace by attr: "title"/"tag" exist on BOTH tabs (Variations
    // style row, Labels text field) — without the prefix the Labels walk
    // skipped them as already-operated.
    const fresh = ids.filter((id) => !operated.has(`${attr}:${id}`) && (!ONLY || ONLY.has(id)));
    if (fresh.length === 0) break;

    for (const id of fresh) {
      const kind = await page.evaluate(({ vtId, a }) => {
        const root = document.querySelector<HTMLElement>(`[${a}="${vtId}"]`);
        if (!root) return "missing";
        if (root.querySelector("input[type=range]")) return "slider";
        if (root.querySelector("[role=radio]")) return "pill";
        if (root.querySelector("select")) return "select";
        if (root.querySelector(".dd-trigger")) return "dropdown";
        if (root.querySelector("input[type=text]")) return "text";
        return "unknown";
      }, { vtId: id, a: attr });

      if (kind === "missing") {
        // A conditional whose parent was switched away mid-walk (e.g.
        // shell → float hides the gradient rows). NOT marked operated —
        // the post-reset sweep retries it from the restored baseline.
        continue;
      }
      operated.add(`${attr}:${id}`);
      const before = await shotQuiescent(page);

      if (kind === "pill") {
        // Click inactive segments — real pointer input — until one moves
        // pixels. Walk from the LAST segment backwards: the last is
        // usually the STRONGEST variant of the row (bold / neon / vivid /
        // boxed), and for banding it avoids leading with "none", which
        // would unmount the dependent start/level controls before the
        // walk reaches them. A control passes when SOME segment moves;
        // adjacent values may be legitimately degenerate from the current
        // state (flush → transparent on a zero-pad shell shows only the
        // paper either way). Dead = NO segment moves anything.
        const tried: string[] = [];
        let moved: { label: string; n: number } | null = null;
        for (let attempt = 0; attempt < 6 && !moved; attempt++) {
          const target = await page.evaluate(({ vtId, skip, a }) => {
            const root = document.querySelector<HTMLElement>(`[${a}="${vtId}"]`)!;
            const segs = [...root.querySelectorAll<HTMLElement>("[role=radio]")]
              .filter((b) => b.getAttribute("aria-checked") !== "true")
              .map((b) => b.textContent!.trim())
              .filter((t) => !skip.includes(t));
            return segs.length ? segs[segs.length - 1] : null;
          }, { vtId: id, skip: tried, a: attr });
          if (target == null) break;
          tried.push(target);
          const handle = await page.evaluateHandle(({ vtId, label, a }) => {
            const root = document.querySelector<HTMLElement>(`[${a}="${vtId}"]`)!;
            return [...root.querySelectorAll<HTMLElement>("[role=radio]")]
              .find((b) => b.textContent!.trim() === label)!;
          }, { vtId: id, label: target, a: attr });
          await (handle.asElement() as import("puppeteer").ElementHandle<Element>).click();
          await settle(page);
          const after = await shotQuiescent(page);
          const n = diffCount(before, after);
          if (n >= MIN_PIXELS) moved = { label: target, n };
        }
        if (tried.length === 0) { failures.push(`${id}: no inactive segment to pick`); continue; }
        if (moved) {
          const note = tried.length > 1 ? ` (degenerate from here: ${tried.slice(0, -1).join(", ")})` : "";
          passes.push(`${id} → "${moved.label}": ${moved.n}px moved${note}`);
        } else {
          failures.push(`${id}: NO segment moved pixels (tried ${tried.join(", ")})`);
        }
      } else if (kind === "slider") {
        // Real keyboard on the focused native range input. End/Home jumps
        // the full domain — the strongest stride (a 4-step nudge on a
        // 0–360° dial was a sub-pixel-budget rotation).
        await page.evaluate(({ vtId, a }) => {
          const root = document.querySelector<HTMLElement>(`[${a}="${vtId}"]`)!;
          root.querySelector<HTMLInputElement>("input[type=range]")!.focus();
        }, { vtId: id, a: attr });
        const atMax = await page.evaluate(({ vtId, a }) => {
          const el = document.querySelector<HTMLElement>(`[${a}="${vtId}"]`)!
            .querySelector<HTMLInputElement>("input[type=range]")!;
          return parseFloat(el.value) >= parseFloat(el.max);
        }, { vtId: id, a: attr });
        const key = atMax ? "Home" : "End";
        await page.keyboard.press(key);
        await settle(page);
        const after = await shotQuiescent(page);
        const n = diffCount(before, after);
        (n >= MIN_PIXELS ? passes : failures).push(
          `${id} (${key}): ${n}px ${n >= MIN_PIXELS ? "moved" : "— NO VISIBLE CONSEQUENCE"}`);
      } else if (kind === "text") {
        // Real typing into the text field (label slots, watermark, hex):
        // click, select-all, type a distinctive value, Enter commits.
        const handle = await page.evaluateHandle(({ vtId, a }) => {
          const root = document.querySelector<HTMLElement>(`[${a}="${vtId}"]`)!;
          return root.querySelector<HTMLInputElement>("input[type=text]")!;
        }, { vtId: id, a: attr });
        const input = handle.asElement() as import("puppeteer").ElementHandle<HTMLInputElement>;
        // Triple-click selects the existing value (Cmd/Ctrl+A is NOT
        // delivered by headless Chromium on macOS — the typed text
        // APPENDED, which the anchor hex field rightly rejected as
        // garbage and snapped back; the walk's 456px "pass" was the
        // focus ring, a false positive this comment exists to prevent
        // re-learning).
        await input.click({ clickCount: 3 });
        const HEXES: Record<string, string> = {
          "anchor-paper": "#f2e8da", "anchor-ink": "#20262e",
          "anchor-brand": "#9a1c1c", "anchor-accent": "#0e7a5f",
        };
        // Swatch hex fields (watermark color, Plots fill/stroke) reject
        // non-hex — feed them a valid color. The color must be DISTINCT
        // per slot: two series' interval lines overlap, so painting
        // slot-1's stroke the same hue as slot-0's already-painted line
        // showed nothing (a false 1px fail). Vary by the trailing slot #.
        const wantsHex = id.includes("color") || id.startsWith("fill-") || id.startsWith("stroke-");
        const slotN = parseInt(id.split("-").pop() ?? "0", 10) || 0;
        const FILLS = ["#cc2200", "#8800cc", "#aa6600"];
        const STROKES = ["#0033cc", "#cc00aa", "#007722"];
        const typed = HEXES[id]
          ?? (id.startsWith("fill-") ? FILLS[slotN % FILLS.length]
            : id.startsWith("stroke-") ? STROKES[slotN % STROKES.length]
            : id.includes("color") ? "#cc2200"
            : `Walked ${id}`);
        await page.keyboard.type(typed, { delay: 5 });
        await page.keyboard.press("Enter");
        await settle(page);
        const after = await shotQuiescent(page);
        const n = diffCount(before, after);
        (n >= MIN_PIXELS ? passes : failures).push(
          `${id} (typed "${typed}"): ${n}px ${n >= MIN_PIXELS ? "moved" : "— NO VISIBLE CONSEQUENCE"}`);
      } else if (kind === "select") {
        // Native <select> (FontFamily roster): pick a different option.
        const picked = await page.evaluate(({ vtId, a }) => {
          const sel = document.querySelector<HTMLSelectElement>(`[${a}="${vtId}"] select`)!;
          const opts = [...sel.options].filter((o) => !o.disabled && o.value !== sel.value);
          if (!opts.length) return null;
          const target = opts[Math.min(2, opts.length - 1)];
          sel.value = target.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          return target.textContent!.trim();
        }, { vtId: id, a: attr });
        if (picked == null) { failures.push(`${id}: native select has no alternative option`); continue; }
        await settle(page);
        const after = await shotQuiescent(page);
        const n = diffCount(before, after);
        (n >= MIN_PIXELS ? passes : failures).push(
          `${id} → "${picked}": ${n}px ${n >= MIN_PIXELS ? "moved" : "— NO VISIBLE CONSEQUENCE"}`);
      } else if (kind === "dropdown") {
        // Custom Dropdown: REAL keyboard only (Svelte 5 delegation — see
        // the liveness harness lessons): focus trigger → ArrowDown opens
        // and advances → Enter commits.
        await page.evaluate(({ vtId, a }) => {
          document.querySelector<HTMLElement>(`[${a}="${vtId}"] .dd-trigger`)!.focus();
        }, { vtId: id, a: attr });
        await page.keyboard.press("ArrowDown");
        await settle(page, 150);
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await settle(page);
        const after = await shotQuiescent(page);
        const n = diffCount(before, after);
        (n >= MIN_PIXELS ? passes : failures).push(
          `${id} (dropdown pick): ${n}px ${n >= MIN_PIXELS ? "moved" : "— NO VISIBLE CONSEQUENCE"}`);
      } else {
        failures.push(`${id}: unrecognized control anatomy (pill/slider/select/dropdown/text all absent)`);
      }
    }
  }
  }

  await walk();

  // Travel check: Reset theme must revert the accumulated Variations
  // edits (every write above was a theme-input write — the matrix).
  const beforeReset = await shotQuiescent(page);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll<HTMLElement>(".settings-panel .bar-btn")]
      .find((b) => b.textContent!.includes("Reset theme"));
    if (!btn) throw new Error("Reset theme button not found");
    if ((btn as HTMLButtonElement).disabled) throw new Error("Reset theme disabled after Variations edits — writes did not land on the theme");
    btn.click();
  });
  await settle(page);
  // The in-widget ConfirmDialog guards the reset — confirm it.
  await page.evaluate(() => {
    document.querySelector<HTMLElement>(".confirm-modal .confirm-btn")?.click();
  });
  await settle(page, 500);
  const afterReset = await shotQuiescent(page);
  const resetMoved = diffCount(beforeReset, afterReset);
  const resetOk = resetMoved >= MIN_PIXELS;
  if (!resetOk) {
    failures.push(`reset-theme: only ${resetMoved}px moved — theme travel broken`);
  }

  // Post-reset sweep: controls a mid-walk pick unmounted before the walk
  // reached them (e.g. shell → float hides the gradient rows) get walked
  // now from the restored baseline.
  await walk();

  // ── LABELS tab (Phase 2) — figure-content controls, figure travel ──
  const gotoTab = async (label: string): Promise<void> => {
    const ok = await page.evaluate((l) => {
      const tab = [...document.querySelectorAll<HTMLElement>(".settings-panel .tab-strip [role=tab]")]
        .find((t) => (t.textContent || "").trim() === l);
      if (!tab) return false;
      tab.click();
      return true;
    }, label);
    if (!ok) throw new Error(`panel tab "${label}" not found`);
    await settle(page, 250);
  };
  await gotoTab("labels");
  if (!(await page.$("[data-lt]"))) throw new Error("Labels tab has no [data-lt] controls");
  await walk("data-lt");

  // ── IDENTITY tab (Phase 3) — Tier-1 identity, theme travel ─────────
  // "edit theme" lands on the Identity inner tab by default.
  await gotoTab("edit theme");
  if (!(await page.$("[data-it]"))) throw new Error("Identity tab has no [data-it] controls");
  await walk("data-it");

  // ── PLOTS inner tab (Phase 4) — per-series viz, theme travel ───────
  const innerOk = await page.evaluate(() => {
    const t = [...document.querySelectorAll<HTMLElement>(".settings-panel .inner-strip [role=tab]")]
      .find((b) => (b.textContent || "").trim() === "plots");
    if (!t) return false;
    t.click();
    return true;
  });
  if (!innerOk) throw new Error("Plots inner tab not found under edit theme");
  await settle(page, 250);
  if (!(await page.$("[data-pt]"))) throw new Error("Plots tab has no [data-pt] controls (fixture needs a viz series)");
  await walk("data-pt");

  // Reset-figure travel: every Labels write is FIGURE state — the scoped
  // reset (on the this-figure tab) must revert the typed labels +
  // watermark.
  const beforeFigReset = await shotQuiescent(page);
  await gotoTab("this figure");
  const figClicked = await page.evaluate(() => {
    const btn = document.querySelector<HTMLButtonElement>(".settings-panel .reset-figure");
    if (!btn) return "missing";
    if (btn.disabled) return "disabled";
    btn.click();
    return "clicked";
  });
  let figResetOk = false;
  let figResetMoved = 0;
  if (figClicked !== "clicked") {
    failures.push(`reset-figure: button ${figClicked} after Labels edits — figure travel broken`);
  } else {
    await settle(page, 500);
    figResetMoved = diffCount(beforeFigReset, await shotQuiescent(page));
    figResetOk = figResetMoved >= MIN_PIXELS;
    if (!figResetOk) failures.push(`reset-figure: only ${figResetMoved}px moved — labels did not revert`);
  }

  console.log(`\nConsequence walk — ${passes.length} consequential, ${failures.length} failing:`);
  for (const p of passes) console.log(`  ✓ ${p}`);
  if (resetOk) console.log(`  ✓ reset-theme reverted the figure (${resetMoved}px)`);
  if (figResetOk) console.log(`  ✓ reset-figure reverted the labels (${figResetMoved}px)`);
  for (const f of failures) console.log(`  ✗ ${f}`);

  await browser.close();
  if (failures.length > 0) {
    console.error(`\nFAIL: ${failures.length} control(s) without visible consequence.`);
    process.exit(1);
  }
  console.log(`\n✓ every Variations + Labels control changes visible pixels (${passes.length} controls + both reset travels)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
