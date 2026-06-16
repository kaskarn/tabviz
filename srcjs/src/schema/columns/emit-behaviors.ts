// `emitSource` behaviors for the concrete column schemas.
//
// Migrated from `lib/source-emit.ts::emitTypeSpecificArgs`. Each
// behavior returns `{ name, typeArgs }` — the JS-builder name + the
// type-specific args, with defaults stripped. The caller in
// `source-emit.ts::emitColumn` merges in common args
// (token, headerAlign, …) and assembles the final string.
//
// Defaults below are verbatim from the old switch — this is a
// behavior-preserving refactor.
//
// Schemas registered here = schema KEYS, not wire `type`s. The
// dispatcher resolves a column's schema via type+bucket lookup
// then walks the inheritance chain looking for the leaf-most
// emitSource. Because some wire types are shared by multiple
// schemas (numeric → numeric/currency/n/percent), we register the
// behavior on the COMMON ancestor of each cluster and handle the
// variants inline with the same heuristics the old switch used.

import type { ColumnSpec } from "../../types";
import { registerBehaviors } from "../extend";
import { dropDefaults } from "../../lib/emit-utils";

type O = Record<string, unknown>;
const opts   = (col: ColumnSpec): O      => (col.options ?? {}) as O;
const bucket = (col: ColumnSpec, k: string): O => ((opts(col)[k] ?? {}) as O);

/** Idempotent re-register helper for tests after registry reset. */
export function registerEmitBehaviors(): void {

registerBehaviors("text", {
  emitSource: (col) => ({
    name: "colText",
    typeArgs: dropDefaults(
      { field: col.field, maxChars: bucket(col, "text").maxChars },
      { maxChars: undefined as unknown },
    ),
  }),
});

// Numeric cluster — numeric / currency / n / percent all share
// wire type "numeric". Disambiguate by options:
//   - `options.percent` present     → colPercent
//   - `options.numeric.prefix==="$"` → colCurrency
//   - otherwise                      → colNumeric
registerBehaviors("numeric", {
  emitSource: (col) => {
    const o = opts(col);
    if (o.percent) {
      return {
        name: "colPercent",
        typeArgs: dropDefaults(
          { field: col.field, ...(o.percent as O) },
          { decimals: 1, multiply: true, symbol: true },
        ),
      };
    }
    const num = bucket(col, "numeric");
    return {
      name: num.prefix === "$" ? "colCurrency" : "colNumeric",
      typeArgs: dropDefaults(
        {
          field: col.field,
          decimals: num.decimals,
          digits: num.digits,
          thousandsSep: num.thousandsSep,
          abbreviate: num.abbreviate,
          prefix: num.prefix === "$" ? undefined : num.prefix,
          suffix: num.suffix,
        },
        { decimals: 2, thousandsSep: false, abbreviate: false, digits: undefined as unknown },
      ),
    };
  },
});

registerBehaviors("interval", {
  // Spread the whole authoring bucket (like every sibling emitter) so the D30
  // bounds primitives (boundsLayout/Content/Open/Close/Separator/Prefix/Muted)
  // and `variant` round-trip to source — hand-enumerating the fields silently
  // dropped them. `point` defaults to the column field; dropDefaults strips the
  // standard format defaults.
  emitSource: (col) => {
    const o = bucket(col, "interval");
    return {
      name: "colInterval",
      typeArgs: dropDefaults(
        { ...o, point: o.point ?? col.field },
        { decimals: 2, thousandsSep: false, abbreviate: false, separator: " ", impreciseThreshold: undefined as unknown },
      ),
    };
  },
});

registerBehaviors("pvalue", {
  emitSource: (col) => ({
    name: "colPvalue",
    typeArgs: dropDefaults(
      { field: col.field, ...bucket(col, "pvalue") },
      { stars: false, thresholds: [0.05, 0.01, 0.001], format: "auto", digits: 2, expThreshold: 0.001, abbrevThreshold: null },
    ),
  }),
});

registerBehaviors("bar", {
  emitSource: (col) => ({
    name: "colBar",
    typeArgs: dropDefaults(
      { field: col.field, ...bucket(col, "bar") },
      { maxValue: null, showLabel: true, color: null, scale: "linear" },
    ),
  }),
});

registerBehaviors("sparkline", {
  emitSource: (col) => ({
    name: "colSparkline",
    typeArgs: dropDefaults(
      { field: col.field, ...bucket(col, "sparkline") },
      { type: "line", height: 20, color: null },
    ),
  }),
});

registerBehaviors("heatmap", {
  emitSource: (col) => ({
    name: "colHeatmap",
    typeArgs: dropDefaults(
      { field: col.field, ...bucket(col, "heatmap") },
      { minValue: null, maxValue: null, decimals: 2, showValue: true, scale: "linear" },
    ),
  }),
});

registerBehaviors("progress", {
  emitSource: (col) => ({
    name: "colProgress",
    typeArgs: dropDefaults(
      { field: col.field, ...bucket(col, "progress") },
      { maxValue: 100, color: null, showLabel: true, scale: "linear" },
    ),
  }),
});

registerBehaviors("badge", {
  emitSource: (col) => ({
    name: "colBadge",
    typeArgs: dropDefaults(
      { field: col.field, ...bucket(col, "badge") },
      { size: "base", shape: "pill", outline: false },
    ),
  }),
});

registerBehaviors("icon", {
  emitSource: (col) => ({
    name: "colIcon",
    typeArgs: dropDefaults(
      { field: col.field, ...bucket(col, "icon") },
      { size: "base" },
    ),
  }),
});

registerBehaviors("stars", {
  emitSource: (col) => ({
    name: "colStars",
    typeArgs: dropDefaults(
      { field: col.field, ...bucket(col, "stars") },
      { maxGlyphs: 5, halfGlyphs: false, domain: null, size: "base" },
    ),
  }),
});

registerBehaviors("pictogram", {
  emitSource: (col) => ({
    name: "colPictogram",
    typeArgs: dropDefaults(
      { field: col.field, ...bucket(col, "pictogram") },
      { glyph: "person", glyphField: null, maxGlyphs: null, domain: null,
        halfGlyphs: false, color: null, emptyColor: null, size: "base",
        layout: "row", valueLabel: false, labelFormat: null, labelDecimals: 1 },
    ),
  }),
});

registerBehaviors("ring", {
  emitSource: (col) => ({
    name: "colRing",
    typeArgs: dropDefaults(
      { field: col.field, ...bucket(col, "ring") },
      { minValue: 0, maxValue: 1, color: null, thresholds: null,
        trackColor: null, size: "base", showLabel: true,
        labelFormat: "percent", labelDecimals: 0 },
    ),
  }),
});

registerBehaviors("img", {
  emitSource: (col) => ({
    name: "colImg",
    typeArgs: dropDefaults(
      { field: col.field, ...bucket(col, "img") },
      { height: null, shape: "square" },
    ),
  }),
});

registerBehaviors("reference", {
  emitSource: (col) => ({
    name: "colReference",
    typeArgs: dropDefaults(
      { field: col.field, ...bucket(col, "reference") },
      { maxChars: 30, showIcon: true },
    ),
  }),
});

registerBehaviors("range", {
  emitSource: (col) => ({
    name: "colRange",
    typeArgs: dropDefaults(
      { field: col.field, ...bucket(col, "range") },
      { separator: " - ", decimals: null, thousandsSep: false, abbreviate: false },
    ),
  }),
});

// viz_forest — schema KEY is "viz_forest" (wire type is "forest");
// the editor's column-type picker creates with type "forest" too.
registerBehaviors("viz_forest", {
  emitSource: (col) => ({
    name: "vizForest",
    typeArgs: dropDefaults(
      { ...bucket(col, "forest") },
      { scale: "linear", axisLabel: "Effect", axisRange: null, axisTicks: null,
        axisGridlines: false, showAxis: true, annotations: null, sharedAxis: null,
        // nullValue default is scale-dependent — left to the builder
        nullValue: undefined as unknown },
    ),
  }),
});

registerBehaviors("viz_bar", {
  emitSource: (col) => ({
    name: "vizBar",
    typeArgs: { effects: (bucket(col, "vizBar").effects as unknown[]) ?? [] },
  }),
});

registerBehaviors("viz_boxplot", {
  emitSource: (col) => ({
    name: "vizBoxplot",
    typeArgs: { effects: (bucket(col, "vizBoxplot").effects as unknown[]) ?? [] },
  }),
});

registerBehaviors("viz_violin", {
  emitSource: (col) => ({
    name: "vizViolin",
    typeArgs: { effects: (bucket(col, "vizViolin").effects as unknown[]) ?? [] },
  }),
});

// events — wire type "custom"; the only schema currently mapping
// to "custom" so disambiguation is trivial.
registerBehaviors("events", {
  emitSource: (col) => {
    const o = bucket(col, "events");
    return {
      name: "colEvents",
      typeArgs: dropDefaults(
        { events: o.eventsField, n: o.nField,
          separator: o.separator, showPct: o.showPct,
          thousandsSep: o.thousandsSep, abbreviate: o.abbreviate },
        { separator: "/", showPct: false, thousandsSep: ",", abbreviate: false },
      ),
    };
  },
});

}  // end registerEmitBehaviors

// Side-effect: register on first import.
registerEmitBehaviors();
