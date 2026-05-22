// Authoring-side helpers for conditions.
//
// `condition()` is the constructor — given a name + a per-row rule
// function, it evaluates against the data and produces a
// ConditionEntry with the boolean vector pinned. The renderer never
// re-evaluates; spec changes (data, columns) require rebuilding.
//
// `cond()` is the reference helper — used inside styleMapping fields
// to point at a named condition. (Lives in styling.ts to avoid
// circular import.)

import type { ConditionEntry } from "./banks";

interface DataLike {
  rows?: Array<{ metadata?: Record<string, unknown> }>;
}

/**
 * Per-row condition rule. Receives the row's metadata + the full
 * row list (for whole-table-aware rules like Bonferroni).
 */
export type ConditionRule = (
  row: Record<string, unknown>,
  rows: Array<Record<string, unknown>>,
) => boolean;

export interface ConditionArgs {
  name: string;
  rule: ConditionRule;
  label?: string;
  category?: string;
  /**
   * Optional rule-text for round-trip / display. If omitted, we
   * stringify `rule` (which yields its `toString()` body). Authors
   * can override for nicer display.
   */
  ruleText?: string;
}

/**
 * Build a ConditionEntry by evaluating the rule against the supplied
 * data. Calls expect data to be passed at construction; the entry's
 * `values` array is the materialized truth-of-the-moment.
 *
 * Most callers won't invoke this directly — `tabviz({ conditions })`
 * threads the data automatically. Direct use is for tests or for
 * authoring outside the tabviz() pipeline.
 */
export function condition(args: ConditionArgs, data: DataLike): ConditionEntry {
  const rows = (data.rows ?? []).map((r) => r.metadata ?? {});
  const values = rows.map((row) => {
    try {
      return Boolean(args.rule(row, rows));
    } catch {
      return false;  // Rule threw — treat as falsy. Phase 7 may warn.
    }
  });

  return {
    id: args.name,
    label: args.label ?? args.name,
    kind: "boolean",
    values,
    ruleText: args.ruleText ?? args.rule.toString(),
    category: args.category,
  };
}

/**
 * Convenience for the `tabviz({ conditions })` arg shape: the author
 * passes ConditionArgs entries (un-evaluated), and the tabviz()
 * constructor evaluates them once data is bound.
 */
export type ConditionAuthoring = ConditionArgs;

/**
 * Evaluate a list of authored ConditionArgs against the data. Used
 * inside tabviz() to materialize ConditionEntry values for the
 * `banks.conditions` wire field.
 */
export function evaluateConditions(
  authoring: ConditionAuthoring[],
  data: DataLike,
): ConditionEntry[] {
  return authoring.map((a) => condition(a, data));
}
