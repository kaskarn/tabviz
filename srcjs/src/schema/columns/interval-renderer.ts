// Cell renderer for the `interval` schema.
//
// Text-composition exemplar: produces a tagged RenderNode tree,
// identical for browser + SVG export. Theme `nodeRules` can restyle
// the bounds via the `interval-range` tag without the renderer
// knowing anything about colors or sizes.
//
// Output shape (traditional variant):
//
//     group{ children: [
//       text "0.85",                         // point estimate
//       text " ",                            // separator (configurable)
//       group{ tags: ["interval-range"],     // bounds, theme-targetable
//         children: [text "(", text "0.72", text ", ", text "0.99", text ")"]
//       },
//     ]}
//
// Variants are NOT a runtime channel. The renderer reads only primitive
// recipe fields from `options.interval.__resolved` (populated at spec
// ingest by `compileVariants`). The wire `variant` id is preserved for
// the editor segmented control; the renderer never branches on it
// directly. See schema-sprint Phase 3 / variant-compile.ts.
//
// Edge cases preserved verbatim from the legacy `formatInterval`:
// - Missing point → `naText`
// - Missing bounds → just the point
// - Imprecise threshold tripped → "—"

import type { ColumnOptions } from "../../types";
import type { RenderNode, RenderText, RenderGroup, CellFormatter } from "../render-types";
import { registerRenderers } from "../extend";
import { formatNumber } from "../../lib/formatters";
import { tag } from "../theme-finalize";
import { withStyle } from "../compose";
import { resolveVariant } from "../variant-compile";
import { INTERVAL_SCHEMA } from "./interval";

function text(value: string): RenderText {
  return { kind: "text", value };
}

export interface IntervalRecipe {
  boundsLayout: "row" | "column";
  boundsContent: "range" | "half_width";
  boundsDelimiter: readonly [string, string];
  boundsSeparator: string;
  boundsPrefix: string;
  /** When true the bounds render in minor/muted text (smaller, secondary
   *  color) — drives the "muted" in e.g. the `bracket_muted` variant. Applied
   *  via the shared `withStyle` overlay (same as `compose({minor})`). */
  boundsMuted?: boolean;
}

/** Resolve the layout recipe for an interval column (exported so the
 *  width-measurement formatter mirrors EXACTLY what this renderer draws —
 *  the two diverged for the stacked/plus_minus variants, mis-sizing the
 *  column; user feedback 2026-06-08). */
/** The variant-resolved recipe BEFORE author primitive overrides. */
function baseRecipe(opts: ColumnOptions["interval"] | undefined): IntervalRecipe {
  // Prefer the pre-compiled __resolved shape (compileVariants ingest pass);
  // fall back to looking up the variant id directly so test fixtures and
  // ad-hoc render paths that bypass setSpec still work correctly.
  const fromResolved = opts?.__resolved as Partial<IntervalRecipe> | undefined;
  if (fromResolved && "boundsLayout" in fromResolved) {
    return fromResolved as IntervalRecipe;
  }
  const variantId = opts?.variant as string | undefined;
  const fallback = resolveVariant(INTERVAL_SCHEMA, variantId);
  if (fallback) return fallback as unknown as IntervalRecipe;
  // No variants declared on the schema (defensive): keep the traditional
  // layout as the absolute last-resort default.
  return {
    boundsLayout: "row",
    boundsContent: "range",
    boundsDelimiter: ["(", ")"],
    boundsSeparator: ", ",
    boundsPrefix: "",
  };
}

export function recipeFor(opts: ColumnOptions["interval"] | undefined): IntervalRecipe {
  const base = baseRecipe(opts);
  // D30 — overlay explicitly-authored primitives ON TOP of the variant recipe
  // (author-primitive wins over author/theme variant). `?? base` so an unset
  // primitive defers to the variant; an explicit value (incl. `boundsMuted:
  // false`, which `??` preserves) overrides it. `boundsDelimiter` reassembles
  // from the open/close primitives.
  const i = opts;
  if (i == null) return base;
  return {
    boundsLayout:    i.boundsLayout    ?? base.boundsLayout,
    boundsContent:   i.boundsContent   ?? base.boundsContent,
    boundsSeparator: i.boundsSeparator ?? base.boundsSeparator,
    boundsPrefix:    i.boundsPrefix    ?? base.boundsPrefix,
    boundsDelimiter: [
      i.boundsOpen  ?? base.boundsDelimiter[0],
      i.boundsClose ?? base.boundsDelimiter[1],
    ],
    boundsMuted:     i.boundsMuted     ?? base.boundsMuted,
  };
}

const intervalRenderer: CellFormatter = (_value, options, ctx) => {
  const opts = options as ColumnOptions | undefined;
  const i = opts?.interval;
  const meta = (ctx?.row ?? {}) as Record<string, unknown>;

  const pointField = i?.point;
  const lowerField = i?.lower;
  const upperField = i?.upper;
  const point = pointField ? (meta[pointField] as number | undefined) : undefined;
  const lower = lowerField ? (meta[lowerField] as number | undefined) : undefined;
  const upper = upperField ? (meta[upperField] as number | undefined) : undefined;

  // Non-finite guard (matches formatters.ts::_formatIntervalImpl — this is the
  // render-tree twin): ±Infinity must short-circuit to naText like NaN, not
  // build a malformed interval out of empty formatNumber() pieces.
  if (point === undefined || point === null || !Number.isFinite(point)) {
    return text(opts?.naText ?? "");
  }

  const sep = i?.separator ?? i?.sep ?? " ";
  const impreciseThreshold = i?.impreciseThreshold;

  const numOpts: ColumnOptions = {
    numeric: {
      decimals: i?.decimals,
      digits: i?.digits,
      thousandsSep: i?.thousandsSep,
      abbreviate: i?.abbreviate,
    },
  };
  const fmt = (v: number) => formatNumber(v, numOpts);

  if (
    lower === undefined || lower === null ||
    upper === undefined || upper === null ||
    !Number.isFinite(lower) || !Number.isFinite(upper)
  ) {
    return text(fmt(point));
  }

  if (impreciseThreshold != null && lower > 0 && upper / lower > impreciseThreshold) {
    return text("—");
  }

  const recipe = recipeFor(i);

  // Bounds content: either the full range (lower, upper) joined by the
  // recipe's separator, or the half-width derived from the bounds.
  const boundsChildren: RenderNode[] = [];
  if (recipe.boundsDelimiter[0]) boundsChildren.push(text(recipe.boundsDelimiter[0]));
  if (recipe.boundsPrefix)       boundsChildren.push(text(recipe.boundsPrefix));
  if (recipe.boundsContent === "half_width") {
    boundsChildren.push(text(fmt((upper - lower) / 2)));
  } else {
    boundsChildren.push(text(fmt(lower)));
    if (recipe.boundsSeparator) boundsChildren.push(text(recipe.boundsSeparator));
    boundsChildren.push(text(fmt(upper)));
  }
  if (recipe.boundsDelimiter[1]) boundsChildren.push(text(recipe.boundsDelimiter[1]));

  let bounds: RenderNode = tag(
    { kind: "group", layout: "row", children: boundsChildren },
    "interval-range",
  ) as RenderGroup;
  // "muted" variants render the bounds in minor/secondary text. withStyle
  // recurses into the group's text children (same overlay compose({minor})
  // uses); a theme can still re-target the `interval-range` tag on top.
  if (recipe.boundsMuted) {
    bounds = withStyle(bounds, { size: "minor", color: "muted" });
  }

  return {
    kind: "group",
    layout: recipe.boundsLayout,
    children: recipe.boundsLayout === "column"
      ? [text(fmt(point)), bounds]
      : [text(fmt(point)), text(sep), bounds],
  } as RenderNode;
};

/** Idempotent re-register helper for tests after registry reset. */
export function registerIntervalRenderer(): void {
  // One implementation, both runtimes — text composition is naturally
  // runtime-agnostic; theme nodeRules overlay both identically.
  registerRenderers("interval", {
    dom: intervalRenderer,
    svg: intervalRenderer,
  });
}

// Side-effect: register on first import.
registerIntervalRenderer();
