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
import type { WebThemeV2 } from "../types/theme-v2";
import { THEME_PRESETS, THEME_NAMES, type ThemeName } from "./theme-presets";

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

/** Drop entries that match the defaults table. */
function dropDefaults(args: Record<string, unknown>, defaults: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined) continue;
    if (k in defaults && deepEqual(v, defaults[k])) continue;
    out[k] = v;
  }
  return out;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== (b as unknown[]).length) return false;
    return a.every((v, i) => deepEqual(v, (b as unknown[])[i]));
  }
  const ak = Object.keys(a as Record<string, unknown>);
  const bk = Object.keys(b as Record<string, unknown>);
  if (ak.length !== bk.length) return false;
  return ak.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
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

function emitTypeSpecificArgs(col: ColumnSpec): { name: string; typeArgs: Record<string, unknown> } {
  const o = col.options ?? {};

  switch (col.type) {
    case "text":
      return {
        name: "colText",
        typeArgs: dropDefaults(
          { field: col.field, maxChars: o.text?.maxChars },
          { maxChars: undefined },
        ),
      };
    case "numeric":
      return {
        name: o.numeric?.prefix === "$" ? "colCurrency" : "colNumeric",
        typeArgs: dropDefaults(
          {
            field: col.field,
            decimals: o.numeric?.decimals,
            digits: o.numeric?.digits,
            thousandsSep: o.numeric?.thousandsSep,
            abbreviate: o.numeric?.abbreviate,
            prefix: o.numeric?.prefix === "$" ? undefined : o.numeric?.prefix,
            suffix: o.numeric?.suffix,
          },
          { decimals: 2, thousandsSep: false, abbreviate: false, digits: undefined },
        ),
      };
    case "interval":
      return {
        name: "colInterval",
        typeArgs: dropDefaults(
          {
            point: o.interval?.point ?? col.field,
            lower: o.interval?.lower,
            upper: o.interval?.upper,
            decimals: o.interval?.decimals,
            digits: o.interval?.digits,
            thousandsSep: o.interval?.thousandsSep,
            abbreviate: o.interval?.abbreviate,
            separator: o.interval?.separator,
            impreciseThreshold: o.interval?.impreciseThreshold,
          },
          { decimals: 2, thousandsSep: false, abbreviate: false, separator: " ", impreciseThreshold: undefined },
        ),
      };
    case "pvalue":
      return {
        name: "colPvalue",
        typeArgs: dropDefaults(
          { field: col.field, ...o.pvalue },
          { stars: false, thresholds: [0.05, 0.01, 0.001], format: "auto", digits: 2, expThreshold: 0.001, abbrevThreshold: null },
        ),
      };
    case "bar":
      return {
        name: "colBar",
        typeArgs: dropDefaults(
          { field: col.field, ...o.bar },
          { maxValue: null, showLabel: true, color: null, scale: "linear" },
        ),
      };
    case "sparkline":
      return {
        name: "colSparkline",
        typeArgs: dropDefaults(
          { field: col.field, ...o.sparkline },
          { type: "line", height: 20, color: null },
        ),
      };
    case "heatmap":
      return {
        name: "colHeatmap",
        typeArgs: dropDefaults(
          { field: col.field, ...o.heatmap },
          { minValue: null, maxValue: null, decimals: 2, showValue: true, scale: "linear" },
        ),
      };
    case "progress":
      return {
        name: "colProgress",
        typeArgs: dropDefaults(
          { field: col.field, ...o.progress },
          { maxValue: 100, color: null, showLabel: true, scale: "linear" },
        ),
      };
    case "badge":
      return {
        name: "colBadge",
        typeArgs: dropDefaults(
          { field: col.field, ...o.badge },
          { size: "base", shape: "pill", outline: false },
        ),
      };
    case "icon":
      return {
        name: "colIcon",
        typeArgs: dropDefaults(
          { field: col.field, ...o.icon },
          { size: "base" },
        ),
      };
    case "stars":
      return {
        name: "colStars",
        typeArgs: dropDefaults(
          { field: col.field, ...o.stars },
          { maxStars: 5, halfStars: false, domain: null, size: "base" },
        ),
      };
    case "pictogram":
      return {
        name: "colPictogram",
        typeArgs: dropDefaults(
          { field: col.field, ...o.pictogram },
          { glyph: "person", glyphField: null, maxGlyphs: null, domain: null,
            halfGlyphs: false, color: null, emptyColor: null, size: "base",
            layout: "row", valueLabel: false, labelFormat: null, labelDecimals: 0 },
        ),
      };
    case "ring":
      return {
        name: "colRing",
        typeArgs: dropDefaults(
          { field: col.field, ...o.ring },
          { minValue: 0, maxValue: 1, color: null, thresholds: null,
            trackColor: null, size: "base", showLabel: true,
            labelFormat: "percent", labelDecimals: 0 },
        ),
      };
    case "img":
      return {
        name: "colImg",
        typeArgs: dropDefaults(
          { field: col.field, ...o.img },
          { height: 40, shape: "square" },
        ),
      };
    case "reference":
      return {
        name: "colReference",
        typeArgs: dropDefaults(
          { field: col.field, ...o.reference },
          { maxChars: 30, showIcon: true },
        ),
      };
    case "range":
      return {
        name: "colRange",
        typeArgs: dropDefaults(
          { field: col.field, ...o.range },
          { separator: "–", decimals: null, thousandsSep: false, abbreviate: false, showBar: false },
        ),
      };
    case "forest":
      return {
        name: "vizForest",
        typeArgs: dropDefaults(
          { ...o.forest },
          { scale: "linear", axisLabel: "Effect", axisRange: null, axisTicks: null,
            axisGridlines: false, showAxis: true, annotations: null, sharedAxis: null,
            // nullValue's default is scale-dependent — handled by builder
            nullValue: undefined },
        ),
      };
    case "viz_bar":
      return { name: "vizBar", typeArgs: { effects: o.vizBar?.effects ?? [] } };
    case "viz_boxplot":
      return { name: "vizBoxplot", typeArgs: { effects: o.vizBoxplot?.effects ?? [] } };
    case "viz_violin":
      return { name: "vizViolin", typeArgs: { effects: o.vizViolin?.effects ?? [] } };
    case "custom":
      // Could be a percent column (look for `percent` options key) or events column.
      if (o.percent) {
        return {
          name: "colPercent",
          typeArgs: dropDefaults(
            { field: col.field, ...o.percent },
            { decimals: 1, multiply: true, symbol: true },
          ),
        };
      }
      if (o.events) {
        return {
          name: "colEvents",
          typeArgs: dropDefaults(
            { events: o.events.eventsField, n: o.events.nField,
              separator: o.events.separator, showPct: o.events.showPct,
              thousandsSep: o.events.thousandsSep, abbreviate: o.events.abbreviate },
            { separator: "/", showPct: false, thousandsSep: ",", abbreviate: false },
          ),
        };
      }
      return { name: "colText", typeArgs: { field: col.field } };
    default:
      return { name: "colText", typeArgs: { field: col.field } };
  }
}

// ────────────────────────────────────────────────────────────────────
// Theme — name-string match against snapshots, else webTheme({...})
// ────────────────────────────────────────────────────────────────────

function emitTheme(theme: WebThemeV2 | unknown): string {
  // Try to match the resolved theme against each preset snapshot.
  // Use the `name` field as a cheap first cut, then verify with structural
  // equality if available — but the cheap path covers the common case.
  const name = (theme as { name?: string })?.name;
  if (name && (THEME_NAMES as readonly string[]).includes(name)) {
    const preset = THEME_PRESETS[name as ThemeName] as unknown as WebThemeV2;
    // Cheap check: does the input's `inputs.primary` match the preset's?
    const inputPrim = (theme as WebThemeV2).inputs?.primary;
    const presetPrim = preset.inputs?.primary;
    if (inputPrim === presetPrim) {
      return JSON.stringify(name);
    }
  }
  // Custom theme — emit a webTheme() call with inputs only (rest derives).
  const inputs = (theme as WebThemeV2).inputs;
  if (inputs) {
    return `webTheme({ name: ${JSON.stringify(name ?? "custom")}, inputs: ${jsLit({ primary: inputs.primary, accent: inputs.accent, neutral: inputs.neutral })} })`;
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
  // Omit `theme:` when it resolves to the package default ("bmj").
  // Authors who want explicit theme provenance can still pass it; the
  // emitter just doesn't pad the snippet with the default.
  if (themeRef !== `"bmj"`) {
    tabvizArgs.push(`  theme: ${themeRef},`);
  }
  if (spec.labels?.title)    tabvizArgs.push(`  title: ${JSON.stringify(spec.labels.title)},`);
  if (spec.labels?.subtitle) tabvizArgs.push(`  subtitle: ${JSON.stringify(spec.labels.subtitle)},`);
  if (spec.labels?.caption)  tabvizArgs.push(`  caption: ${JSON.stringify(spec.labels.caption)},`);
  if (spec.labels?.footnote) tabvizArgs.push(`  footnote: ${JSON.stringify(spec.labels.footnote)},`);

  const importLine = imports(themeRef !== `"bmj"` && themeRef.startsWith("webTheme"));
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
