// Pure filter + sort helpers — index-based view onto a canonical rows
// array. The original `spec.data.rows[]` is never re-allocated; sort
// and filter produce reordered/narrowed `number[]` of indices into it.
//
// This keystone enables condition vectors and per-row banks to key
// against original row index without misalignment under sort/filter
// (see schema-sprint Phase 1). It also drops the per-render `Row[]`
// allocation that the eager-merge model used to do — paint-tool overlay
// merges move to lazy `rowAt(i)` in the sort-filter slice.
//
// All functions in this file are module-pure: no runes, no store
// access. Inputs are `(rows, indices, …)`, outputs are fresh
// `number[]`. The slice imports them; the column-filter UI and other
// consumers (paginate-by, export-time reordering) can do the same.
//
// Predicates and sort-key extraction read from the canonical row
// (`rows[i]`) — they do NOT see paint-tool overlay style, by design.
// Sorting on bold/italic/color is not a valid use case; predicates
// that need styling can layer above the slice's `rowAt(i)`.

import type {
  Row,
  ColumnSpec,
  ColumnGroup,
  ColumnFilter,
  FiltersState,
  SortConfig,
} from "$types";
import { dispatchForColumn } from "../schema/dispatch";

/**
 * Filter `indices` down to those whose row passes every column filter
 * (AND across columns). Filters with no predicate matches (e.g. empty
 * "in" array) pass everything.
 */
export function applyFilters(
  rows: readonly Row[],
  indices: readonly number[],
  state: FiltersState,
): number[] {
  const filterList = Object.values(state);
  if (filterList.length === 0) return indices.slice();
  const out: number[] = [];
  for (const i of indices) {
    const row = rows[i];
    if (filterList.every((f) => matchColumnFilter(row, f))) out.push(i);
  }
  return out;
}

/** Read a field from `row.metadata`, falling back to the row itself for
 *  the few synthetic fields (`label`, `groupId`) that live on the Row
 *  object rather than in metadata. */
export function readField(row: Row, field: string): unknown {
  return row.metadata[field] ?? (row as unknown as Record<string, unknown>)[field];
}

export function matchColumnFilter(row: Row, f: ColumnFilter): boolean {
  const value = readField(row, f.field);
  switch (f.operator) {
    case "contains":
      if (value == null) return false;
      return String(value).toLowerCase().includes(String(f.value ?? "").toLowerCase());
    case "eq":
      return value === f.value;
    case "neq":
      return value !== f.value;
    case "gt":
      return typeof value === "number" && typeof f.value === "number" && value > f.value;
    case "lt":
      return typeof value === "number" && typeof f.value === "number" && value < f.value;
    case "gte":
      return typeof value === "number" && typeof f.value === "number" && value >= f.value;
    case "lte":
      return typeof value === "number" && typeof f.value === "number" && value <= f.value;
    case "between": {
      // `typeof NaN === "number"`, but NaN is not IN any range — its `< lo`
      // and `> hi` tests are both false, so it would spuriously PASS. Exclude
      // it, matching gt/lt/gte/lte (which reject NaN via their comparisons).
      if (typeof value !== "number" || !Number.isFinite(value)) return false;
      const range = f.value as [number | null, number | null] | null | undefined;
      if (!range) return true;
      const [lo, hi] = range;
      if (lo != null && value < lo) return false;
      if (hi != null && value > hi) return false;
      return true;
    }
    case "in": {
      const arr = f.value as unknown[] | null | undefined;
      if (!arr || arr.length === 0) return true;
      return arr.includes(value);
    }
    case "empty":
      return value == null || value === "";
    case "notEmpty":
      return !(value == null || value === "");
    default:
      return true;
  }
}

/**
 * Walk `spec.columns` (including ColumnGroup descendants) and return the
 * first ColumnSpec whose `id` or `field` matches `key`. Used by the sort
 * path to resolve the clicked column back to its type + options, which
 * drives value extraction for multi-field column types.
 */
export function findColumnByKey(
  defs: (ColumnSpec | ColumnGroup)[],
  key: string,
): ColumnSpec | undefined {
  for (const d of defs) {
    if ("isGroup" in d && (d as unknown as ColumnGroup).isGroup) {
      const grp = d as unknown as ColumnGroup;
      const hit = findColumnByKey(grp.columns as unknown as (ColumnSpec | ColumnGroup)[], key);
      if (hit) return hit;
      continue;
    }
    const spec = d as ColumnSpec;
    if (spec.id === key || spec.field === key) return spec;
  }
  return undefined;
}

/**
 * Extract the scalar value used to sort a row by a given column.
 *
 * Schema dispatch is consulted first via `SchemaBehaviors.sortKey` —
 * multi-field column types (interval, viz_*, events) register their
 * own sort-key logic in `schema/columns/sort-behaviors.ts`. When no
 * schema in the inheritance chain defines `sortKey`, we fall back to
 * a bare `meta[col.field]` lookup, which serves every scalar type
 * (text, numeric, percent, …) and the no-column case.
 */
function sortValueFor(col: ColumnSpec | undefined, row: Row, key: string): unknown {
  const meta = row.metadata as Record<string, unknown>;
  const bare = meta[key] ?? (row as unknown as Record<string, unknown>)[key];
  if (!col) return bare;

  const sortKey = dispatchForColumn(col, "sortKey");
  if (sortKey) {
    return sortKey(meta[col.field], col.options, { row: meta });
  }
  return bare;
}

function compareForSort(aVal: unknown, bVal: unknown, desc: boolean): number {
  // Push undefined to the end regardless of direction.
  const aMissing = aVal == null || (typeof aVal === "number" && !Number.isFinite(aVal));
  const bMissing = bVal == null || (typeof bVal === "number" && !Number.isFinite(bVal));
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  let comparison = 0;
  if (typeof aVal === "number" && typeof bVal === "number") comparison = aVal - bVal;
  else if (typeof aVal === "string" && typeof bVal === "string") comparison = aVal.localeCompare(bVal);
  return desc ? -comparison : comparison;
}

/**
 * Sort the supplied indices by the column's sort key. Returns a fresh
 * array; inputs are not mutated.
 */
export function applySort(
  rows: readonly Row[],
  indices: readonly number[],
  config: SortConfig,
  col: ColumnSpec | undefined,
): number[] {
  const sorted = indices.slice();
  const { column, direction } = config;
  const desc = direction === "desc";
  sorted.sort((ai, bi) =>
    compareForSort(
      sortValueFor(col, rows[ai], column),
      sortValueFor(col, rows[bi], column),
      desc,
    ),
  );
  return sorted;
}

/**
 * Sort within each group bucket so grouping structure is preserved —
 * rows sharing a groupId stay contiguous, and bucket order matches
 * first-appearance in the input. Operates on indices; predicates read
 * the canonical row via `rows[i]`.
 */
export function applySortWithinGroups(
  rows: readonly Row[],
  indices: readonly number[],
  config: SortConfig,
  col: ColumnSpec | undefined,
): number[] {
  const buckets = new Map<string, { positions: number[]; indices: number[] }>();
  const bucketOrder: string[] = [];
  indices.forEach((rowIdx, slot) => {
    const key = rows[rowIdx].groupId ?? "__root__";
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { positions: [], indices: [] };
      buckets.set(key, bucket);
      bucketOrder.push(key);
    }
    bucket.positions.push(slot);
    bucket.indices.push(rowIdx);
  });

  const result: number[] = new Array(indices.length);
  for (const key of bucketOrder) {
    const { positions, indices: bucketIndices } = buckets.get(key)!;
    const sortedBucket = applySort(rows, bucketIndices, config, col);
    positions.forEach((pos, i) => {
      result[pos] = sortedBucket[i];
    });
  }
  return result;
}
