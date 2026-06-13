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
import { vizForest } from "../../src/authoring/viz";

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
  const rows = [
    { study: "Alpha One", grp: "Group A", n: 240, hr: 0.72, lo: 0.55, hi: 0.94, p: 0.004 },
    { study: "Alpha Two", grp: "Group A", n: 410, hr: 0.91, lo: 0.78, hi: 1.06, p: 0.21 },
    { study: "Beta One", grp: "Group B", n: 150, hr: 0.66, lo: 0.44, hi: 0.99, p: 0.04 },
    { study: "Beta Two", grp: "Group B", n: 380, hr: 0.83, lo: 0.69, hi: 1.0, p: 0.05 },
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
      vizForest({ point: "hr", lower: "lo", upper: "hi", header: "HR (95% CI)" }),
      colPvalue({ field: "p", header: "P" }),
    ],
    theme: buildTheme(NEJM, "nejm"),
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
  // angle) mount only after their parent is switched on.
  async function walk(): Promise<void> {
  for (let round = 0; round < 6; round++) {
    const ids = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-vt]")].map((el) => el.dataset.vt!),
    );
    const fresh = ids.filter((id) => !operated.has(id) && (!ONLY || ONLY.has(id)));
    if (fresh.length === 0) break;

    for (const id of fresh) {
      const kind = await page.evaluate((vtId) => {
        const root = document.querySelector<HTMLElement>(`[data-vt="${vtId}"]`);
        if (!root) return "missing";
        if (root.querySelector("input[type=range]")) return "slider";
        if (root.querySelector("[role=radio]")) return "pill";
        return "unknown";
      }, id);

      if (kind === "missing") {
        // A conditional whose parent was switched away mid-walk (e.g.
        // shell → float hides the gradient rows). NOT marked operated —
        // the post-reset sweep retries it from the restored baseline.
        continue;
      }
      operated.add(id);
      const before = await shotFigure(page);

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
          const target = await page.evaluate(({ vtId, skip }) => {
            const root = document.querySelector<HTMLElement>(`[data-vt="${vtId}"]`)!;
            const segs = [...root.querySelectorAll<HTMLElement>("[role=radio]")]
              .filter((b) => b.getAttribute("aria-checked") !== "true")
              .map((b) => b.textContent!.trim())
              .filter((t) => !skip.includes(t));
            return segs.length ? segs[segs.length - 1] : null;
          }, { vtId: id, skip: tried });
          if (target == null) break;
          tried.push(target);
          const handle = await page.evaluateHandle(({ vtId, label }) => {
            const root = document.querySelector<HTMLElement>(`[data-vt="${vtId}"]`)!;
            return [...root.querySelectorAll<HTMLElement>("[role=radio]")]
              .find((b) => b.textContent!.trim() === label)!;
          }, { vtId: id, label: target });
          await (handle.asElement() as import("puppeteer").ElementHandle<Element>).click();
          await settle(page);
          const after = await shotFigure(page);
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
        await page.evaluate((vtId) => {
          const root = document.querySelector<HTMLElement>(`[data-vt="${vtId}"]`)!;
          root.querySelector<HTMLInputElement>("input[type=range]")!.focus();
        }, id);
        const atMax = await page.evaluate((vtId) => {
          const el = document.querySelector<HTMLElement>(`[data-vt="${vtId}"]`)!
            .querySelector<HTMLInputElement>("input[type=range]")!;
          return parseFloat(el.value) >= parseFloat(el.max);
        }, id);
        const key = atMax ? "Home" : "End";
        await page.keyboard.press(key);
        await settle(page);
        const after = await shotFigure(page);
        const n = diffCount(before, after);
        (n >= MIN_PIXELS ? passes : failures).push(
          `${id} (${key}): ${n}px ${n >= MIN_PIXELS ? "moved" : "— NO VISIBLE CONSEQUENCE"}`);
      } else {
        failures.push(`${id}: unrecognized control anatomy (no pill, no slider)`);
      }
    }
  }
  }

  await walk();

  // Travel check: Reset theme must revert the accumulated Variations
  // edits (every write above was a theme-input write — the matrix).
  const beforeReset = await shotFigure(page);
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
  const afterReset = await shotFigure(page);
  const resetMoved = diffCount(beforeReset, afterReset);
  const resetOk = resetMoved >= MIN_PIXELS;
  if (!resetOk) {
    failures.push(`reset-theme: only ${resetMoved}px moved — theme travel broken`);
  }

  // Post-reset sweep: controls a mid-walk pick unmounted before the walk
  // reached them (e.g. shell → float hides the gradient rows) get walked
  // now from the restored baseline.
  await walk();

  console.log(`\nConsequence walk — ${passes.length} consequential, ${failures.length} failing:`);
  for (const p of passes) console.log(`  ✓ ${p}`);
  if (resetOk) console.log(`  ✓ reset-theme reverted the figure (${resetMoved}px)`);
  for (const f of failures) console.log(`  ✗ ${f}`);

  await browser.close();
  if (failures.length > 0) {
    console.error(`\nFAIL: ${failures.length} control(s) without visible consequence.`);
    process.exit(1);
  }
  console.log(`\n✓ every Variations control changes visible pixels (${passes.length} controls + reset travel)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
