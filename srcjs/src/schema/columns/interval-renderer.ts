// Cell renderer for the `interval` schema.
//
// Phase 7e text-composition exemplar: produces a tagged RenderNode
// tree, identical for browser + SVG export. Theme `nodeRules` can
// restyle the bounds via the `interval-range` tag without the
// renderer knowing anything about colors or sizes.
//
// Output shape:
//
//     group{ children: [
//       text "0.85",                         // point estimate
//       text " ",                            // separator (configurable)
//       group{ tags: ["interval-range"],     // bounds, theme-targetable
//         children: [text "(", text "0.72", text ", ", text "0.99", text ")"]
//       },
//     ]}
//
// Edge cases preserved verbatim from the legacy `formatInterval`:
// - Missing point → `naText`
// - Missing bounds → just the point
// - Imprecise threshold tripped → "—"
//
// Multi-field reads: the dispatcher passes `value = meta[col.field]`,
// but interval needs point/lower/upper from three separate fields.
// We read those via `ctx.row`, which the caller (TabvizPlot /
// svg-generator) populates with `row.metadata`.

import type { ColumnOptions } from "../../types";
import type { RenderNode, RenderText, RenderGroup, CellFormatter } from "../render-types";
import { registerRenderers } from "../extend";
import { formatNumber } from "../../lib/formatters";
import { tag } from "../theme-finalize";

function text(value: string): RenderText {
  return { kind: "text", value };
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

  if (point === undefined || point === null || Number.isNaN(point)) {
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
    Number.isNaN(lower) || Number.isNaN(upper)
  ) {
    return text(fmt(point));
  }

  if (impreciseThreshold != null && lower > 0 && upper / lower > impreciseThreshold) {
    return text("—");
  }

  // Variant dispatch — declared in INTERVAL_SCHEMA.variants; this is
  // the only place that consumes the value. Wire: `options.interval.variant`.
  const variant = (i?.variant as string | undefined) ?? "traditional";

  if (variant === "plus_minus") {
    // Half-width; if bounds aren't symmetric, fall back to half-range.
    const halfWidth = (upper - lower) / 2;
    const symPart = tag(
      { kind: "group", layout: "row",
        children: [text("± "), text(fmt(halfWidth))] },
      "interval-range",
    ) as RenderGroup;
    return {
      kind: "group", layout: "row",
      children: [text(fmt(point)), text(sep), symPart],
    } as RenderNode;
  }

  // `bracket_muted` swaps the parens for square brackets and the comma
  // for an en-dash; theming controls the muted-ness via the tag overlay.
  const useBrackets = variant === "bracket_muted";
  const openB  = useBrackets ? "[" : "(";
  const closeB = useBrackets ? "]" : ")";
  const inner  = useBrackets ? "–" : ", ";

  const bounds: RenderGroup = tag(
    {
      kind: "group",
      layout: "row",
      children: [
        text(openB),
        text(fmt(lower)),
        text(inner),
        text(fmt(upper)),
        text(closeB),
      ],
    },
    "interval-range",
  ) as RenderGroup;

  // `stacked` puts the point on one line and the bounds on the next.
  if (variant === "stacked") {
    return {
      kind: "group",
      layout: "column",
      children: [text(fmt(point)), bounds],
    } as RenderNode;
  }

  // Default ("traditional") layout: point sep bounds, inline row.
  return {
    kind: "group",
    layout: "row",
    children: [text(fmt(point)), text(sep), bounds],
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
