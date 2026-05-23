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

  // Bounds group, tagged for theme restyling via `interval-range`.
  const bounds: RenderGroup = tag(
    {
      kind: "group",
      layout: "row",
      children: [
        text("("),
        text(fmt(lower)),
        text(", "),
        text(fmt(upper)),
        text(")"),
      ],
    },
    "interval-range",
  ) as RenderGroup;

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
