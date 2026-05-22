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

// Numeric median of a possibly-sparse array. Used as the sort key for
// boxplot / violin columns where the "value" is a distribution rather than
// a single scalar. Ignores NaN / non-finite entries.
function median(xs: readonly number[]): number | undefined {
  const clean = xs.filter((v) => typeof v === "number" && Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (clean.length === 0) return undefined;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 0 ? (clean[mid - 1] + clean[mid]) / 2 : clean[mid];
}

/**
 * Extract the scalar value used to sort a row by a given column. Handles
 * the multi-field column types whose `.field` is synthetic and doesn't
 * index `row.metadata` directly:
 *
 *   - `forest`: first declared point field (inline `point` or the first
 *     effect's `pointCol`).
 *   - `interval`: `options.interval.point`.
 *   - `custom` with events options: the `eventsField`.
 *   - `viz_bar`: first effect's `value`.
 *   - `viz_boxplot`: first effect's `median` (stats mode) or the median
 *     of its `data` array (array mode).
 *   - `viz_violin`: median of the first effect's `data` array.
 *
 * Falls back to `row.metadata[col.field]` for the scalar column types.
 * Returning `undefined` lets `compareForSort` push the row to the end.
 */
function sortValueFor(col: ColumnSpec | undefined, row: Row, key: string): unknown {
  const meta = row.metadata as Record<string, unknown>;
  const bare = () => meta[key] ?? (row as unknown as Record<string, unknown>)[key];
  if (!col) return bare();

  const opts = col.options as Record<string, unknown> | undefined;
  const forestOpts = (opts?.forest ?? null) as {
    point?: string;
    effects?: Array<{ pointCol?: string }>;
  } | null;
  const intervalOpts = (opts?.interval ?? null) as { point?: string } | null;
  const eventsOpts = (opts?.events ?? null) as { eventsField?: string } | null;
  const barEffects = (opts?.vizBar as { effects?: Array<{ value?: string }> } | undefined)?.effects;
  const boxEffects = (opts?.vizBoxplot as {
    effects?: Array<{ median?: string | null; data?: string | null }>;
  } | undefined)?.effects;
  const violinEffects = (opts?.vizViolin as {
    effects?: Array<{ data?: string }>;
  } | undefined)?.effects;

  switch (col.type) {
    case "forest": {
      const f = forestOpts?.point ?? forestOpts?.effects?.[0]?.pointCol;
      return f ? meta[f] : bare();
    }
    case "interval": {
      const f = intervalOpts?.point;
      return f ? meta[f] : bare();
    }
    case "custom": {
      const f = eventsOpts?.eventsField;
      return f ? meta[f] : bare();
    }
    case "viz_bar": {
      const f = barEffects?.[0]?.value;
      return f ? meta[f] : bare();
    }
    case "viz_boxplot": {
      const eff = boxEffects?.[0];
      if (!eff) return bare();
      if (eff.median) return meta[eff.median];
      if (eff.data) {
        const arr = meta[eff.data];
        if (Array.isArray(arr)) return median(arr as number[]);
      }
      return undefined;
    }
    case "viz_violin": {
      const f = violinEffects?.[0]?.data;
      if (!f) return bare();
      const arr = meta[f];
      if (Array.isArray(arr)) return median(arr as number[]);
      return undefined;
    }
    default:
      return bare();
  }
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
