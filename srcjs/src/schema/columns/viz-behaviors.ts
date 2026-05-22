// Behavior wiring for the viz_* schemas.
//
// Each viz column contributes:
//   - one axis entry to WidgetBanks.axes (with the column's id
//     attached); represents "render an axis for this column"
//   - one legend entry if multi-effect (per-effect color/label items)
//
// Phase 7 renders these; Phase 3.5 just wires the lifecycle so the
// bank dispatcher walks them.
//
// Multi-column axis sharing (when several viz columns set
// sharedAxis=true and have compatible ranges) is computed at render
// time via `computeSharedAxis` (existing) — the per-column entries
// here describe what each column needs in isolation; the Phase 7
// renderer merges them.

import type { ColumnSpec } from "../../types";
import { registerBehaviors } from "../extend";
import { derivedId, type AxisEntry, type LegendEntry, type BankContribution } from "../banks";

type ForestOpts = {
  point?: string | null;
  scale?: "linear" | "log";
  nullValue?: number | null;
  axisLabel?: string | null;
  axisRange?: [number, number] | null;
  axisTicks?: number[] | null;
  axisGridlines?: boolean;
  showAxis?: boolean;
  sharedAxis?: boolean;
  effects?: Array<{ id?: string; label?: string | null; color?: string | null }>;
};

type VizOpts<E> = {
  type?: string;
  effects?: E[];
  scale?: "linear" | "log";
  nullValue?: number | null;
  axisLabel?: string | null;
  axisRange?: [number, number] | null;
  axisTicks?: number[] | null;
  axisGridlines?: boolean;
  showAxis?: boolean;
};

type BarEffect     = { value?: string; label?: string | null; color?: string | null };
type BoxplotEffect = { data?: string | null; label?: string | null; color?: string | null };
type ViolinEffect  = { data?: string;       label?: string | null; color?: string | null };

function makeAxis(column: ColumnSpec, opts: VizOpts<unknown> | ForestOpts | undefined): AxisEntry {
  const range = (opts?.axisRange ?? [0, 1]) as [number, number];
  return {
    id: derivedId(column.id, "axis"),
    scale: opts?.scale ?? "linear",
    range,
    label: opts?.axisLabel ?? undefined,
    ticks: opts?.axisTicks ?? null,
    gridlines: opts?.axisGridlines ?? false,
    position: "bottom",
    attachedTo: [column.id],
  };
}

function makeLegend(
  column: ColumnSpec,
  effects: Array<{ label?: string | null; color?: string | null }>,
): LegendEntry | null {
  if (!effects || effects.length < 2) return null;
  return {
    id: derivedId(column.id, "legend"),
    items: effects.map((e, i) => ({
      label: e.label ?? `Series ${i + 1}`,
      color: e.color ?? "#666",
    })),
    attachedTo: [column.id],
  };
}

// ────────────────────────────────────────────────────────────────────
// viz_forest
// ────────────────────────────────────────────────────────────────────

registerBehaviors("viz_forest", {
  contributeBanks: (column: ColumnSpec): BankContribution => {
    const opts = (column.options as { forest?: ForestOpts } | undefined)?.forest;
    if (!opts) return {};
    const out: BankContribution = {};
    if (opts.showAxis !== false) {
      out.axes = [makeAxis(column, opts)];
    }
    const legend = makeLegend(column, opts.effects ?? []);
    if (legend) out.legends = [legend];
    return out;
  },
});

// ────────────────────────────────────────────────────────────────────
// viz_bar / viz_boxplot / viz_violin
// ────────────────────────────────────────────────────────────────────

registerBehaviors("viz_bar", {
  contributeBanks: (column: ColumnSpec): BankContribution => {
    const opts = (column.options as { vizBar?: VizOpts<BarEffect> } | undefined)?.vizBar;
    if (!opts) return {};
    const out: BankContribution = {};
    if (opts.showAxis !== false) out.axes = [makeAxis(column, opts)];
    const legend = makeLegend(column, opts.effects ?? []);
    if (legend) out.legends = [legend];
    return out;
  },
});

registerBehaviors("viz_boxplot", {
  contributeBanks: (column: ColumnSpec): BankContribution => {
    const opts = (column.options as { vizBoxplot?: VizOpts<BoxplotEffect> } | undefined)?.vizBoxplot;
    if (!opts) return {};
    const out: BankContribution = {};
    if (opts.showAxis !== false) out.axes = [makeAxis(column, opts)];
    const legend = makeLegend(column, opts.effects ?? []);
    if (legend) out.legends = [legend];
    return out;
  },
});

registerBehaviors("viz_violin", {
  contributeBanks: (column: ColumnSpec): BankContribution => {
    const opts = (column.options as { vizViolin?: VizOpts<ViolinEffect> } | undefined)?.vizViolin;
    if (!opts) return {};
    const out: BankContribution = {};
    if (opts.showAxis !== false) out.axes = [makeAxis(column, opts)];
    const legend = makeLegend(column, opts.effects ?? []);
    if (legend) out.legends = [legend];
    return out;
  },
});
