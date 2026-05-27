// Aggregate behaviors — type-dispatched roll-ups for grouped rows
// and per-column summaries.
//
// The numeric aggregate is the workhorse used by Phase 4c's
// bar / heatmap column-summary path; it returns the full set of
// scalars renderers might need. Categorical / ordinal aggregates
// (mode, level-median) will register in Phase 6 alongside their
// declared semantics.
//
// Signature (from SchemaBehaviors):
//   aggregate?: (values: unknown[], options, parents) => unknown
//
// The return value's shape is schema-specific. `numeric.aggregate`
// returns a stable struct; consumers pick the field they need.

import { registerBehaviors } from "../extend";

export interface NumericSummary {
  count: number;
  sum: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
}

const EMPTY: NumericSummary = {
  count: 0, sum: 0, mean: null, median: null, min: null, max: null,
};

export function summarizeNumeric(values: unknown[]): NumericSummary {
  const clean: number[] = [];
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) clean.push(v);
  }
  const n = clean.length;
  if (n === 0) return EMPTY;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const v of clean) {
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  clean.sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  const median = n % 2 === 0 ? (clean[mid - 1] + clean[mid]) / 2 : clean[mid];
  return { count: n, sum, mean: sum / n, median, min, max };
}

/** Idempotent re-register helper. */
export function registerAggregateBehaviors(): void {
  registerBehaviors("numeric", {
    aggregate: (values) => summarizeNumeric(values),
  });
}

registerAggregateBehaviors();
