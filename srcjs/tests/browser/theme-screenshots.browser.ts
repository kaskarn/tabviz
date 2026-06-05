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
 * Assertions (exit non-zero on failure):
 *   - every preset: `.tabviz-scope .tv-shell > .tv-paper > .tabviz-scalable`
 *     DOM chain exists; scope carries the full data-attribute set.
 *   - flush presets (cochrane): shell is geometrically INERT — zero
 *     padding, transparent background (the Pass-1a visual no-op gate).
 *   - raised presets (nature): shell has the 8px band + visible bg, and
 *     a pinned texture paints on the SHELL (background-image set).
 *   - float+texture presets (synthwave): texture falls through to the
 *     PAPER; glow_intensity pins put `.tv-glow` on the shell with a
 *     non-none box-shadow.
 *   - flush+texture presets (brutalist): grid texture on the paper.
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
const DEFAULT_PRESETS = ["cochrane", "nature", "synthwave", "brutalist", "dark"];

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
  const inputs = PRESETS[presetName];
  if (!inputs) throw new Error(`unknown preset: ${presetName}`);
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
  });
}

interface ShellProbe {
  hasChain: boolean;
  scopeAttrs: Record<string, string | null>;
  shellPadding: string;
  shellBg: string;
  shellBoxShadow: string;
  shellBgImage: string;
  paperBgImage: string;
  hasStrip: boolean;
}

async function probeShell(page: Page): Promise<ShellProbe> {
  return page.evaluate(() => {
    const scope = document.querySelector(".tabviz-container.tabviz-scope");
    const shell = scope?.querySelector(":scope > .tv-shell") ?? null;
    const paper = shell?.querySelector(":scope > .tv-paper") ?? null;
    const scalable = paper?.querySelector(":scope > .tabviz-scalable") ?? null;
    const cs = shell ? getComputedStyle(shell) : null;
    const ps = paper ? getComputedStyle(paper) : null;
    return {
      hasChain: !!(scope && shell && paper && scalable),
      scopeAttrs: {
        shellMode: scope?.getAttribute("data-shell-mode") ?? null,
        shellTexture: scope?.getAttribute("data-shell-texture") ?? null,
        paperTexture: scope?.getAttribute("data-paper-texture") ?? null,
        mode: scope?.getAttribute("data-mode") ?? null,
        polarity: scope?.getAttribute("data-polarity") ?? null,
        density: scope?.getAttribute("data-density") ?? null,
      },
      shellPadding: cs?.padding ?? "",
      shellBg: cs?.backgroundColor ?? "",
      shellBoxShadow: cs?.boxShadow ?? "",
      shellBgImage: cs?.backgroundImage ?? "",
      paperBgImage: ps?.backgroundImage ?? "",
      hasStrip: !!shell?.querySelector(":scope > .shell-strip"),
    };
  });
}

function assertPreset(name: string, p: ShellProbe): string[] {
  const errs: string[] = [];
  const ok = (cond: boolean, msg: string) => { if (!cond) errs.push(`${name}: ${msg}`); };

  ok(p.hasChain, "scope > tv-shell > tv-paper > tabviz-scalable chain missing");
  ok(p.scopeAttrs.shellMode !== null, "data-shell-mode missing");
  ok(p.scopeAttrs.mode !== null, "data-mode missing");
  ok(p.scopeAttrs.polarity !== null, "data-polarity missing");
  ok(p.scopeAttrs.density !== null, "data-density missing");

  if (name === "cochrane") {
    // Flush archetype: the wrap must be geometrically inert.
    ok(p.scopeAttrs.shellMode === "flush", `expected flush, got ${p.scopeAttrs.shellMode}`);
    ok(p.shellPadding === "0px", `flush shell must have 0 padding, got "${p.shellPadding}"`);
    ok(/rgba\(0, 0, 0, 0\)|transparent/.test(p.shellBg), `flush shell bg must be transparent, got "${p.shellBg}"`);
  }
  if (name === "nature") {
    // Raised + ruled: 8px band; texture paints on the SHELL.
    ok(p.scopeAttrs.shellMode === "raised", `expected raised, got ${p.scopeAttrs.shellMode}`);
    ok(p.shellPadding === "8px", `raised shell must have 8px padding, got "${p.shellPadding}"`);
    ok(p.shellBgImage !== "none", "raised+ruled: shell background-image (texture) missing");
    ok(p.scopeAttrs.paperTexture === "none", "raised carries texture on shell, not paper");
  }
  if (name === "synthwave") {
    // Float + grid + neon glow: texture falls to PAPER; shell glows.
    ok(p.scopeAttrs.shellMode === "float", `expected float, got ${p.scopeAttrs.shellMode}`);
    ok(p.scopeAttrs.paperTexture === "grid", `float texture must fall to paper, got ${p.scopeAttrs.paperTexture}`);
    ok(p.paperBgImage !== "none", "float+grid: paper background-image (texture) missing");
    ok(p.shellBoxShadow !== "none", "glow_intensity pin: shell box-shadow missing (.tv-glow)");
    ok(p.scopeAttrs.polarity === "dark", `synthwave is dark, got ${p.scopeAttrs.polarity}`);
  }
  if (name === "brutalist") {
    // Flush + grid: texture falls to paper.
    ok(p.scopeAttrs.paperTexture === "grid", `flush texture must fall to paper, got ${p.scopeAttrs.paperTexture}`);
    ok(p.paperBgImage !== "none", "flush+grid: paper background-image (texture) missing");
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
