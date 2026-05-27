// Resolve a column's styleMapping into a per-row CellStyle, honoring
// all four MappedValue modes plus the legacy bare-string field form.
//
// Schema-sprint Phase 5: this is the consumer side of styleMapping +
// conditions. The two dispatch sites (TabvizPlot.svelte browser path,
// svg-generator.ts export path) call this once per cell + column to
// build the cellStyle they pass into ctx.cellStyle. Renderers see a
// fully-resolved CellStyle — they don't know or care which mode
// produced it.
//
// Resolution per styleMapping field:
//
//   { kind: "theme" }       → no override; field stays undefined
//   { kind: "static", v }   → use v directly
//   { kind: "field", f }    → row.metadata[f] coerced to the field type
//   { kind: "condition", n} → banks.conditions[n].values[rowIndex]
//   bare string (legacy)    → same as { kind: "field", field: <str> }
//
// Conditions are static within a spec lifetime (Phase 5 guarantee);
// row index points into the canonical `spec.data.rows[]` so sort /
// filter reorderings don't misalign values (Phase 1 keystone).

import type { CellStyle, Row } from "../types";
import type { ColumnSpec } from "../types";
import type { EffectiveBanks, ConditionEntry } from "../schema/banks";
import {
  normalizeStyle,
  type StyleOverride,
  type StyleMappingValue,
} from "../schema/styling";

function findCondition(
  banks: EffectiveBanks | null | undefined,
  name: string,
): ConditionEntry | undefined {
  return banks?.conditions?.find((c) => c.id === name);
}

function resolveBool(
  v: StyleOverride<boolean>,
  row: Row,
  rowIndex: number | undefined,
  banks: EffectiveBanks | null | undefined,
): boolean | undefined {
  const norm = normalizeStyle<boolean>(v);
  let resolved: boolean | undefined;
  switch (norm.kind) {
    case "theme": resolved = undefined; break;
    case "static": resolved = norm.value; break;
    case "field": {
      const fv = row.metadata[norm.field];
      resolved = fv == null ? undefined : Boolean(fv);
      break;
    }
    case "condition": {
      const c = findCondition(banks, norm.name);
      resolved = c && rowIndex != null ? Boolean(c.values[rowIndex]) : undefined;
      break;
    }
  }
  // Boolean styleMapping fields are additive — `false` means "no
  // override" rather than "explicitly off" (CellStyle defaults to all
  // tokens absent). Compress falsy to undefined so the caller doesn't
  // set explicit `false` on the cell, matching legacy behavior.
  return resolved ? resolved : undefined;
}

function resolveString(
  v: StyleOverride<string>,
  row: Row,
  rowIndex: number | undefined,
  banks: EffectiveBanks | null | undefined,
): string | undefined {
  const norm = normalizeStyle<string>(v);
  switch (norm.kind) {
    case "theme": return undefined;
    case "static": return norm.value;
    case "field": {
      const fv = row.metadata[norm.field];
      return fv == null ? undefined : String(fv);
    }
    case "condition": {
      // String style mapped through a boolean condition: the condition
      // value is boolean — there's no string to project. Return
      // undefined; authors who want "color when condition" should use
      // a condition-aware token (emphasis / muted / accent) instead.
      void findCondition(banks, norm.name);
      return undefined;
    }
  }
}

/**
 * Build a CellStyle from a column's styleMapping for a single row.
 * Returns `undefined` when no mapping fields resolve to a value (so
 * callers can short-circuit without allocating an empty object).
 *
 * The returned style is `undefined`-conservative: properties that
 * resolved to undefined are simply not set on the object, so callers
 * can merge over them without clobbering pre-existing values.
 */
export function resolveStyleMapping(
  row: Row,
  rowIndex: number | undefined,
  column: ColumnSpec,
  banks: EffectiveBanks | null | undefined,
): CellStyle | undefined {
  const sm = (column as ColumnSpec & { styleMapping?: Record<string, unknown> }).styleMapping;
  if (!sm) return undefined;
  const out: CellStyle = {};
  let touched = false;

  const setBool = (k: keyof CellStyle, v: boolean | undefined) => {
    if (v == null) return;
    (out as Record<string, unknown>)[k] = v;
    touched = true;
  };
  const setString = (k: keyof CellStyle, v: string | undefined) => {
    if (v == null) return;
    (out as Record<string, unknown>)[k] = v;
    touched = true;
  };

  setBool("bold",     resolveBool(sm.bold     as StyleOverride<boolean>, row, rowIndex, banks));
  setBool("italic",   resolveBool(sm.italic   as StyleOverride<boolean>, row, rowIndex, banks));
  setBool("emphasis", resolveBool(sm.emphasis as StyleOverride<boolean>, row, rowIndex, banks));
  setBool("muted",    resolveBool(sm.muted    as StyleOverride<boolean>, row, rowIndex, banks));
  setBool("accent",   resolveBool(sm.accent   as StyleOverride<boolean>, row, rowIndex, banks));
  setBool("fill",     resolveBool(sm.fill     as StyleOverride<boolean>, row, rowIndex, banks));

  setString("color",   resolveString(sm.color   as StyleOverride<string>, row, rowIndex, banks));
  setString("bg",      resolveString(sm.bg      as StyleOverride<string>, row, rowIndex, banks));
  setString("badge",   resolveString(sm.badge   as StyleOverride<string>, row, rowIndex, banks));
  setString("icon",    resolveString(sm.icon    as StyleOverride<string>, row, rowIndex, banks));
  setString("tooltip", resolveString(sm.tooltip as StyleOverride<string>, row, rowIndex, banks));

  return touched ? out : undefined;
}

/** Convenience export for tests that want to exercise the per-kind
 *  resolvers in isolation. */
export const __testing = { resolveBool, resolveString };
export type { StyleMappingValue };
