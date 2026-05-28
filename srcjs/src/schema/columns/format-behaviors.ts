// formatValue behaviors — type-dispatched value→string transforms
// declared on SchemaBehaviors. Phase 6 schema-sprint: wires the
// `formatValue` slot for the schemas where it adds value, exposing a
// single dispatch point renderers and other consumers can call
// instead of importing `lib/formatters` directly.
//
// Current registrations:
//   - numeric: wraps `formatNumber` (handles percent / currency /
//     n / numeric variants via the existing options shape).
//   - percent / currency / n: delegate upward via the `parents`
//     proxy (they share NUMERIC's logic; the per-bucket options
//     drive the percent / currency / abbreviate variants).
//   - pvalue: wraps `formatPvalue`.
//
// Renderers can opt into the chain incrementally. The dispatcher
// (`dispatchForColumn(col, "formatValue")`) walks the inheritance
// DAG, so e.g. `percent`'s renderer can call
// `parents.numeric.formatValue(value, opts, ctx)` to reuse NUMERIC's
// logic without re-importing lib/formatters.

import type { ColumnOptions } from "../../types";
import { registerBehaviors } from "../extend";
import { formatNumber, formatPvalue } from "../../lib/formatters";

/** Re-register helper. Idempotent for `__resetRuntimeRegistries()`. */
export function registerFormatBehaviors(): void {
  registerBehaviors("numeric", {
    formatValue: (value, options) =>
      formatNumber(value as number | null | undefined, options as ColumnOptions),
  });

  // percent / currency / n: percent has its own bucket so it
  // disambiguates from numeric in findSchemaForColumn; the formatter
  // still reads options.percent / options.numeric.prefix etc., so
  // delegating up is correct.
  registerBehaviors("percent", {
    formatValue: (value, options, ctx, parents) => {
      // `parents.numeric` at runtime is the dispatcher's bound 3-arg
      // proxy (it injects its own parents internally); the TS type
      // surface still describes the unbound 4-arg signature. The cast
      // bridges that pre-existing gap.
      const parentNumeric = parents.numeric as unknown as
        | ((v: unknown, o: typeof options, c: typeof ctx) => string)
        | undefined;
      if (parentNumeric) return parentNumeric(value, options, ctx);
      return formatNumber(value as number | null | undefined, options as ColumnOptions);
    },
  });

  registerBehaviors("pvalue", {
    formatValue: (value, options) =>
      formatPvalue(value as number | null | undefined, options as ColumnOptions),
  });
}

// Side-effect: register on first import.
registerFormatBehaviors();
