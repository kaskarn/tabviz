/**
 * View-Source emitter — turns a resolved WebSpec + op-log into compact,
 * builder-style TypeScript source code.
 *
 * Replaces the previous "dump the resolved WebSpec as JSON" emitter
 * (`SourceModal.svelte::jsSource`) with a fluent call that uses the
 * `@tabviz/core` authoring API. Goals:
 *
 *   1. **Hide data** — emit `data: tabvizData` placeholder; never inline
 *      the data array (could be hundreds of rows).
 *   2. **Theme as name string** — if the current theme matches a preset's
 *      resolved output (byte-equal compare), emit `theme: "lancet"`;
 *      otherwise emit `theme: webTheme({ ... })`.
 *   3. **Omit defaults** — for each builder, compare each argument against
 *      its default; emit only differing args.
 *   4. **Use builders** — walk the resolved WebSpec; for each column,
 *      infer the builder it came from (`type` → builder name) and
 *      reconstruct the call from the column's fields.
 *
 * Pure function — no DOM, no Svelte. Tested by unit tests against fixture
 * specs covering every column type.
 */

import type { WebSpec, ColumnDef, ColumnSpec, ColumnGroup } from "../types";
import type { WebTheme } from "../types/theme-resolved";
import { THEME_PRESETS, THEME_NAMES, type ThemeName } from "./theme/theme-presets";
import { oklchToHex } from "./oklch";
import { dispatchForColumn } from "../schema/dispatch";
// Side-effect: register built-in `emitSource` behaviors so the
// dispatcher above finds them. Without this import the schema
// registry is silent on emit and the fallback `colText` would fire
// for every column.
import "../schema/columns/emit-behaviors";

// ────────────────────────────────────────────────────────────────────
// Literal rendering
// ────────────────────────────────────────────────────────────────────

/** Render any JS value as TS source. */
function jsLit(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(jsLit).join(", ")}]`;
  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>)
      .filter(([, val]) => val !== undefined)
      .map(([k, val]) => `${jsKey(k)}: ${jsLit(val)}`);
    return `{ ${entries.join(", ")} }`;
  }
  return JSON.stringify(v);
}

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const jsKey = (k: string) => (IDENT_RE.test(k) ? k : JSON.stringify(k));

// ────────────────────────────────────────────────────────────────────
// Per-builder default tables — only emit args that differ from these.
// Mirrors the `?? defaultValue` defaults in srcjs/src/authoring/columns.ts.
// ────────────────────────────────────────────────────────────────────

interface BuilderSpec {
  name: string;          // builder function name (e.g. "colText")
  /** Fields read directly off `args` (positional / named, depending on builder). */
  argMap: (col: ColumnSpec) => Record<string, unknown>;
  /** Defaults for each named arg — entries equal to these are omitted from output. */
  defaults: Record<string, unknown>;
}

// Common header default = field. Width default = "auto". Align = "left".
// Sortable = true. Flex auto-derived per type.
const COMMON_DEFAULTS = {
  width: "auto" as const,
  align: "left",
  sortable: true,
  wrap: false,
  showHeader: undefined,
  headerAlign: null,
};

/**
 * Extract `header`/`width`/`align`/etc. into a "common" sub-object only when
 * they differ from defaults. Returns `undefined` if everything matches.
 */
function emitCommon(col: ColumnSpec): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (col.header !== col.field) out.header = col.header;
  if (col.width !== "auto") out.width = col.width;
  if (col.align !== "left") out.align = col.align;
  if (col.sortable !== true) out.sortable = col.sortable;
  if (col.wrap !== false && col.wrap !== 0) out.wrap = col.wrap;
  if (col.headerAlign != null) out.headerAlign = col.headerAlign;
  if (col.showHeader !== undefined) out.showHeader = col.showHeader;
  if (col.styleMapping && Object.keys(col.styleMapping).length > 0) {
    out.style = col.styleMapping;
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────
// Column → builder call mapping
// ────────────────────────────────────────────────────────────────────

/** Map a ColumnSpec to a builder-call string like `colText({ field: "x" })`. */
function emitColumn(col: ColumnDef): string {
  if (col.isGroup) return emitColumnGroup(col);
  const common = emitCommon(col);
  const { name, typeArgs } = emitTypeSpecificArgs(col);
  const merged = { ...typeArgs, ...common };
  return `${name}(${jsLit(merged)})`;
}

function emitColumnGroup(g: ColumnGroup): string {
  const children = g.columns.map(emitColumn).join(",\n    ");
  return `colGroup({\n  header: ${JSON.stringify(g.header)},\n  children: [\n    ${children},\n  ],\n})`;
}

/**
 * Map a ColumnSpec to its builder-call shape via schema dispatch.
 * Each concrete schema registers `emitSource` in
 * `schema/columns/emit-behaviors.ts`. Falls back to `colText` for
 * any column whose schema doesn't define one (a graceful default
 * for unknown / mis-typed columns).
 */
function emitTypeSpecificArgs(col: ColumnSpec): { name: string; typeArgs: Record<string, unknown> } {
  const fn = dispatchForColumn(col, "emitSource");
  if (fn) return fn(col);
  return { name: "colText", typeArgs: { field: col.field } };
}

// ────────────────────────────────────────────────────────────────────
// Theme — name-string match against snapshots, else webTheme({...})
// ────────────────────────────────────────────────────────────────────

function emitTheme(theme: WebTheme | unknown): string {
  // Match the resolved theme against a preset by name + brand-anchor seed.
  // V4: identity reads come from authoringInputs.anchors (the canonical
  // Tier-1 inputs), not the v3 ResolvedInputs shim.
  const name = (theme as { name?: string })?.name;
  const themeAuth = (theme as WebTheme).authoringInputs;
  if (name && (THEME_NAMES as readonly string[]).includes(name) && themeAuth) {
    const preset = THEME_PRESETS[name as ThemeName] as unknown as WebTheme;
    const themeBrand = oklchToHex(themeAuth.anchors.brand);
    const presetBrand = preset.authoringInputs ? oklchToHex(preset.authoringInputs.anchors.brand) : null;
    if (themeBrand === presetBrand) {
      return JSON.stringify(name);
    }
  }
  // Custom theme — emit a webTheme() call (brand + accent).
  if (themeAuth) {
    const brandHex = oklchToHex(themeAuth.anchors.brand);
    const accentHex = themeAuth.anchors.accent
      ? oklchToHex(themeAuth.anchors.accent)
      : null;
    const args: Record<string, string> = { name: name ?? "custom", brand: brandHex };
    if (accentHex && accentHex !== brandHex) args.accent = accentHex;
    return `webTheme(${jsLit(args)})`;
  }
  return "/* custom theme — see spec.theme */ undefined";
}

// ────────────────────────────────────────────────────────────────────
// Top-level emitter
// ────────────────────────────────────────────────────────────────────

export interface EmitJsSourceArgs {
  spec: WebSpec;
  /** Op-log entries with `.jsCall` strings to replay after mount. */
  opLog?: Array<{ jsCall: string }>;
  /** Use this name for the data placeholder. Default `"tabvizData"`. */
  dataVarName?: string;
}

export function emitJsSource({ spec, opLog, dataVarName = "tabvizData" }: EmitJsSourceArgs): string {
  // labelColumn lives on its own wire slot (since 0.34.2). For the emitted
  // snippet we surface it via the `label:` / `labelHeader:` sugar when it's a
  // plain text column with no custom width/align, and fall back to prepending
  // it into `columns` for anything customized.
  // labelColumn is typed as ColumnDef (ColumnSpec | ColumnGroup) on the
  // wire, but the runtime contract is "always a leaf ColumnSpec or null"
  // — labelColumn is constructed by `tabviz()` from the `label` arg and
  // is never a group. Narrow here so the sugar conditions can read the
  // ColumnSpec fields without union complaints.
  const labelCol = (spec.labelColumn ?? null) as
    | (ColumnSpec & { type?: string })
    | null;
  const labelSugar =
    labelCol &&
    labelCol.type === "text" &&
    labelCol.id === "label" &&
    (labelCol.width == null || labelCol.width === "auto") &&
    (labelCol.align == null || labelCol.align === "left");

  const visibleColumns = labelCol && !labelSugar ? [labelCol, ...spec.columns] : spec.columns;
  const columns = visibleColumns.map(emitColumn).join(",\n    ");
  const themeRef = emitTheme(spec.theme);

  const tabvizArgs: string[] = [
    `  data: ${dataVarName},`,
  ];
  if (labelSugar && labelCol) {
    tabvizArgs.push(`  label: ${JSON.stringify(labelCol.field)},`);
    if (labelCol.header && labelCol.header !== labelCol.field) {
      tabvizArgs.push(`  labelHeader: ${JSON.stringify(labelCol.header)},`);
    }
  }
  tabvizArgs.push(`  columns: [\n    ${columns},\n  ],`);
  // Omit `theme:` when it resolves to the package default ("nejm").
  // Authors who want explicit theme provenance can still pass it; the
  // emitter just doesn't pad the snippet with the default.
  if (themeRef !== `"nejm"`) {
    tabvizArgs.push(`  theme: ${themeRef},`);
  }
  if (spec.labels?.title)    tabvizArgs.push(`  title: ${JSON.stringify(spec.labels.title)},`);
  if (spec.labels?.subtitle) tabvizArgs.push(`  subtitle: ${JSON.stringify(spec.labels.subtitle)},`);
  if (spec.labels?.caption)  tabvizArgs.push(`  caption: ${JSON.stringify(spec.labels.caption)},`);
  if (spec.labels?.footnote) tabvizArgs.push(`  footnote: ${JSON.stringify(spec.labels.footnote)},`);

  const importLine = imports(themeRef !== `"nejm"` && themeRef.startsWith("webTheme"));
  const ops = (opLog ?? []).map((r) => r.jsCall).filter(Boolean).join("\n");

  return [
    importLine,
    `import "@tabviz/core/style.css";`,
    ``,
    `const spec = tabviz({`,
    tabvizArgs.join("\n"),
    `});`,
    ``,
    `const instance = createTabviz(document.querySelector("#plot")!, spec);`,
    ops ? "" : null,
    ops,
  ]
    .filter((s): s is string => typeof s === "string")
    .join("\n")
    .trimEnd();
}

/** Pick the imports needed based on which authoring helpers we used. */
function imports(usedWebTheme: boolean): string {
  const names = ["tabviz", "createTabviz"];
  // Always include the common column builders + viz — being slightly
  // over-inclusive is fine; tree-shaking removes unused. Keeping the import
  // line short and stable is more readable than computing per-emission.
  names.push(
    "colText", "colNumeric", "colN", "colInterval", "colPvalue",
    "colBar", "colSparkline", "colBadge", "colIcon", "colStars",
    "colPictogram", "colRing", "colHeatmap", "colProgress",
    "colImg", "colReference", "colRange", "colEvents", "colPercent",
    "colCurrency", "colGroup",
    "vizForest", "vizBar", "vizBoxplot", "vizViolin",
    "effectForest", "effectBar", "effectBoxplot", "effectViolin",
    "refline",
  );
  if (usedWebTheme) names.push("webTheme");
  return `import { ${names.join(", ")} } from "@tabviz/core";`;
}
