// Sort-key behaviors for the multi-field column schemas.
//
// For scalar column types (text, numeric, percent, …) the sort key is
// simply `meta[col.field]` and no behavior is needed — the dispatcher
// returns undefined and the caller falls back to that bare lookup.
//
// The schemas below have synthetic `.field` values and must read one
// or more concrete fields from `ctx.row`:
//
//   viz_forest      — first declared point field (inline or first effect)
//   interval        — options.interval.point
//   events (custom) — options.events.eventsField
//   viz_bar         — first effect's `value` field
//   viz_boxplot     — first effect's `median` (stats mode) or median(data)
//   viz_violin      — median of first effect's `data` array
//
// Each behavior ignores the `value` arg (which would be meta[col.field]
// — meaningless for these) and reads from `ctx.row` instead.

import { registerBehaviors } from "../extend";

/** Re-register sort behaviors. Idempotent — safe to call after
 *  `__resetRuntimeRegistries()` to restore built-in wiring. */
export function registerSortBehaviors(): void {

type ForestOpts = {
  forest?: { point?: string; effects?: Array<{ pointCol?: string }> };
};
type IntervalOpts = { interval?: { point?: string } };
type EventsOpts = { events?: { eventsField?: string } };
type VizBarOpts = { vizBar?: { effects?: Array<{ value?: string }> } };
type VizBoxOpts = {
  vizBoxplot?: { effects?: Array<{ median?: string | null; data?: string | null }> };
};
type VizViolinOpts = { vizViolin?: { effects?: Array<{ data?: string }> } };

function median(xs: readonly unknown[]): number | null {
  const clean: number[] = [];
  for (const v of xs) if (typeof v === "number" && Number.isFinite(v)) clean.push(v);
  if (clean.length === 0) return null;
  clean.sort((a, b) => a - b);
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 0 ? (clean[mid - 1] + clean[mid]) / 2 : clean[mid];
}

function scalar(v: unknown): string | number | boolean | null {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  return null;
}

registerBehaviors("viz_forest", {
  sortKey: (_value, options, ctx) => {
    const o = (options as ForestOpts | undefined)?.forest;
    const f = o?.point ?? o?.effects?.[0]?.pointCol;
    return f ? scalar(ctx.row[f]) : null;
  },
});

registerBehaviors("interval", {
  sortKey: (_value, options, ctx) => {
    const f = (options as IntervalOpts | undefined)?.interval?.point;
    return f ? scalar(ctx.row[f]) : null;
  },
});

registerBehaviors("events", {
  sortKey: (_value, options, ctx) => {
    const f = (options as EventsOpts | undefined)?.events?.eventsField;
    return f ? scalar(ctx.row[f]) : null;
  },
});

registerBehaviors("viz_bar", {
  sortKey: (_value, options, ctx) => {
    const f = (options as VizBarOpts | undefined)?.vizBar?.effects?.[0]?.value;
    return f ? scalar(ctx.row[f]) : null;
  },
});

registerBehaviors("viz_boxplot", {
  sortKey: (_value, options, ctx) => {
    const eff = (options as VizBoxOpts | undefined)?.vizBoxplot?.effects?.[0];
    if (!eff) return null;
    if (eff.median) return scalar(ctx.row[eff.median]);
    if (eff.data) {
      const arr = ctx.row[eff.data];
      if (Array.isArray(arr)) return median(arr);
    }
    return null;
  },
});

registerBehaviors("viz_violin", {
  sortKey: (_value, options, ctx) => {
    const f = (options as VizViolinOpts | undefined)?.vizViolin?.effects?.[0]?.data;
    if (!f) return null;
    const arr = ctx.row[f];
    if (Array.isArray(arr)) return median(arr);
    return null;
  },
});

}  // end registerSortBehaviors

// Side-effect: register on first import (back-compat).
registerSortBehaviors();
