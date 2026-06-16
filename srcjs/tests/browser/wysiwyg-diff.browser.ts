/**
 * WYSIWYG diff harness — LIVE WIDGET (DOM) vs STATIC SVG EXPORT (generateSVG).
 *
 * Measures divergence between the two render paths for the SAME authored spec
 * across a matrix of shell / sizing / typography settings. Motivated by the
 * user report "shell and sizing settings are fragile, do not translate well.
 * Typography also inconsistent."
 *
 * Per matrix case (theme × density × density_factor × shell_mode):
 *   A. DOM   — mounts the real htmlwidget bundle in Chromium at nominal width
 *              800, forces autoFit OFF via the store registry so actualScale
 *              is EXACTLY 1 (verified via the container's data-zoom attr),
 *              waits for the measure loop to settle, then reads geometry
 *              (shell/paper/scalable boxes, shell padding, paper mat, header
 *              band, row heights/pitch, column x/width) and computed
 *              typography (title/subtitle/caption/footnote/header/cell/
 *              group-header font size/weight/family).
 *   B. EXPORT — generateSVG(spec, { width: 800 }) in-process (the production
 *              V8 estimator path: no Canvas) + computeLayoutMetrics() for the
 *              authoritative export-side geometry; the SVG string is parsed
 *              for <text> font attrs (matched by unique probe strings) and
 *              the root width/height.
 *
 * Emits a per-case findings list (geometry tolerance 1.5px; typography exact)
 * and writes side-by-side PNGs to /tmp/wysiwyg/<case>-dom.png / <case>-svg.png
 * plus the full machine-readable report to /tmp/wysiwyg/report.json.
 *
 * DECLARED BOUNDARY (1.0 strategy): browser-only effects — glass, glow,
 * blobs — are frozen as browser-additive and are NOT flagged here. Shell
 * PADDING / paper mat / band GEOMETRY, banding, and typography SHOULD
 * translate and ARE flagged.
 *
 * Run (after `cd srcjs && npm run build`):
 *   cd srcjs && bun run tests/browser/wysiwyg-diff.browser.ts
 *   bun run tests/browser/wysiwyg-diff.browser.ts --case nejm-raised --headed
 *
 * Registered in tests/browser/README.md.
 */

import puppeteer, { type Page, type Browser } from "puppeteer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { buildTheme } from "../../src/lib/theme/theme-adapter";
import { PRESETS } from "../../src/lib/theme/theme-presets-inputs";
import type { ThemeInputs } from "../../src/types/theme-inputs";
import { tabviz } from "../../src/authoring/tabviz";
import { colText, colNumeric, colPvalue, colBar } from "../../src/authoring/columns";
import { vizForest } from "../../src/authoring/viz";
import { generateSVG, computeLayoutMetrics, type LayoutMetrics } from "../../src/export/svg-generator";
import { bootBuiltinBehaviors } from "../../src/schema/init";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_HTML = path.join(__dirname, "fixtures.html");
const DEFAULT_BUNDLE = path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.js");
const DEFAULT_CSS = path.resolve(__dirname, "../../../inst/htmlwidgets/tabviz.css");
const OUT_DIR = "/tmp/wysiwyg";
const NOMINAL_WIDTH = 800;
const GEOM_TOL = 1.5; // px
const FONT_TOL = 0.1; // px (font sizes compared near-exactly)

// ── CLI ─────────────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const o = { bundle: DEFAULT_BUNDLE, css: DEFAULT_CSS, headed: false, only: null as string | null, gate: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--bundle") o.bundle = path.resolve(args[++i]!);
    else if (a === "--css") o.css = path.resolve(args[++i]!);
    else if (a === "--headed") o.headed = true;
    else if (a === "--case") o.only = args[++i]!;
    else if (a === "--gate") o.gate = true;
  }
  return o;
}

// ── Gate mode (roadmap M0-A: the budgeted WYSIWYG CI gate) ─────────────────
// WYSIWYG is a CONTRACT: only the divergences declared here may exist, each
// with a budget and a pointer to why (decision-register IDs or the declared
// browser-only effects boundary). Anything else — any new finding, or a
// declared one beyond its budget — fails the gate. Tighten budgets as the
// underlying items are fixed; NEVER widen one to make CI pass without a
// register decision.
const GATE_EXCEPTIONS: Array<{ pattern: RegExp; maxAbs: number; why: string }> = [
  // D32 (2026-06-16) — the harness exercises the FROM-SCRATCH export flex
  // distribution (no providedWidths). Production WYSIWYG PINS the widget's
  // measured widths (D20 item 4) and is UNAFFECTED; only the no-browser R/knit
  // path flexes from scratch, where slack distributes differently than the
  // browser's grid for high-weight flex columns (bar weight 3, forest). The
  // component-cell natural-width fix (ba165fd3) grew the fixture past the 800
  // nominal, pushing the flex columns into the content>container regime that
  // 800 coincidentally hid (they matched at 800). The fix is unifying the two
  // flex implementations (D32: the DOM store has its own width path; the export
  // uses resolveFlexWidths). Until then: the from-scratch flex WIDTHS + the
  // xOffset cascade they induce (xOffset is cumulative-rel-label, so every
  // column after a flex column inherits its mis-size) are budgeted. MUST stay
  // ahead of the general column rule below (first-match wins).
  { pattern: /^geometry :: column\[(bar_share|forest_hr)\]\.width/, maxAbs: 450, why: "D32 from-scratch flex distribution (production pins widget widths — unaffected)" },
  { pattern: /^geometry :: column\[[^\]]+\]\.xOffset/, maxAbs: 500, why: "D32 from-scratch flex xOffset cascade (cumulative rel-label offset inherits the flex width divergence; per-column WIDTHS still gated at 65 by the rule below)" },
  // D8 — estimator-vs-canvas text measurement on raw generateSVG (real
  // flows are protected by systemfonts injection / live widths).
  { pattern: /^geometry :: column\[/, maxAbs: 65, why: "D8 estimator column widths" },
  { pattern: /^geometry :: content\.width/, maxAbs: 65, why: "D8 estimator widths (sum)" },
  { pattern: /^chrome :: artifact\.width/, maxAbs: 60, why: "D8 flow-through + scalable rounding + D32 from-scratch flex total residual (22→60 on 2026-06-16: the wysiwyg DOM now mounts at the export's resulting width so total widths compare apples-to-apples — this dropped the raw artifact Δ from ~433 to ~56; the ~56 residual is the from-scratch flex redistribution on the total, D32)" },
  // Vertical residuals: DOM measure-then-commit grows wrapped/edge rows the
  // estimator can't see; bounded small.
  { pattern: /^(geometry :: figure\.height|chrome :: artifact\.height)/, maxAbs: 11, why: "measure-loop growth residual (10→11 on 2026-06-11: D15's caption fix UNMASKED ~0.7px previously hidden inside the inflated caption reserve on textured themes — register D15 note; the residual itself is the measure-loop's, tracked there)" },
  { pattern: /^geometry :: headerBand\.top/, maxAbs: 3, why: "D15 RESOLVED 2026-06-11 (was 8): caption model exact; +2 nejm-family residual remains" },
  // D15 INSTRUMENTATION readings (2026-06-11) — these two metrics exist to
  // decompose headerBand.top per term; budgets = observed max + slack.
  // First findings: title term = pure ceil() vs sub-pixel (−0.9 on the
  // nejm family); +3.4 and the subtitle's −5…−13 spread need per-case
  // attribution (likely probe-side chain assumptions on themes that pin
  // title_subtitle_gap). Tighten as the terms get fixed.
  { pattern: /^geometry :: captionTerm\.titleLineBox/, maxAbs: 1, why: "D15 instrumentation (model exact since the texture-knockout fix)" },
  { pattern: /^geometry :: captionTerm\.subtitleLineBox/, maxAbs: 1, why: "D15 instrumentation (model exact)" },
  // ATTRIBUTED (2026-06-11): the chain divergence lands EXACTLY on the
  // title_style-decorated presets (brutalist/synthwave/terminal) — their
  // caption chrome (stripe/chip) alters the border/padding chain above
  // the subtitle; the export models the PLAIN chain only. The fix is a
  // per-title_style chain table in the export's caption block.
  { pattern: /^geometry :: captionTerm\.subtitleChain/, maxAbs: 1, why: "D15 instrumentation (model exact)" },
  { pattern: /^geometry :: captionTerm\.titleBox/, maxAbs: 1, why: "D15 instrumentation (model exact)" },
  { pattern: /^geometry :: row\[/, maxAbs: 4, why: "measure-loop growth residual (per-row)" },
  { pattern: /^geometry :: rowPitch/, maxAbs: 4, why: "measure-loop growth residual" },
];

function gateVerdict(findings: Finding[]): { breaches: Finding[]; excepted: number } {
  const breaches: Finding[] = [];
  let excepted = 0;
  for (const f of findings) {
    const key = `${f.category} :: ${f.property}`;
    const exc = GATE_EXCEPTIONS.find((e) => e.pattern.test(key));
    if (exc && f.delta != null && Math.abs(f.delta) <= exc.maxAbs) {
      excepted++;
      continue;
    }
    breaches.push(f);
  }
  return { breaches, excepted };
}

// ── Matrix ──────────────────────────────────────────────────────────────────
interface MatrixCase {
  id: string;
  preset: string; // key into PRESETS
  patch?: Partial<ThemeInputs>;
}

const CASES: MatrixCase[] = [
  // nejm: flush serif journal, type_scale_ratio 1.25 — typography stressor
  { id: "nejm",             preset: "nejm" },
  { id: "nejm-compact",     preset: "nejm", patch: { density: "compact" } },
  { id: "nejm-df13",        preset: "nejm", patch: { density_factor: 1.3 } },
  { id: "nejm-raised",      preset: "nejm", patch: { shell_mode: "raised" } },
  { id: "nejm-raised-df13", preset: "nejm", patch: { shell_mode: "raised", density_factor: 1.3 } },
  // brutalist: flush + compact + grid texture + density_factor 0.88
  { id: "brutalist",        preset: "brutalist" },
  { id: "brutalist-raised", preset: "brutalist", patch: { shell_mode: "raised" } },
  // synthwave: float shell + glow + dark — chrome stressor
  { id: "synthwave",        preset: "synthwave" },
  { id: "synthwave-df13",   preset: "synthwave", patch: { density_factor: 1.3 } },
  // terminal: dark mono compact, type_base_size 13
  { id: "terminal",         preset: "terminal" },
  { id: "terminal-raised",  preset: "terminal", patch: { shell_mode: "raised" } },
  // newsprint: grain texture, density_factor 0.95
  { id: "newsprint",        preset: "newsprint" },
  // Full 9-preset coverage (area G battery, 2026-06-11): the three
  // presets the matrix lacked.
  { id: "ledger",           preset: "ledger" },
  { id: "aurora",           preset: "aurora" },
  { id: "dwarven",          preset: "dwarven" },
  // D26 (2026-06-13): boxed = full grid (row + column dividers + outer
  // frame). Exercises the table-frame parity — the DOM frame is a
  // box-shadow grid-overlay stopping above the axis; the export rect spans
  // mainY → rowsY+rowsHeight. Geometry must stay in lockstep under the grid
  // layout (internal verticals + the 4-side frame).
  { id: "nejm-boxed",       preset: "nejm", patch: { border_preset: "boxed" } },
];

// ── Fixture spec (authoring path, canonical theme resolution) ───────────────
// Probe strings are UNIQUE so SVG <text> elements can be matched by content.
const T = {
  title: "WYSIWYG Title Probe",
  subtitle: "Subtitle probe line",
  caption: "Caption probe text",
  footnote: "Footnote probe text",
  headerDrug: "Drug Probe",
  headerN: "Enrolled",
  headerForest: "Forest Probe",
  cell: "Metoprolol",
  group: "Cohort Alpha",
};

const ROWS = [
  { study: "Anderson 2020", drug: "Metoprolol", cohort: "Cohort Alpha", n: 245, hr: 0.72, lo: 0.58, hi: 0.89, p: 0.004, share: 0.82 },
  { study: "Baker 2021",    drug: "Lisinopril", cohort: "Cohort Alpha", n: 189, hr: 0.81, lo: 0.65, hi: 1.01, p: 0.21, share: 0.41 },
  { study: "Chen 2019",     drug: "Amlodipine", cohort: "Cohort Alpha", n: 312, hr: 0.66, lo: 0.50, hi: 0.86, p: 0.012, share: 0.63 },
  { study: "Davis 2022",    drug: "Valsartan",  cohort: "Cohort Beta",  n: 278, hr: 0.74, lo: 0.59, hi: 0.93, p: 0.03, share: 0.95 },
  { study: "Evans 2023",    drug: "Carvedilol", cohort: "Cohort Beta",  n: 478, hr: 0.91, lo: 0.78, hi: 1.06, p: 0.18, share: 0.27 },
  { study: "Foster 2024",   drug: "Ramipril",   cohort: "Cohort Beta",  n: 156, hr: 0.65, lo: 0.49, hi: 0.85, p: 0.002, share: 0.7 },
];

function buildSpec(c: MatrixCase) {
  const base = PRESETS[c.preset];
  if (!base) throw new Error(`unknown preset ${c.preset}`);
  const inputs: ThemeInputs = { ...base, ...(c.patch ?? {}) };
  return tabviz({
    data: ROWS,
    label: "study",
    group: "cohort",
    columns: [
      colText({ field: "drug", header: T.headerDrug }),
      colNumeric({ field: "n", header: T.headerN, decimals: 0 }),
      vizForest({ point: "hr", lower: "lo", upper: "hi", axisLabel: "Hazard ratio", header: T.headerForest }),
      // pvalue + bar joined 2026-06-11: the V8 boot-split bug (six types
      // silently exporting as plain text) lived for months because the
      // matrix fixture exercised NONE of them. These two cover the class.
      colPvalue({ field: "p", header: "P" }),
      colBar({ field: "share", header: "Share" }),
    ],
    theme: buildTheme(inputs, c.preset),
    title: T.title,
    subtitle: T.subtitle,
    caption: T.caption,
    footnote: T.footnote,
  });
}

// ── SVG parsing ─────────────────────────────────────────────────────────────
interface SvgText {
  content: string;
  x: number; y: number;
  fontSize: number | null;
  fontFamily: string | null;
  fontWeight: string | null;
}

function decodeXml(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function parseSvg(svg: string) {
  const rootM = svg.match(/<svg\b[^>]*?\bwidth="([\d.]+)"[^>]*?\bheight="([\d.]+)"/s);
  const texts: SvgText[] = [];
  // Cell texts are emitted inside a <g> carrying font attrs (schema render
  // path), so walk the tag stream maintaining a <g>-attr stack and resolve
  // font attrs by inheritance.
  const attrOf = (attrs: string, n: string): string | null => {
    const r = attrs.match(new RegExp(`(?:^|\\s)${n}="([^"]*)"`));
    return r ? r[1]! : null;
  };
  const gStack: Array<{ ff: string | null; fs: string | null; fw: string | null }> = [];
  const inherited = (n: "ff" | "fs" | "fw"): string | null => {
    for (let i = gStack.length - 1; i >= 0; i--) {
      if (gStack[i]![n] != null) return gStack[i]![n];
    }
    return null;
  };
  const tagRe = /<g\b([^>]*?)(\/?)>|<\/g>|<text\b([^>]*?)>([\s\S]*?)<\/text>/g;
  for (const m of svg.matchAll(tagRe)) {
    if (m[0].startsWith("<g")) {
      if (m[2] === "/") continue; // self-closing g
      const a = m[1] ?? "";
      gStack.push({ ff: attrOf(a, "font-family"), fs: attrOf(a, "font-size"), fw: attrOf(a, "font-weight") });
    } else if (m[0] === "</g>") {
      gStack.pop();
    } else {
      const attrs = m[3] ?? "";
      const inner = (m[4] ?? "").replace(/<[^>]+>/g, " "); // strip tspans
      const fsAttr = attrOf(attrs, "font-size") ?? inherited("fs");
      texts.push({
        content: decodeXml(inner.replace(/\s+/g, " ").trim()),
        x: parseFloat(attrOf(attrs, "x") ?? "NaN"),
        y: parseFloat(attrOf(attrs, "y") ?? "NaN"),
        fontSize: fsAttr ? parseFloat(fsAttr) : null,
        fontFamily: attrOf(attrs, "font-family") ?? inherited("ff"),
        fontWeight: attrOf(attrs, "font-weight") ?? inherited("fw"),
      });
    }
  }
  return {
    width: rootM ? parseFloat(rootM[1]!) : NaN,
    height: rootM ? parseFloat(rootM[2]!) : NaN,
    texts,
  };
}

function findText(texts: SvgText[], content: string): SvgText | null {
  return texts.find((t) => t.content === content) ?? null;
}

// Header lookup that tolerates ELLIPSIS TRUNCATION. The export truncates a
// header (e.g. "Drug Probe" → "Drug Pro…") when its column is narrower than the
// text — pronounced under the from-scratch flex's tighter columns for wide
// faces like dwarven's EB Garamond (D32). The truncated run carries the SAME
// font attrs, so matching a prefix keeps typography measurable; the truncation
// itself (a width consequence) is covered by the D32 column-width budget.
function findHeaderText(texts: SvgText[], header: string): SvgText | null {
  const exact = texts.find((t) => t.content === header);
  if (exact) return exact;
  return texts.find((t) => {
    const c = t.content.replace(/[….]+$/, "");
    return c.length >= 2 && header.startsWith(c);
  }) ?? null;
}

// ── DOM probe (runs inside the page) ────────────────────────────────────────
interface FontProbe { size: number; weight: string; family: string }
interface DomProbe {
  error?: string;
  dataZoom: string | null;
  attrs: Record<string, string | null>;
  shell: { w: number; h: number };
  scalable: { w: number; h: number };
  paper: { w: number; h: number };
  main: { w: number; h: number };
  shellPadding: { top: number; left: number };
  paperPadding: { top: number; left: number };
  captionBlockH: number; // .tv-caption height (title+subtitle block on shell)
  headerBand: { topInScalable: number; topInMain: number; h: number } | null;
  groupLabelX: number | null;
  captionTerms: { areaH: number; padTop: number; padBottom: number;
                  titleH: number | null; subtitleH: number | null;
                  subtitleChain: number | null } | null;
  // primary-cell data rows in document order: top relative to main, height
  dataRows: Array<{ id: string; top: number; h: number }>;
  groupRows: Array<{ top: number; h: number }>;
  columns: Record<string, { x: number; w: number }>; // header cells, x rel. to main
  fonts: Partial<Record<"title" | "subtitle" | "caption" | "footnote" | "header" | "cell" | "group", FontProbe>>;
  footerH: number;
  cssVars: Record<string, string>;
}

const DOM_PROBE_FN = `(() => {
  const $ = (s) => document.querySelector(s);
  const container = $(".tabviz-container");
  const shell = $(".tv-shell");
  const scalable = $(".tabviz-scalable");
  const paper = $(".tv-paper");
  const main = $(".tabviz-main");
  if (!container || !shell || !scalable || !paper || !main) {
    return { error: "missing chain: " + [container, shell, scalable, paper, main].map(Boolean).join(",") };
  }
  const R = (el) => el.getBoundingClientRect();
  const sr = R(scalable), mr = R(main), shr = R(shell), pr = R(paper);
  const font = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { size: parseFloat(cs.fontSize), weight: cs.fontWeight, family: cs.fontFamily };
  };
  const shCs = getComputedStyle(shell);
  const pCs = getComputedStyle(paper);

  // Header cells by data-header-id.
  const columns = {};
  let headerBand = null;
  // D10 probe (2026-06-11): the group-header LABEL x within the main
  // grid — the DOM shifts it right of the cell start by the chevron
  // (12px + 6px gap); the export draws at cellPad + indent only.
  let groupLabelX = null;
  for (const el of document.querySelectorAll(".header-cell[data-header-id]")) {
    const id = el.getAttribute("data-header-id");
    const b = R(el);
    columns[id] = { x: b.left - mr.left, w: b.width };
    if (!headerBand || b.height > headerBand.h) {
      headerBand = { topInScalable: b.top - sr.top, topInMain: b.top - mr.top, h: b.height };
    }
  }

  // Data rows (primary cells carry data-row-id; group-header primaries don't).
  const dataRows = [];
  for (const el of document.querySelectorAll(".grid-cell.primary-cell[data-row-id]")) {
    const b = R(el);
    dataRows.push({ id: el.getAttribute("data-row-id"), top: b.top - mr.top, h: b.height });
  }
  dataRows.sort((a, b) => a.top - b.top);
  {
    const gl = document.querySelector(".primary-cell.group-row .group-label");
    if (gl) groupLabelX = R(gl).left - mr.left;
  }
  // D15 instrumentation (2026-06-11): per-term caption-block boxes so the
  // headerBand.top delta decomposes — title/subtitle LINE BOXES vs the
  // export's ceil(size × lineHeight) model, computed case-by-case.
  let captionTerms = null;
  {
    const ha = document.querySelector(".header-area");
    const tEl = document.querySelector(".plot-title");
    const sEl = document.querySelector(".plot-subtitle");
    if (ha) {
      const haCs = getComputedStyle(ha);
      const sCs = sEl ? getComputedStyle(sEl) : null;
      captionTerms = {
        areaH: R(ha).height,
        padTop: parseFloat(haCs.paddingTop),
        padBottom: parseFloat(haCs.paddingBottom),
        titleH: tEl ? R(tEl).height : null,
        subtitleH: sEl ? R(sEl).height : null,
        // The REAL chain above the subtitle line box — measured, not
        // assumed (themes pin title_subtitle_gap; the var+fallback probe
        // mis-attributed −9.3px on synthwave).
        subtitleChain: sCs
          ? parseFloat(sCs.borderTopWidth || "0") + parseFloat(sCs.paddingTop || "0")
            + parseFloat(sCs.marginTop || "0")
          : null,
      };
    }
  }
  const groupRows = [];
  for (const el of document.querySelectorAll(".grid-cell.primary-cell.group-row")) {
    const b = R(el);
    groupRows.push({ top: b.top - mr.top, h: b.height });
  }
  groupRows.sort((a, b) => a.top - b.top);

  const caption = $(".tv-caption");
  const footer = $(".plot-footer") || $(".tv-footer");
  const captionEl = $(".plot-caption");
  const footnoteEl = $(".plot-footnote");

  // Cell + group-header typography probes.
  const drugCell = document.querySelector('.grid-cell.data-cell[data-field="drug"]:not(.group-row)');
  const drugLeaf = drugCell ? (drugCell.querySelector(".cell-value") || drugCell.querySelector(".cell-content") || drugCell) : null;
  const groupLabel = document.querySelector(".primary-cell.group-row .group-label");
  // Header probe: the header cell whose text is the drug-column probe string.
  let headerText = null;
  for (const el of document.querySelectorAll(".header-cell[data-header-id]")) {
    if (el.textContent.trim() === "Drug Probe") {
      headerText = el.querySelector(".header-text") || el;
      break;
    }
  }

  const varNames = ["--tv-spacing-row-height", "--tv-spacing-header-height",
    "--tv-shell-padding", "--tv-text-title-size", "--tv-text-subtitle-size",
    "--tv-text-body-size", "--tv-text-label-size", "--tv-spacing-padding",
    "--tv-spacing-header-gap", "--tv-spacing-title-subtitle-gap"];
  const ccs = getComputedStyle(container);
  const cssVars = {};
  for (const v of varNames) cssVars[v] = ccs.getPropertyValue(v).trim();

  return {
    dataZoom: container.getAttribute("data-zoom"),
    attrs: {
      shellMode: container.getAttribute("data-shell-mode"),
      density: container.getAttribute("data-density"),
      polarity: container.getAttribute("data-polarity"),
    },
    shell: { w: shr.width, h: shr.height },
    scalable: { w: sr.width, h: sr.height },
    paper: { w: pr.width, h: pr.height },
    main: { w: mr.width, h: mr.height },
    shellPadding: { top: parseFloat(shCs.paddingTop), left: parseFloat(shCs.paddingLeft) },
    paperPadding: { top: parseFloat(pCs.paddingTop), left: parseFloat(pCs.paddingLeft) },
    captionBlockH: caption ? R(caption).height : 0,
    headerBand,
    groupLabelX,
    captionTerms,
    dataRows,
    groupRows,
    columns,
    fonts: {
      title: font($(".plot-title")),
      subtitle: font($(".plot-subtitle")),
      caption: font(captionEl),
      footnote: font(footnoteEl),
      header: font(headerText),
      cell: font(drugLeaf),
      group: font(groupLabel),
    },
    footerH: footer ? R(footer).height : 0,
    cssVars,
  };
})()`;

// ── Helpers ─────────────────────────────────────────────────────────────────
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms: ${label}`)), ms)),
  ]);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function famToken(f: string | null | undefined): string {
  if (!f) return "(none)";
  return f.split(",")[0]!.trim().replace(/^['"]|['"]$/g, "").toLowerCase();
}

// ── Findings model ──────────────────────────────────────────────────────────
type Category = "geometry" | "typography" | "chrome";
interface Finding {
  caseId: string;
  category: Category;
  property: string;
  dom: string | number | null;
  svg: string | number | null;
  delta: number | null;
  note?: string;
}

function cmpNum(
  findings: Finding[], caseId: string, category: Category, property: string,
  dom: number | null | undefined, svg: number | null | undefined,
  tol: number, note?: string,
) {
  if (dom == null || svg == null || Number.isNaN(dom) || Number.isNaN(svg)) {
    findings.push({ caseId, category, property, dom: dom ?? null, svg: svg ?? null, delta: null, note: `${note ? note + "; " : ""}MISSING on one side` });
    return;
  }
  const d = dom - svg;
  if (Math.abs(d) > tol) {
    findings.push({ caseId, category, property, dom: Math.round(dom * 10) / 10, svg: Math.round(svg * 10) / 10, delta: Math.round(d * 10) / 10, note });
  }
}

function cmpStr(
  findings: Finding[], caseId: string, category: Category, property: string,
  dom: string | null | undefined, svg: string | null | undefined, note?: string,
) {
  if ((dom ?? "(none)") !== (svg ?? "(none)")) {
    findings.push({ caseId, category, property, dom: dom ?? null, svg: svg ?? null, delta: null, note });
  }
}

// ── Per-case runner ─────────────────────────────────────────────────────────
async function runCase(browser: Browser, opts: ReturnType<typeof parseArgs>, c: MatrixCase) {
  const findings: Finding[] = [];
  const caseId = c.id;

  // EXPORT side (in-process; production V8 estimator path).
  const svgStr = generateSVG(buildSpec(c) as never, { width: NOMINAL_WIDTH });
  const metrics: LayoutMetrics = computeLayoutMetrics(buildSpec(c) as never, { width: NOMINAL_WIDTH });
  const svg = parseSvg(svgStr);

  // Mount the DOM at the EXPORT's resulting artifact width, NOT a fixed 800.
  // The export honors `width` as an AT-LEAST floor (v0.30 contract): when the
  // content's natural width exceeds it, the export GROWS the artifact rather
  // than clipping. The DOM at a fixed 800 container instead flex-COMPRESSES to
  // fit — so a fixture whose Σ-naturals exceeds 800 is compared at two
  // DIFFERENT total widths (DOM=800 vs export=natural), and every flex column +
  // the artifact width diverge spuriously. Mounting the DOM at the export's own
  // width restores an apples-to-apples WYSIWYG comparison (both at natural).
  const mountWidth = Math.max(NOMINAL_WIDTH, Math.ceil(svg.width));

  // DOM side.
  const page: Page = await browser.newPage();
  let dom: DomProbe | null = null;
  let renderError: string | null = null;
  try {
    await page.setViewport({ width: 1500, height: 2200, deviceScaleFactor: 1 });
    page.on("pageerror", (e) => console.error(`[${caseId}] pageerror:`, e.message));
    await withTimeout(page.goto(`file://${FIXTURE_HTML}`, { waitUntil: "load" }), 15000, "goto");
    await page.addStyleTag({ path: opts.css });
    await page.addScriptTag({ path: opts.bundle });

    const spec = buildSpec(c);
    await withTimeout(page.evaluate((s, w) => {
      const win = window as unknown as {
        HTMLWidgets: { find: (n: string) => { factory: (el: HTMLElement, wd: number, ht: number) => { renderValue: (x: unknown) => void } } | undefined };
      };
      const binding = win.HTMLWidgets.find("tabviz");
      if (!binding) throw new Error("tabviz binding not found");
      const host = document.getElementById("widget")!;
      host.innerHTML = "";
      const inner = document.createElement("div");
      inner.id = "wysiwyg-host";
      inner.style.width = `${w}px`;
      inner.style.height = "2000px";
      host.appendChild(inner);
      binding.factory(inner, w, 2000).renderValue(s);
    }, spec as never, mountWidth), 15000, "mount");

    await sleep(500);
    // Force scale=1: autoFit off (zoom stays at its default 1).
    await withTimeout(page.evaluate(() => {
      const reg = (window as unknown as { __tabvizStoreRegistry?: Map<string, { setAutoFit: (v: boolean) => void }> }).__tabvizStoreRegistry;
      const store = reg?.get("wysiwyg-host");
      if (!store) throw new Error("store not in registry");
      store.setAutoFit(false);
    }), 8000, "setAutoFit");
    await sleep(800); // let measure loops settle

    dom = await withTimeout(page.evaluate(DOM_PROBE_FN) as Promise<DomProbe>, 10000, "probe");
    if (dom.error) throw new Error(dom.error);

    // Screenshot the shell (no hover first — toolbar is hover-revealed).
    // Screenshot flakes (captureScreenshot hangs) must not void the probe.
    // Use page.screenshot({clip}) — element.screenshot()'s scroll/capture
    // path hangs reliably in batch runs.
    try {
      const clip = await page.evaluate(() => {
        const b = document.querySelector(".tv-shell")!.getBoundingClientRect();
        return { x: Math.max(0, b.x - 2), y: Math.max(0, b.y - 2), width: Math.ceil(b.width) + 4, height: Math.ceil(b.height) + 4 };
      });
      await withTimeout(page.screenshot({ path: `${OUT_DIR}/${caseId}-dom.png` as `${string}.png`, clip, captureBeyondViewport: false }), 20000, "dom shot");
    } catch (e) {
      console.error(`[${caseId}] dom screenshot failed (non-fatal): ${e}`);
    }
  } catch (e) {
    renderError = String(e);
  } finally {
    await page.close().catch(() => {});
  }

  // SVG screenshot in a fresh page.
  try {
    const sp = await browser.newPage();
    await sp.setViewport({ width: Math.ceil(svg.width) + 20 || 900, height: Math.ceil(svg.height) + 20 || 900, deviceScaleFactor: 1 });
    await withTimeout(sp.setContent(`<!doctype html><html><body style="margin:0">${svgStr}</body></html>`), 10000, "svg page");
    const clip = await sp.evaluate(() => {
      const b = document.querySelector("svg")!.getBoundingClientRect();
      return { x: b.x, y: b.y, width: Math.ceil(b.width), height: Math.ceil(b.height) };
    });
    await withTimeout(sp.screenshot({ path: `${OUT_DIR}/${caseId}-svg.png` as `${string}.png`, clip, captureBeyondViewport: false }), 15000, "svg shot");
    await sp.close();
  } catch (e) {
    console.error(`[${caseId}] svg screenshot failed: ${e}`);
  }

  if (renderError || !dom) {
    findings.push({ caseId, category: "chrome", property: "RENDER FAILURE", dom: renderError, svg: null, delta: null });
    return { findings, dom, metrics, svg };
  }

  // ── Comparisons ───────────────────────────────────────────────────────────
  if (dom.dataZoom !== "100%") {
    findings.push({ caseId, category: "geometry", property: "actualScale-not-1", dom: dom.dataZoom, svg: "100%", delta: null, note: "comparison invalid at scale≠1" });
  }

  // Figure-level size: the export's root box corresponds to the DOM
  // .tabviz-scalable (caption + strip + paper(table) + footer). Horizontal
  // padding rides OUTSIDE the scalable in DOM (centering margin) but INSIDE
  // the SVG root, so the content (grid) width vs Σ export column widths is
  // the honest width comparison.
  const exportColSum = metrics.columns.reduce((s, col) => s + col.width, 0);
  cmpNum(findings, caseId, "geometry", "content.width (grid vs Σ export col widths)", dom.main.w, exportColSum, GEOM_TOL);
  // The svg root includes the shell band (export parity, 2026-06-10);
  // the DOM scalable sits INSIDE the band, so subtract it for the
  // figure-content comparison.
  cmpNum(findings, caseId, "geometry", "figure.height (scalable vs svg root - band)",
    dom.scalable.h, svg.height - 2 * metrics.shellPad, GEOM_TOL);

  // Shell chrome: the export now mirrors the band + mat geometry
  // (metrics.shellPad / metrics.paperPad from --tv-shell-padding /
  // --tv-paper-padding) — compare DOM pads against the export's.
  if (dom.shellPadding.left > 0.5 || metrics.shellPad > 0.5) {
    cmpNum(findings, caseId, "chrome", "shell.padding (band)", dom.shellPadding.left, metrics.shellPad, 0.5,
      `shell_mode=${dom.attrs.shellMode}`);
  }
  if (dom.paperPadding.left > 0.5 || metrics.paperPad > 0.5) {
    cmpNum(findings, caseId, "chrome", "paper.mat (inner padding)", dom.paperPadding.left, metrics.paperPad, 0.5);
  }
  cmpNum(findings, caseId, "chrome", "artifact.width (shell vs svg root)", dom.shell.w, svg.width, GEOM_TOL,
    "total visual artifact incl. shell chrome");
  cmpNum(findings, caseId, "chrome", "artifact.height (shell vs svg root)", dom.shell.h, svg.height, GEOM_TOL);

  // Title block / header band position.
  cmpNum(findings, caseId, "geometry", "headerBand.top-in-figure (vs metrics.mainY)",
    dom.headerBand?.topInScalable, metrics.mainY, GEOM_TOL,
    "distance from figure top to column-header band top (title block + gaps)");
  cmpNum(findings, caseId, "geometry", "headerBand.height", dom.headerBand?.h, metrics.headerHeight, GEOM_TOL);

  // Rows.
  const mRows = metrics.rows;
  const mData = mRows.filter((r) => r.kind === "data");
  const mGroup = mRows.filter((r) => r.kind === "group_header");
  if (dom.dataRows.length >= 2 && mData.length >= 2) {
    cmpNum(findings, caseId, "geometry", "row[0].height", dom.dataRows[0]!.h, mData[0]!.height, GEOM_TOL);
    cmpNum(findings, caseId, "geometry", "row.pitch (row1.top - row0.top)",
      dom.dataRows[1]!.top - dom.dataRows[0]!.top, mData[1]!.top - mData[0]!.top, GEOM_TOL);
  }
  // D15 decomposition: title/subtitle line boxes vs the export's
  // ceil(size × lh) model — the term-by-term view the register asked for.
  if (dom.captionTerms && metrics.captionBlock) {
    // TRUTH-TO-TRUTH (two probe artifacts taught the lesson): the DOM
    // side is MEASURED element boxes; the export side is the layout's
    // ACTUAL reserved terms — no var re-derivation on either side.
    const mb = metrics.captionBlock;
    if (dom.captionTerms.titleH != null && mb.titleHeight > 0) {
      // DOM .plot-title box = line box + its bottom pad/border chrome
      // (0.15rem plain; title_style=underline swaps in 6px+3px border).
      cmpNum(findings, caseId, "geometry", "captionTerm.titleBox",
        dom.captionTerms.titleH, mb.titleHeight, 0.75,
        "DOM .plot-title border box vs the export's reserved title term (chrome incl.)");
    }
    if (dom.captionTerms.subtitleH != null && mb.subtitleHeight > 0) {
      const chain = dom.captionTerms.subtitleChain ?? 0;
      cmpNum(findings, caseId, "geometry", "captionTerm.subtitleLineBox",
        dom.captionTerms.subtitleH - chain, mb.subtitleHeight, 0.75,
        "DOM .plot-subtitle line box (minus its MEASURED chain) vs the export's subtitle term");
      cmpNum(findings, caseId, "geometry", "captionTerm.subtitleChain",
        chain, mb.titleSubtitleGap, 0.75,
        "DOM measured border+padding+margin above the subtitle vs the export's gap term");
    }
  }

  // D10: group-label x — DOM (post-chevron) vs SVG text x.
  {
    const svgGroup = svg.texts.find((t) => (t.text || "").startsWith("Cohort"));
    if (dom.groupLabelX != null && svgGroup && typeof svgGroup.x === "number") {
      cmpNum(findings, caseId, "geometry", "groupLabel.x (chevron offset — D10)",
        dom.groupLabelX, svgGroup.x, GEOM_TOL,
        "group-header label x within the grid (DOM includes the 18px chevron+gap)");
    }
  }
  if (dom.groupRows.length >= 1 && mGroup.length >= 1) {
    cmpNum(findings, caseId, "geometry", "groupHeaderRow.height", dom.groupRows[0]!.h, mGroup[0]!.height, GEOM_TOL);
  }
  // group→group span (captures rowGroupPadding translation)
  if (dom.groupRows.length >= 2 && mGroup.length >= 2) {
    cmpNum(findings, caseId, "geometry", "groupBlock.span (group2.top - group1.top)",
      dom.groupRows[1]!.top - dom.groupRows[0]!.top, mGroup[1]!.top - mGroup[0]!.top, GEOM_TOL);
  }

  // Columns: width per id + x offsets from the label column.
  const mCols = new Map(metrics.columns.map((col) => [col.id, col]));
  const domLabelX = dom.columns["label"]?.x;
  const mLabelX = mCols.get("label")?.x;
  for (const [id, dc] of Object.entries(dom.columns)) {
    const mc = mCols.get(id);
    if (!mc) {
      findings.push({ caseId, category: "geometry", property: `column[${id}].width`, dom: dc.w, svg: null, delta: null, note: "column missing in export metrics" });
      continue;
    }
    cmpNum(findings, caseId, "geometry", `column[${id}].width`, dc.w, mc.width, GEOM_TOL);
    if (domLabelX != null && mLabelX != null) {
      cmpNum(findings, caseId, "geometry", `column[${id}].xOffset (rel. label col)`, dc.x - domLabelX, mc.x - mLabelX, GEOM_TOL);
    }
  }

  // Typography.
  const tyPairs: Array<[string, FontProbe | undefined | null, SvgText | null]> = [
    ["title", dom.fonts.title, findText(svg.texts, T.title)],
    ["subtitle", dom.fonts.subtitle, findText(svg.texts, T.subtitle)],
    ["caption", dom.fonts.caption, findText(svg.texts, T.caption)],
    ["footnote", dom.fonts.footnote, findText(svg.texts, T.footnote)],
    ["header", dom.fonts.header, findHeaderText(svg.texts, T.headerDrug)],
    ["cell", dom.fonts.cell, findText(svg.texts, T.cell)],
    ["groupHeader", dom.fonts.group, findText(svg.texts, T.group)],
  ];
  for (const [name, df, st] of tyPairs) {
    if (!df && !st) continue;
    cmpNum(findings, caseId, "typography", `${name}.fontSize`, df?.size, st?.fontSize, FONT_TOL);
    cmpStr(findings, caseId, "typography", `${name}.fontWeight`, df?.weight ?? null, st?.fontWeight ?? null);
    cmpStr(findings, caseId, "typography", `${name}.fontFamily`, famToken(df?.family), famToken(st?.fontFamily));
  }

  return { findings, dom, metrics, svg };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  bootBuiltinBehaviors();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const opts = parseArgs();
  const cases = opts.only ? CASES.filter((c) => c.id === opts.only) : CASES;
  if (cases.length === 0) throw new Error(`no case matches --case ${opts.only}`);

  // headless "shell" (chrome-headless-shell): on this dev box the NEW
  // headless mode's Page.captureScreenshot hangs to protocolTimeout (even on
  // a trivial page), while the shell rasters in ~0.5s. Same Blink engine, so
  // computed styles/layout are identical for our probes.
  const browser = await puppeteer.launch({
    headless: opts.headed ? false : ("shell" as never),
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--force-device-scale-factor=1"],
  });

  const allFindings: Finding[] = [];
  const rawByCase: Record<string, unknown> = {};
  try {
    for (const c of cases) {
      process.stderr.write(`── case ${c.id} …\n`);
      try {
        const r = await runCase(browser, opts, c);
        allFindings.push(...r.findings);
        rawByCase[c.id] = { dom: r.dom, metrics: r.metrics, svgRoot: { w: r.svg.width, h: r.svg.height } };
        console.log(`\n=== ${c.id} — ${r.findings.length} divergences ===`);
        for (const f of r.findings) {
          console.log(`  [${f.category}] ${f.property}: DOM=${f.dom} SVG=${f.svg}` +
            (f.delta != null ? ` Δ=${f.delta}` : "") + (f.note ? `  (${f.note})` : ""));
        }
      } catch (e) {
        console.error(`case ${c.id} FAILED: ${e}`);
        allFindings.push({ caseId: c.id, category: "chrome", property: "CASE FAILURE", dom: String(e), svg: null, delta: null });
      }
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(`${OUT_DIR}/report.json`, JSON.stringify({ findings: allFindings, raw: rawByCase }, null, 2));

  // Aggregate: property → cases affected, max |delta|.
  const agg = new Map<string, { cases: string[]; maxAbs: number; category: Category }>();
  for (const f of allFindings) {
    const key = `${f.category} :: ${f.property}`;
    const a = agg.get(key) ?? { cases: [], maxAbs: 0, category: f.category };
    a.cases.push(f.caseId + (f.delta != null ? `(Δ${f.delta})` : ""));
    if (f.delta != null) a.maxAbs = Math.max(a.maxAbs, Math.abs(f.delta));
    agg.set(key, a);
  }
  console.log(`\n\n════ AGGREGATE (${allFindings.length} findings; PNGs + report.json in ${OUT_DIR}) ════`);
  const sorted = [...agg.entries()].sort((a, b) => b[1].cases.length - a[1].cases.length || b[1].maxAbs - a[1].maxAbs);
  for (const [key, a] of sorted) {
    console.log(`\n${key}  — ${a.cases.length} case(s), max|Δ|=${a.maxAbs}`);
    console.log(`   ${a.cases.join(", ")}`);
  }

  if (opts.gate) {
    const { breaches, excepted } = gateVerdict(allFindings);
    console.log(`\n════ GATE: ${breaches.length} breach(es); ${excepted} finding(s) within declared budgets ════`);
    for (const f of breaches) {
      console.log(`  ✗ [${f.caseId}] ${f.category} :: ${f.property}  DOM=${f.dom} SVG=${f.svg}` +
        (f.delta != null ? ` Δ=${f.delta}` : " (MISSING/unmeasurable)"));
    }
    if (breaches.length > 0) {
      console.error("\nWYSIWYG gate FAILED — fix the divergence or take it through the decision register (never silently widen a budget).");
      process.exit(1);
    }
    console.log("WYSIWYG gate PASSED.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
