// Pure filter + sort helpers, extracted from tabvizStore.svelte.ts during
// Phase 0c-C1 PR4 (sort-filter slice). No runes, no store access — just
// row-level operations consumed by `visibleRows` and the column-filter UI.
//
// Functions here are all module-pure; they take rows + config and return
// new arrays. The slice imports them; future consumers (e.g. paginate-by
// or export-time row reordering) can do the same.

import type {
  Row,
  ColumnSpec,
  ColumnGroup,
  ColumnFilter,
  FiltersState,
  SortConfig,
} from "$types";
import { dispatchForColumn } from "../schema/dispatch";

/** Apply all column filters AND-style across columns. Filters with no
 *  predicate matches (e.g. empty "in" array) pass everything. */
export function applyFilters(rows: Row[], state: FiltersState): Row[] {
  const filterList = Object.values(state);
  if (filterList.length === 0) return rows;
  return rows.filter((row) => filterList.every((f) => matchColumnFilter(row, f)));
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
      if (typeof value !== "number") return false;
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

function applySort(rows: Row[], config: SortConfig, col: ColumnSpec | undefined): Row[] {
  const sorted = [...rows];
  const { column, direction } = config;
  sorted.sort((a, b) =>
    compareForSort(
      sortValueFor(col, a, column),
      sortValueFor(col, b, column),
      direction === "desc",
    ),
  );
  return sorted;
}

/** Sort rows within each group bucket so grouping structure is preserved.
 *  Rows with the same groupId stay contiguous and retain their relative
 *  group order. */
export function applySortWithinGroups(
  rows: Row[],
  config: SortConfig,
  col: ColumnSpec | undefined,
): Row[] {
  const buckets = new Map<string, { positions: number[]; rows: Row[] }>();
  const bucketOrder: string[] = [];
  rows.forEach((row, idx) => {
    const key = row.groupId ?? "__root__";
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { positions: [], rows: [] };
      buckets.set(key, bucket);
      bucketOrder.push(key);
    }
    bucket.positions.push(idx);
    bucket.rows.push(row);
  });

  const result: Row[] = new Array(rows.length);
  for (const key of bucketOrder) {
    const { positions, rows: bucketRows } = buckets.get(key)!;
    const sortedBucket = applySort(bucketRows, config, col);
    positions.forEach((pos, i) => {
      result[pos] = sortedBucket[i];
    });
  }
  return result;
}
