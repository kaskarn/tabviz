// Measure real per-character advance widths from a headless canvas and
// emit src/lib/font-metrics.generated.ts — the empirical replacement for
// the estimator's hand-tuned character-class magic numbers AND the magic
// mono advance.
//
// We load and measure EVERY font the curated presets ship (their real
// Google webfonts — the DOM, production browsers, and rsvg all render
// these), plus Georgia/Helvetica/Courier as offline CLASS FALLBACKS for
// unknown/custom fonts. Per-font because serif fonts differ from each
// other (Lora ≠ Spectral ≠ EB Garamond); a single serif table can't
// represent them. R's export path uses systemfonts (pixel-exact) and
// never touches the estimator — this serves the no-DOM-no-R generateSVG
// path (npm ./export, MCP, hand-JSON).
//
// advance = canvas measureText(char).width / fontSize (string width minus
// kerning — the only residual a per-glyph model leaves). Proportional
// faces get per-char tables at the anchor weights 400/700 (the estimator
// interpolates across the continuous weight axis); mono faces get a
// single measured advance (true monospace is one fixed, weight-independent
// advance). NEEDS NETWORK (Google Fonts). Re-run:
//   bun run scripts/measure-font-metrics.mjs
import puppeteer from "puppeteer";
import { writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../src/lib/font-metrics.generated.ts");
const FS = 200;

const ASCII = Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCharCode(0x20 + i));
const TYPO = [..."–—−×‰…‘’“”•·", " "];
const SUPER = [..."⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻"];
const CHARS = [...new Set([...ASCII, ...TYPO, ...SUPER])];

const gf = (fam, spec) => `https://fonts.googleapis.com/css2?family=${fam.replace(/ /g, "+")}${spec ? ":" + spec : ""}&display=swap`;

// Every preset body/display/numeric font + the offline class fallbacks.
// kind: "prop" → per-char table @400/700; "mono" → single fixed advance.
const FONTS = [
  // serif
  { family: "Lora",             kind: "prop", url: gf("Lora", "wght@400;700") },
  { family: "Spectral",         kind: "prop", url: gf("Spectral", "wght@400;700") },
  { family: "Frank Ruhl Libre", kind: "prop", url: gf("Frank Ruhl Libre", "wght@400;700") },
  { family: "EB Garamond",      kind: "prop", url: gf("EB Garamond", "wght@400;700") },
  { family: "Crimson Pro",      kind: "prop", url: gf("Crimson Pro", "wght@400;700") },
  { family: "Cinzel",           kind: "prop", url: gf("Cinzel", "wght@400;700") },
  // sans
  { family: "Outfit",           kind: "prop", url: gf("Outfit", "wght@400;700") },
  { family: "Archivo",          kind: "prop", url: gf("Archivo", "wght@400;700") },
  { family: "Archivo Black",    kind: "prop", url: gf("Archivo Black") },
  { family: "Darker Grotesque", kind: "prop", url: gf("Darker Grotesque", "wght@400;700") },
  // mono
  { family: "Space Mono",       kind: "mono", url: gf("Space Mono", "wght@400;700") },
  { family: "JetBrains Mono",   kind: "mono", url: gf("JetBrains Mono", "wght@400;700") },
  { family: "Spline Sans Mono", kind: "mono", url: gf("Spline Sans Mono", "wght@400;700") },
  { family: "IBM Plex Mono",    kind: "mono", url: gf("IBM Plex Mono", "wght@400;700") },
  // offline class fallbacks (no webfont; system faces)
  { family: "Georgia",          kind: "prop", url: null, fallbackOf: "serif" },
  { family: "Helvetica",        kind: "prop", url: null, fallbackOf: "sans" },
  { family: "Courier New",      kind: "mono", url: null, fallbackOf: "mono" },
];

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
const links = FONTS.filter((f) => f.url).map((f) => `<link rel="stylesheet" href="${f.url}">`).join("");
await page.setContent(`<!doctype html><html><head>${links}</head><body><canvas id=c></canvas></body></html>`, { waitUntil: "networkidle0" });

// Webfonts download LAZILY — a face isn't fetched until something renders
// with it, so `fonts.ready` alone leaves them all absent. Explicitly force
// each weight to download, then await.
await page.evaluate(async ({ fonts, fs }) => {
  const jobs = [];
  for (const f of fonts) {
    if (!f.url) continue;
    for (const w of [400, 700]) jobs.push(document.fonts.load(`${w} ${fs}px "${f.family}"`).catch(() => {}));
  }
  await Promise.all(jobs);
  await document.fonts.ready;
}, { fonts: FONTS, fs: FS });

const result = await page.evaluate(({ fonts, chars, fs }) => {
  const ctx = document.getElementById("c").getContext("2d");
  const out = {};
  const missing = [];
  for (const f of fonts) {
    // Verify the face actually loaded (else canvas silently falls back).
    if (f.url && !document.fonts.check(`400 ${fs}px "${f.family}"`)) { missing.push(f.family); continue; }
    const fam = `"${f.family}"`;
    if (f.kind === "mono") {
      ctx.font = `400 ${fs}px ${fam}`;
      // true monospace: every glyph shares one advance; sample a few.
      const adv = ["0", "M", "i", "w"].map((c) => ctx.measureText(c).width / fs);
      out[f.family] = { kind: "mono", advance: adv.reduce((a, b) => a + b, 0) / adv.length, fallbackOf: f.fallbackOf };
    } else {
      const t = { w400: {}, w700: {}, kind: "prop", fallbackOf: f.fallbackOf };
      for (const w of [400, 700]) {
        ctx.font = `${w} ${fs}px ${fam}`;
        const key = w === 400 ? "w400" : "w700";
        for (const ch of chars) t[key][ch] = ctx.measureText(ch).width / fs;
      }
      out[f.family] = t;
    }
  }
  return { out, missing };
}, { fonts: FONTS, chars: CHARS, fs: FS });

await browser.close();
if (result.missing.length) console.warn(`⚠ fonts that did NOT load (using class fallback): ${result.missing.join(", ")}`);

const round = (n) => Math.round(n * 1000) / 1000;
const mean = (obj, set) => { const v = set.map((c) => obj[c]).filter((x) => x != null); return v.reduce((a, b) => a + b, 0) / v.length; };
const LOWER = [..."abcdefghijklmnopqrstuvwxyz"];

// Build the generated module: one PROP_FONTS map (family → {w400,w700}),
// one MONO_ADVANCE map (family → advance), and the class-fallback keys.
const propEntries = [];
const monoEntries = [];
let fallback = {};
for (const f of FONTS) {
  const m = result.out[f.family];
  if (!m) continue;
  if (m.kind === "mono") {
    monoEntries.push(`  ${JSON.stringify(f.family)}: ${round(m.advance)},`);
    if (f.fallbackOf === "mono") fallback.mono = round(m.advance);
  } else {
    const tbl = (w) => CHARS.map((ch) => `${JSON.stringify(ch)}:${round(m[w][ch])}`).join(",");
    propEntries.push(`  ${JSON.stringify(f.family)}: { w400: {${tbl("w400")}}, w700: {${tbl("w700")}} },`);
    if (f.fallbackOf === "serif") fallback.serif = f.family;
    if (f.fallbackOf === "sans") fallback.sans = f.family;
    if (f.fallbackOf === "serif") fallback.serifDef = { d400: round(mean(m.w400, LOWER)), d700: round(mean(m.w700, LOWER)) };
    if (f.fallbackOf === "sans") fallback.sansDef = { d400: round(mean(m.w400, LOWER)), d700: round(mean(m.w700, LOWER)) };
  }
}

const body = `// Generated by \`bun run scripts/measure-font-metrics.mjs\` — do not edit.
// Real per-character advance widths (fraction of font size) measured from
// a canvas with the actual webfonts loaded, at anchor weights 400/700 for
// every preset face, plus Georgia/Helvetica/Courier offline class
// fallbacks. The estimator (width-utils.ts) resolves a family to its table
// and interpolates per glyph across the weight axis. This replaced the
// hand-tuned character-class multipliers + the magic mono advance + the
// magic weight coefficient. Re-measure via the script; never hand-edit.

export interface PropAdvances { w400: Readonly<Record<string, number>>; w700: Readonly<Record<string, number>>; }

/** Per-proportional-font advance tables, keyed by primary family name. */
export const PROP_FONTS: Readonly<Record<string, PropAdvances>> = {
${propEntries.join("\n")}
};

/** Per-monospace-font fixed advance (weight-independent), keyed by family. */
export const MONO_ADVANCE_BY_FONT: Readonly<Record<string, number>> = {
${monoEntries.join("\n")}
};

/** Class fallbacks for unknown/custom families (system faces). */
export const FALLBACK = {
  serif: ${JSON.stringify(fallback.serif)},
  sans: ${JSON.stringify(fallback.sans)},
  serifDefault: { w400: ${fallback.serifDef.d400}, w700: ${fallback.serifDef.d700} },
  sansDefault: { w400: ${fallback.sansDef.d400}, w700: ${fallback.sansDef.d700} },
  monoAdvance: ${fallback.mono},
} as const;

export const FONT_METRIC_WEIGHTS = { lo: 400, hi: 700 } as const;
`;

writeFileSync(OUT, body);
const nProp = propEntries.length, nMono = monoEntries.length;
console.log(`Wrote ${OUT} — ${nProp} proportional fonts (×2 weights × ${CHARS.length} glyphs) + ${nMono} mono fonts`);
