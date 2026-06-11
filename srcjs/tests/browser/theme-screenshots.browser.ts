/**
 * Browser theme-screenshot harness (wire-audit Pass 1a, C34/D11).
 *
 * The V8+rsvg visual-regression pipeline CANNOT see browser-additive
 * theme effects (shell/paper surfaces, textures, glow, gradient strip,
 * glass) — svg-generator emits a flat rect. This harness is the ONLY
 * gate that validates them: it mounts a representative forest spec under
 * each listed preset in real Chromium, asserts the structural invariants
 * of the shell/paper wrap, and writes a PNG per preset for eyeballing
 * with the Read tool.
 *
 * Assertions (exit non-zero on failure) — spacing-rework contract
 * (2026-06-05):
 *   - every preset: `.tv-shell > .tabviz-scalable > .tv-paper` chain
 *     exists (paper INSIDE the measured scalable); scope carries the
 *     full data-attribute set; when the strip renders it sits BETWEEN
 *     the caption block and the paper (the caption<->data seam).
 *   - flush presets (cochrane): shell AND paper geometrically INERT —
 *     zero padding, transparent shell bg.
 *   - raised presets (nature): density-scaled band (>=12px) + paper
 *     inner mat (>=8px); a pinned texture paints on the SHELL.
 *   - float presets (synthwave): texture on the SHELL (the paper
 *     fallthrough is deleted); shell owns air for the drop shadow;
 *     glow pins put `.tv-glow` + non-none box-shadow on the shell.
 *   - flush+texture presets (brutalist): grid texture on the SHELL.
 *
 * Run:
 *   cd srcjs && bun run tests/browser/theme-screenshots.browser.ts
 *   bun run tests/browser/theme-screenshots.browser.ts --preset synthwave --headed
 * Output: tests/browser/screenshots/<preset>.png (gitignored eyeball artifacts)
 */

import puppeteer, { type Page } from "puppeteer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { buildTheme } from "../../src/lib/theme/theme-adapter";
import { PRESETS } from "../../src/lib/theme/theme-presets-inputs";
import { tabviz } from "../../src/authoring/tabviz";
import { colText, colN, colInterval, colPvalue } from "../../src/authoring/columns";
import { vizForest } from "../../src/authoring/viz";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_HTML = path.join(__dirname, "fixtures.html");
const DEFAULT_BUNDLE = path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.js");
const DEFAULT_CSS = path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.css");
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

/** Presets exercised by default — one per shell-mode/texture archetype. */
const DEFAULT_PRESETS = ["nejm", "newsprint", "synthwave", "brutalist", "terminal"];

function parseArgs() {
  const args = process.argv.slice(2);
  const o = {
    bundle: DEFAULT_BUNDLE,
    css: DEFAULT_CSS,
    headed: false,
    presets: DEFAULT_PRESETS,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--bundle") o.bundle = path.resolve(args[++i]!);
    else if (a === "--css") o.css = path.resolve(args[++i]!);
    else if (a === "--headed") o.headed = true;
    else if (a === "--preset") o.presets = [args[++i]!];
    else if (a === "--all") o.presets = Object.keys(PRESETS);
  }
  return o;
}

/** 8-row meta-analysis — same shape (and authoring path) as the studio
 *  forge, so the fixture exercises the real wire format. */
function buildSpec(presetName: string): unknown {
  const rows = [
    { study: "Alpha 2024",   region: "Americas", n: 245, hr: 0.72, lo: 0.58, hi: 0.89, p: 0.004 },
    { study: "Beta 2023",    region: "Americas", n: 189, hr: 0.81, lo: 0.65, hi: 1.01, p: 0.062 },
    { study: "Gamma 2022",   region: "Europe",   n: 312, hr: 0.66, lo: 0.50, hi: 0.86, p: 0.0008 },
    { study: "Delta 2021",   region: "Europe",   n: 278, hr: 0.74, lo: 0.59, hi: 0.93, p: 0.011 },
    { study: "Epsilon 2024", region: "Asia",     n: 478, hr: 0.91, lo: 0.78, hi: 1.06, p: 0.23 },
    { study: "Zeta 2023",    region: "Asia",     n: 156, hr: 0.65, lo: 0.49, hi: 0.85, p: 0.002 },
    { study: "Eta 2022",     region: "Africa",   n: 134, hr: 0.79, lo: 0.62, hi: 1.01, p: 0.071 },
    { study: "Theta 2025",   region: "Oceania",  n: 412, hr: 0.83, lo: 0.69, hi: 0.99, p: 0.038 },
  ];
  let inputs = PRESETS[presetName];
  if (!inputs) throw new Error(`unknown preset: ${presetName}`);
  // 1c validation rig: exercise the caption chip on brutalist (rubrication
  // chip over grid texture — the lab's signature stamp).
  if (presetName === "brutalist") {
    inputs = { ...inputs, effects: { ...inputs.effects, caption_style: "chip" as const } };
  }
  return tabviz({
    data: rows,
    label: "study",
    columns: [
      colText({ field: "region", header: "Region" }),
      colN({ field: "n", header: "N" }),
      colInterval({ point: "hr", lower: "lo", upper: "hi", header: "HR (95% CI)" }),
      colPvalue({ field: "p", stars: true, header: "P" }),
      vizForest({ point: "hr", lower: "lo", upper: "hi", axisLabel: "Hazard ratio" }),
    ],
    theme: buildTheme(inputs, presetName),
    title: `${presetName} — wire-audit Pass 1a fixture`,
    subtitle: "shell / paper / texture / glow",
    tag: "Table 1",
  });
}

interface ShellProbe {
  hasChain: boolean;
  scopeAttrs: Record<string, string | null>;
  shellPadding: string;
  shellBg: string;
  shellBoxShadow: string;
  shellBgImage: string;
  paperPadding: string;
  hasStrip: boolean;
  stripAfterCaption: boolean;
  stripBeforePaper: boolean;
  hasCaptionChip: boolean;
}

async function probeShell(page: Page): Promise<ShellProbe> {
  return page.evaluate(() => {
    const scope = document.querySelector(".tabviz-container.tabviz-scope");
    const shell = scope?.querySelector(":scope > .tv-shell") ?? null;
    // Spacing rework (2026-06-05): the paper lives INSIDE the measured
    // scalable, ordered caption -> strip -> paper -> footer.
    const scalable = shell?.querySelector(":scope > .tabviz-scalable") ?? null;
    const paper = scalable?.querySelector(":scope > .tv-paper") ?? null;
    const caption = scalable?.querySelector(":scope > .tv-caption") ?? null;
    const strip = scalable?.querySelector(":scope > .shell-strip") ?? null;
    const cs = shell ? getComputedStyle(shell) : null;
    const ps = paper ? getComputedStyle(paper) : null;
    // Strip must sit between the caption block and the paper (the lab's
    // caption<->data seam), never above the caption.
    let stripAfterCaption = true;
    if (strip && caption) {
      stripAfterCaption = !!(caption.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING);
    }
    let stripBeforePaper = true;
    if (strip && paper) {
      stripBeforePaper = !!(strip.compareDocumentPosition(paper) & Node.DOCUMENT_POSITION_FOLLOWING);
    }
    return {
      hasChain: !!(scope && shell && scalable && paper),
      scopeAttrs: {
        shellMode: scope?.getAttribute("data-shell-mode") ?? null,
        shellTexture: scope?.getAttribute("data-shell-texture") ?? null,
        mode: scope?.getAttribute("data-mode") ?? null,
        polarity: scope?.getAttribute("data-polarity") ?? null,
        density: scope?.getAttribute("data-density") ?? null,
      },
      shellPadding: cs?.padding ?? "",
      shellBg: cs?.backgroundColor ?? "",
      shellBoxShadow: cs?.boxShadow ?? "",
      shellBgImage: cs?.backgroundImage ?? "",
      paperPadding: ps?.padding ?? "",
      hasStrip: !!strip,
      stripAfterCaption,
      stripBeforePaper,
      hasCaptionChip: !!caption?.querySelector(":scope > .tv-caption-chip"),
    };
  });
}

function assertPreset(name: string, p: ShellProbe): string[] {
  const errs: string[] = [];
  const ok = (cond: boolean, msg: string) => { if (!cond) errs.push(`${name}: ${msg}`); };

  ok(p.hasChain, "scope > tv-shell > tabviz-scalable > tv-paper chain missing");
  ok(p.scopeAttrs.shellMode !== null, "data-shell-mode missing");
  ok(p.scopeAttrs.mode !== null, "data-mode missing");
  ok(p.scopeAttrs.polarity !== null, "data-polarity missing");
  ok(p.scopeAttrs.density !== null, "data-density missing");
  // Seam contract (spacing rework): when the strip renders it must sit
  // BETWEEN the caption block and the paper, never cap the widget.
  ok(p.stripAfterCaption, "shell-strip renders above the caption block (must be the caption<->data seam)");
  ok(p.stripBeforePaper, "shell-strip renders below the paper (must be the caption<->data seam)");

  if (name === "cochrane") {
    // Flush archetype: the wrap must be geometrically inert.
    ok(p.scopeAttrs.shellMode === "flush", `expected flush, got ${p.scopeAttrs.shellMode}`);
    ok(p.shellPadding === "0px", `flush shell must have 0 padding, got "${p.shellPadding}"`);
    ok(/rgba\(0, 0, 0, 0\)|transparent/.test(p.shellBg), `flush shell bg must be transparent, got "${p.shellBg}"`);
    ok(p.paperPadding === "0px", `flush paper must have 0 padding, got "${p.paperPadding}"`);
  }
  if (name === "nature") {
    // Raised + ruled: density-scaled band (20px comfortable); texture on the SHELL.
    ok(p.scopeAttrs.shellMode === "raised", `expected raised, got ${p.scopeAttrs.shellMode}`);
    ok(parseFloat(p.shellPadding) >= 12, `raised shell band must be a real density-scaled band, got "${p.shellPadding}"`);
    ok(parseFloat(p.paperPadding) >= 8, `raised paper must carry an inner mat, got "${p.paperPadding}"`);
    ok(p.shellBgImage !== "none", "raised+ruled: shell background-image (texture) missing");
  }
  if (name === "synthwave") {
    // Float + grid + neon glow: texture on the SHELL (fallthrough deleted); shell glows.
    ok(p.scopeAttrs.shellMode === "float", `expected float, got ${p.scopeAttrs.shellMode}`);
    ok(p.shellBgImage !== "none", "float+grid: shell background-image (texture) missing");
    ok(parseFloat(p.shellPadding) >= 12, `float shell owns the air for the paper's drop shadow, got "${p.shellPadding}"`);
    ok(p.shellBoxShadow !== "none", "glow_intensity pin: shell box-shadow missing (.tv-glow)");
    ok(p.scopeAttrs.polarity === "dark", `synthwave is dark, got ${p.scopeAttrs.polarity}`);
  }
  if (name === "brutalist") {
    // Flush + grid: texture on the (transparent-bg) SHELL.
    ok(p.shellBgImage !== "none", "flush+grid: shell background-image (texture) missing");
    // 1c: caption chip renders (fixture pins caption_style="chip").
    ok(p.hasCaptionChip, "caption chip missing despite caption_style=chip + labels.tag");
  }
  return errs;
}

async function main() {
  const o = parseArgs();
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const browser = await puppeteer.launch({
    headless: !o.headed,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const failures: string[] = [];
  try {
    for (const presetName of o.presets) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1100, height: 900, deviceScaleFactor: 2 });
      await page.goto(`file://${FIXTURE_HTML}`);
      await page.addStyleTag({ path: o.css });
      await page.addScriptTag({ path: o.bundle });

      const spec = buildSpec(presetName);
      await page.evaluate((s) => {
        // Same mount path as measure-rows.browser.ts: fixtures.html ships a
        // minimal HTMLWidgets shim; the bundle registers the "tabviz"
        // binding against it on load.
        const w = window as unknown as {
          HTMLWidgets: {
            find: (n: string) => {
              factory: (el: HTMLElement, wd: number, ht: number) => {
                renderValue: (x: unknown) => void;
              };
            } | undefined;
          };
        };
        const binding = w.HTMLWidgets.find("tabviz");
        if (!binding) throw new Error("tabviz binding not found");
        const host = document.getElementById("widget")!;
        host.innerHTML = "";
        const inner = document.createElement("div");
        inner.style.width = "1000px";
        inner.style.height = "760px";
        host.appendChild(inner);
        binding.factory(inner, 1000, 760).renderValue(s);
      }, spec as never);

      // Let fonts/measure/settle complete.
      await new Promise((r) => setTimeout(r, 800));

      const probe = await probeShell(page);
      failures.push(...assertPreset(presetName, probe));

      const el = await page.$(".tabviz-container");
      const out = path.join(SCREENSHOT_DIR, `${presetName}.png`);
      if (el) await el.screenshot({ path: out as `${string}.png` });
      console.log(`✓ ${presetName} → ${path.relative(process.cwd(), out)}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} structural assertion(s) FAILED:`);
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log(`\nAll structural assertions passed (${o.presets.length} presets).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
