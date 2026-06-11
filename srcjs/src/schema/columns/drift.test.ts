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
  "badge:colors",
  "badge:outline",
  "badge:shape",
  "badge:size",
  "badge:thresholds",
  "badge:variants",
  "bar:color",
  "bar:maxValue",
  "bar:scale",
  "bar:showLabel",
  "currency:position",
  "currency:symbol",
  "date:format",
  "events:separator",
  "events:showPct",
  "heatmap:maxValue",
  "heatmap:minValue",
  "heatmap:palette",
  "heatmap:scale",
  "heatmap:showValue",
  "icon:color",
  "icon:mapping",
  "icon:size",
  "img:fallback",
  "img:height",
  "img:maxWidth",
  "img:shape",
  "interval:impreciseThreshold",
  "interval:separator",
  "percent:multiply",
  "percent:symbol",
  "pictogram:color",
  "pictogram:domain",
  "pictogram:emptyColor",
  "pictogram:glyph",
  "pictogram:glyphField",
  "pictogram:halfGlyphs",
  "pictogram:labelDecimals",
  "pictogram:labelFormat",
  "pictogram:layout",
  "pictogram:maxGlyphs",
  "pictogram:size",
  "pictogram:valueLabel",
  "progress:color",
  "progress:maxValue",
  "progress:scale",
  "progress:showLabel",
  "range:separator",
  "reference:hrefField",
  "reference:showIcon",
  "ring:color",
  "ring:labelDecimals",
  "ring:labelFormat",
  "ring:maxValue",
  "ring:minValue",
  "ring:showLabel",
  "ring:size",
  "ring:thresholds",
  "ring:trackColor",
  "sparkline:color",
  "sparkline:height",
  "sparkline:type",
  "stars:color",
  "stars:domain",
  "stars:emptyColor",
  "stars:glyph",
  "stars:glyphField",
  "stars:halfGlyphs",
  "stars:labelDecimals",
  "stars:labelFormat",
  "stars:layout",
  "stars:maxGlyphs",
  "stars:size",
  "stars:valueLabel",
  "viz_bar:annotations",
  "viz_bar:axisGridlines",
  "viz_bar:axisLabel",
  "viz_bar:axisRange",
  "viz_bar:axisTicks",
  "viz_bar:effects",
  "viz_bar:nullValue",
  "viz_bar:scale",
  "viz_bar:sharedAxis",
  "viz_bar:showAxis",
  "viz_boxplot:annotations",
  "viz_boxplot:axisGridlines",
  "viz_boxplot:axisLabel",
  "viz_boxplot:axisRange",
  "viz_boxplot:axisTicks",
  "viz_boxplot:effects",
  "viz_boxplot:nullValue",
  "viz_boxplot:scale",
  "viz_boxplot:sharedAxis",
  "viz_boxplot:showAxis",
  "viz_boxplot:showOutliers",
  "viz_forest:annotations",
  "viz_forest:axisGridlines",
  "viz_forest:axisLabel",
  "viz_forest:axisRange",
  "viz_forest:axisTicks",
  "viz_forest:effects",
  "viz_forest:nullValue",
  "viz_forest:scale",
  "viz_forest:sharedAxis",
  "viz_forest:showAxis",
  "viz_violin:annotations",
  "viz_violin:axisGridlines",
  "viz_violin:axisLabel",
  "viz_violin:axisRange",
  "viz_violin:axisTicks",
  "viz_violin:bandwidth",
  "viz_violin:effects",
  "viz_violin:maxWidth",
  "viz_violin:nullValue",
  "viz_violin:scale",
  "viz_violin:sharedAxis",
  "viz_violin:showAxis",
  "viz_violin:showMedian",
  "viz_violin:showQuartiles",
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

// Sprint 1 PR 4: every concrete OptionSpec must declare `kind` explicitly.
// No grandfather list — the rule lands together with backfill across
// all 30 schema files. Theme-side surfaces (Sprint 3+ `theme.column_defaults`)
// gate on this distinction; an un-annotated option is a footgun waiting
// to happen.
describe("schema drift gate — kind", () => {
  const missing: Array<{ schemaKey: string; optionKey: string }> = [];
  for (const [schemaKey, schema] of Object.entries(SCHEMA_REGISTRY)) {
    if (schema.abstract) continue;
    const cascade = resolveSchema(schema);
    const seen = new Set<string>();
    for (const layer of cascade) {
      for (const opt of layer.options) {
        if (seen.has(opt.key)) continue;
        seen.add(opt.key);
        if (opt.kind === undefined) {
          missing.push({ schemaKey, optionKey: opt.key });
        }
      }
    }
  }

  it("every option declares kind explicitly", () => {
    if (missing.length > 0) {
      const lines = missing.map((o) => `  ${o.schemaKey}:${o.optionKey}`);
      const msg =
        `${missing.length} option(s) missing explicit \`kind\`:\n` +
        lines.join("\n") +
        `\n\nAdd \`kind: "core" | "styling" | "editor"\` to the OptionSpec. ` +
        `See OptionKind docstring in src/schema/types.ts for guidance.`;
      throw new Error(msg);
    }
    expect(missing.length).toBe(0);
  });
});
