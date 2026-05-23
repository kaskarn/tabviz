// CI drift gate — every option in every concrete schema must declare
// which behaviors read it. This is the gate that catches the
// "I added a knob to the editor but no renderer/serializer/sorter
// reads it" class of bug: authors forget the wiring, and the option
// silently doesn't do anything.
//
// Mechanism: `OptionSpec.consumedBy: string[]` — a list of behavior
// names (or `"editor"` for editor-only knobs that intentionally don't
// drive runtime). The test walks every concrete schema's option list
// (cascade-resolved) and fails when any option's `consumedBy` is
// missing or empty.
//
// A KNOWN_UNCONSUMED grandfather list lets the gate ship before every
// option has been audited. New options must annotate explicitly; the
// list can only shrink. To suppress an option, add a row to the list
// with the schema key + option key. Reviewers should check that
// every new entry has a follow-up issue.
//
// Adding a consumer:
//   1. Pick the behavior name(s) that read this option at runtime:
//      "emitSource" | "sortKey" | "estimateWidth" | "formatValue" |
//      "renderCell" | "contributeBanks" | "contributeConditions" |
//      "aggregate" | "editor" (UI-only)
//   2. Add `consumedBy: ["emitSource", "renderCell"]` to the OptionSpec
//   3. Remove the row from KNOWN_UNCONSUMED (if present)

import { describe, it, expect } from "bun:test";
import { SCHEMA_REGISTRY } from "./index";
import { resolveSchema } from "../resolve";

/** Schema-key → option-key pairs grandfathered as not-yet-annotated.
 *
 *  Format: `<schema.key>:<option.key>`.
 *
 *  Adding a row is debt — open a follow-up to populate the option's
 *  `consumedBy` and remove the row. This list can only shrink: the
 *  gate's job is to catch regressions where new code adds an
 *  un-annotated option without anyone noticing.
 *
 *  Initial population captured 2026-05-23 from the schema tree
 *  audited at branch feat/schema-driven-columns. Most rows are
 *  inherited from BASE/TEXT/NUMERIC (header / align / width /
 *  sortable etc.) — annotating the inherited definitions once will
 *  clear many rows at once.
 */
const KNOWN_UNCONSUMED = new Set<string>([
  // -- BEGIN GRANDFATHER --
  // Auto-populated; do not hand-edit unless removing a now-annotated entry.
  // To regenerate: `bun test src/schema/columns/drift.test.ts` and pipe
  // the offence list through `awk '{print "  \""$0"\","}'`.
  // -- BADGE / BAR / CURRENCY / DATE / EVENTS / HEATMAP / ICON / IMG --
  // (full list emitted below)
  ...[] as string[], // anchor for the grandfather block
]);

// Grandfather block — separate const so the diff stays readable and
// regeneration replaces a single contiguous region.
const GRANDFATHER: readonly string[] = [
  // BEGIN AUTOGEN
  "badge:align",
  "badge:borderClass",
  "badge:colors",
  "badge:header",
  "badge:headerAlign",
  "badge:naText",
  "badge:outline",
  "badge:paddingClass",
  "badge:shape",
  "badge:showHeader",
  "badge:size",
  "badge:sortable",
  "badge:thresholds",
  "badge:token",
  "badge:variants",
  "badge:width",
  "bar:align",
  "bar:borderClass",
  "bar:color",
  "bar:header",
  "bar:headerAlign",
  "bar:maxValue",
  "bar:naText",
  "bar:paddingClass",
  "bar:scale",
  "bar:showHeader",
  "bar:showLabel",
  "bar:sortable",
  "bar:token",
  "bar:width",
  "currency:abbreviate",
  "currency:align",
  "currency:borderClass",
  "currency:decimals",
  "currency:digits",
  "currency:fontClass",
  "currency:header",
  "currency:headerAlign",
  "currency:maxChars",
  "currency:naText",
  "currency:paddingClass",
  "currency:position",
  "currency:prefix",
  "currency:showHeader",
  "currency:sortable",
  "currency:suffix",
  "currency:symbol",
  "currency:thousandsSep",
  "currency:token",
  "currency:width",
  "currency:wrap",
  "date:align",
  "date:borderClass",
  "date:format",
  "date:header",
  "date:headerAlign",
  "date:naText",
  "date:paddingClass",
  "date:showHeader",
  "date:sortable",
  "date:token",
  "date:width",
  "events:abbreviate",
  "events:align",
  "events:borderClass",
  "events:decimals",
  "events:digits",
  "events:fontClass",
  "events:header",
  "events:headerAlign",
  "events:maxChars",
  "events:naText",
  "events:paddingClass",
  "events:prefix",
  "events:separator",
  "events:showHeader",
  "events:showPct",
  "events:sortable",
  "events:suffix",
  "events:thousandsSep",
  "events:token",
  "events:width",
  "events:wrap",
  "heatmap:abbreviate",
  "heatmap:align",
  "heatmap:borderClass",
  "heatmap:decimals",
  "heatmap:digits",
  "heatmap:fontClass",
  "heatmap:header",
  "heatmap:headerAlign",
  "heatmap:maxChars",
  "heatmap:maxValue",
  "heatmap:minValue",
  "heatmap:naText",
  "heatmap:paddingClass",
  "heatmap:palette",
  "heatmap:prefix",
  "heatmap:scale",
  "heatmap:showHeader",
  "heatmap:showValue",
  "heatmap:sortable",
  "heatmap:suffix",
  "heatmap:thousandsSep",
  "heatmap:token",
  "heatmap:width",
  "heatmap:wrap",
  "icon:align",
  "icon:borderClass",
  "icon:color",
  "icon:header",
  "icon:headerAlign",
  "icon:mapping",
  "icon:naText",
  "icon:paddingClass",
  "icon:showHeader",
  "icon:size",
  "icon:sortable",
  "icon:token",
  "icon:width",
  "img:align",
  "img:borderClass",
  "img:fallback",
  "img:header",
  "img:headerAlign",
  "img:height",
  "img:maxWidth",
  "img:naText",
  "img:paddingClass",
  "img:shape",
  "img:showHeader",
  "img:sortable",
  "img:token",
  "img:width",
  "interval:abbreviate",
  "interval:align",
  "interval:borderClass",
  "interval:decimals",
  "interval:digits",
  "interval:fontClass",
  "interval:header",
  "interval:headerAlign",
  "interval:impreciseThreshold",
  "interval:maxChars",
  "interval:naText",
  "interval:paddingClass",
  "interval:prefix",
  "interval:separator",
  "interval:showHeader",
  "interval:sortable",
  "interval:suffix",
  "interval:thousandsSep",
  "interval:token",
  "interval:width",
  "interval:wrap",
  "n:abbreviate",
  "n:align",
  "n:borderClass",
  "n:decimals",
  "n:digits",
  "n:fontClass",
  "n:header",
  "n:headerAlign",
  "n:maxChars",
  "n:naText",
  "n:paddingClass",
  "n:prefix",
  "n:showHeader",
  "n:sortable",
  "n:suffix",
  "n:thousandsSep",
  "n:token",
  "n:width",
  "n:wrap",
  "numeric:abbreviate",
  "numeric:align",
  "numeric:borderClass",
  "numeric:decimals",
  "numeric:digits",
  "numeric:fontClass",
  "numeric:header",
  "numeric:headerAlign",
  "numeric:maxChars",
  "numeric:naText",
  "numeric:paddingClass",
  "numeric:prefix",
  "numeric:showHeader",
  "numeric:sortable",
  "numeric:suffix",
  "numeric:thousandsSep",
  "numeric:token",
  "numeric:width",
  "numeric:wrap",
  "percent:abbreviate",
  "percent:align",
  "percent:borderClass",
  "percent:decimals",
  "percent:digits",
  "percent:fontClass",
  "percent:header",
  "percent:headerAlign",
  "percent:maxChars",
  "percent:multiply",
  "percent:naText",
  "percent:paddingClass",
  "percent:prefix",
  "percent:showHeader",
  "percent:sortable",
  "percent:suffix",
  "percent:symbol",
  "percent:thousandsSep",
  "percent:token",
  "percent:width",
  "percent:wrap",
  "pictogram:align",
  "pictogram:borderClass",
  "pictogram:color",
  "pictogram:domain",
  "pictogram:emptyColor",
  "pictogram:glyph",
  "pictogram:glyphField",
  "pictogram:halfGlyphs",
  "pictogram:header",
  "pictogram:headerAlign",
  "pictogram:labelDecimals",
  "pictogram:labelFormat",
  "pictogram:layout",
  "pictogram:maxGlyphs",
  "pictogram:naText",
  "pictogram:paddingClass",
  "pictogram:showHeader",
  "pictogram:size",
  "pictogram:sortable",
  "pictogram:token",
  "pictogram:valueLabel",
  "pictogram:width",
  "progress:align",
  "progress:borderClass",
  "progress:color",
  "progress:header",
  "progress:headerAlign",
  "progress:maxValue",
  "progress:naText",
  "progress:paddingClass",
  "progress:scale",
  "progress:showHeader",
  "progress:showLabel",
  "progress:sortable",
  "progress:token",
  "progress:width",
  "pvalue:abbrevThreshold",
  "pvalue:align",
  "pvalue:borderClass",
  "pvalue:digits",
  "pvalue:expThreshold",
  "pvalue:format",
  "pvalue:header",
  "pvalue:headerAlign",
  "pvalue:naText",
  "pvalue:paddingClass",
  "pvalue:showHeader",
  "pvalue:sortable",
  "pvalue:stars",
  "pvalue:thresholds",
  "pvalue:token",
  "pvalue:width",
  "range:abbreviate",
  "range:align",
  "range:borderClass",
  "range:decimals",
  "range:digits",
  "range:fontClass",
  "range:header",
  "range:headerAlign",
  "range:maxChars",
  "range:naText",
  "range:paddingClass",
  "range:prefix",
  "range:separator",
  "range:showBar",
  "range:showHeader",
  "range:sortable",
  "range:suffix",
  "range:thousandsSep",
  "range:token",
  "range:width",
  "range:wrap",
  "reference:align",
  "reference:borderClass",
  "reference:fontClass",
  "reference:header",
  "reference:headerAlign",
  "reference:hrefField",
  "reference:maxChars",
  "reference:naText",
  "reference:paddingClass",
  "reference:showHeader",
  "reference:showIcon",
  "reference:sortable",
  "reference:token",
  "reference:width",
  "reference:wrap",
  "ring:align",
  "ring:borderClass",
  "ring:color",
  "ring:header",
  "ring:headerAlign",
  "ring:labelDecimals",
  "ring:labelFormat",
  "ring:maxValue",
  "ring:minValue",
  "ring:naText",
  "ring:paddingClass",
  "ring:showHeader",
  "ring:showLabel",
  "ring:size",
  "ring:sortable",
  "ring:thresholds",
  "ring:token",
  "ring:trackColor",
  "ring:width",
  "sparkline:align",
  "sparkline:borderClass",
  "sparkline:color",
  "sparkline:header",
  "sparkline:headerAlign",
  "sparkline:height",
  "sparkline:naText",
  "sparkline:paddingClass",
  "sparkline:showHeader",
  "sparkline:sortable",
  "sparkline:token",
  "sparkline:type",
  "sparkline:width",
  "stars:align",
  "stars:borderClass",
  "stars:color",
  "stars:domain",
  "stars:emptyColor",
  "stars:glyph",
  "stars:glyphField",
  "stars:halfGlyphs",
  "stars:header",
  "stars:headerAlign",
  "stars:labelDecimals",
  "stars:labelFormat",
  "stars:layout",
  "stars:maxGlyphs",
  "stars:naText",
  "stars:paddingClass",
  "stars:showHeader",
  "stars:size",
  "stars:sortable",
  "stars:token",
  "stars:valueLabel",
  "stars:width",
  "text:align",
  "text:borderClass",
  "text:fontClass",
  "text:header",
  "text:headerAlign",
  "text:maxChars",
  "text:naText",
  "text:paddingClass",
  "text:showHeader",
  "text:sortable",
  "text:token",
  "text:width",
  "text:wrap",
  "viz_bar:align",
  "viz_bar:annotations",
  "viz_bar:axisGridlines",
  "viz_bar:axisLabel",
  "viz_bar:axisRange",
  "viz_bar:axisTicks",
  "viz_bar:barGap",
  "viz_bar:barWidth",
  "viz_bar:borderClass",
  "viz_bar:effects",
  "viz_bar:header",
  "viz_bar:headerAlign",
  "viz_bar:naText",
  "viz_bar:nullValue",
  "viz_bar:orientation",
  "viz_bar:paddingClass",
  "viz_bar:scale",
  "viz_bar:sharedAxis",
  "viz_bar:showAxis",
  "viz_bar:showHeader",
  "viz_bar:sortable",
  "viz_bar:token",
  "viz_bar:width",
  "viz_boxplot:align",
  "viz_boxplot:annotations",
  "viz_boxplot:axisGridlines",
  "viz_boxplot:axisLabel",
  "viz_boxplot:axisRange",
  "viz_boxplot:axisTicks",
  "viz_boxplot:borderClass",
  "viz_boxplot:boxWidth",
  "viz_boxplot:effects",
  "viz_boxplot:header",
  "viz_boxplot:headerAlign",
  "viz_boxplot:naText",
  "viz_boxplot:nullValue",
  "viz_boxplot:paddingClass",
  "viz_boxplot:scale",
  "viz_boxplot:sharedAxis",
  "viz_boxplot:showAxis",
  "viz_boxplot:showHeader",
  "viz_boxplot:showOutliers",
  "viz_boxplot:sortable",
  "viz_boxplot:token",
  "viz_boxplot:whiskerType",
  "viz_boxplot:width",
  "viz_forest:align",
  "viz_forest:annotations",
  "viz_forest:axisGridlines",
  "viz_forest:axisLabel",
  "viz_forest:axisRange",
  "viz_forest:axisTicks",
  "viz_forest:borderClass",
  "viz_forest:effects",
  "viz_forest:header",
  "viz_forest:headerAlign",
  "viz_forest:naText",
  "viz_forest:nullValue",
  "viz_forest:paddingClass",
  "viz_forest:scale",
  "viz_forest:sharedAxis",
  "viz_forest:showAxis",
  "viz_forest:showHeader",
  "viz_forest:sortable",
  "viz_forest:token",
  "viz_forest:width",
  "viz_violin:align",
  "viz_violin:annotations",
  "viz_violin:axisGridlines",
  "viz_violin:axisLabel",
  "viz_violin:axisRange",
  "viz_violin:axisTicks",
  "viz_violin:bandwidth",
  "viz_violin:borderClass",
  "viz_violin:effects",
  "viz_violin:header",
  "viz_violin:headerAlign",
  "viz_violin:maxWidth",
  "viz_violin:naText",
  "viz_violin:nullValue",
  "viz_violin:paddingClass",
  "viz_violin:scale",
  "viz_violin:sharedAxis",
  "viz_violin:showAxis",
  "viz_violin:showHeader",
  "viz_violin:showMedian",
  "viz_violin:showQuartiles",
  "viz_violin:sortable",
  "viz_violin:token",
  "viz_violin:width",
  // END AUTOGEN — see comment block above for regeneration recipe.
];
for (const handle of GRANDFATHER) KNOWN_UNCONSUMED.add(handle);

describe("schema drift gate — consumedBy", () => {
  // Build the full audit set: every option contributed to every concrete
  // schema, traversing the inheritance chain. Resolved-once so the same
  // option (inherited from BASE, TEXT, etc.) is only audited once per
  // concrete leaf.
  const offences: Array<{ schemaKey: string; optionKey: string }> = [];
  for (const [schemaKey, schema] of Object.entries(SCHEMA_REGISTRY)) {
    if (schema.abstract) continue;
    const cascade = resolveSchema(schema);
    const seen = new Set<string>();
    for (const layer of cascade) {
      for (const opt of layer.options) {
        if (seen.has(opt.key)) continue;
        seen.add(opt.key);
        const consumedBy = opt.consumedBy ?? [];
        if (consumedBy.length === 0) {
          const handle = `${schemaKey}:${opt.key}`;
          if (!KNOWN_UNCONSUMED.has(handle)) {
            offences.push({ schemaKey, optionKey: opt.key });
          }
        }
      }
    }
  }

  it("every option declares at least one consumer (or is grandfathered)", () => {
    if (offences.length > 0) {
      const lines = offences.map(
        (o) => `  ${o.schemaKey}:${o.optionKey}`,
      );
      const msg =
        `${offences.length} option(s) missing consumedBy:\n` +
        lines.join("\n") +
        `\n\nEither add \`consumedBy: ["<behavior>", …]\` to the OptionSpec ` +
        `or add the handle to KNOWN_UNCONSUMED in this file.`;
      throw new Error(msg);
    }
    expect(offences.length).toBe(0);
  });

  it("KNOWN_UNCONSUMED entries reference live options (no stale rows)", () => {
    const live = new Set<string>();
    for (const [schemaKey, schema] of Object.entries(SCHEMA_REGISTRY)) {
      if (schema.abstract) continue;
      const cascade = resolveSchema(schema);
      const seen = new Set<string>();
      for (const layer of cascade) {
        for (const opt of layer.options) {
          if (seen.has(opt.key)) continue;
          seen.add(opt.key);
          live.add(`${schemaKey}:${opt.key}`);
        }
      }
    }
    const stale = [...KNOWN_UNCONSUMED].filter((h) => !live.has(h));
    if (stale.length > 0) {
      throw new Error(
        `Stale KNOWN_UNCONSUMED rows (option no longer exists):\n` +
          stale.map((s) => `  ${s}`).join("\n"),
      );
    }
    expect(stale.length).toBe(0);
  });
});
