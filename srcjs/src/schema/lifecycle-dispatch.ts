// Lifecycle hook dispatcher (schema-sprint Phase 7).
//
// Wires `registerLifecycle` so the four hook kinds finally fire:
//
//   onColumnCreate(column, widget) — every time a column is added
//   onColumnDestroy(column, widget) — every time one is removed
//   onFirstPresent(widget)          — first instance of a schema appears
//   onLastRemoved(widget)            — last instance of a schema is gone
//
// The dispatcher tracks two pieces of state across calls:
//   - `prev`: the prior column-id set (for added/removed diffs)
//   - `present`: per-schema instance counts (for first/last diffs)
//   - `cleanups`: cleanup functions returned by onColumnCreate /
//     onFirstPresent, indexed so the matching destroy/removed firing
//     can call them
//
// Stateless callers can ignore the dispatcher entirely; it's the
// glue between the runtime registry (`extend.ts::lifecycles`) and
// the widget host's spec-update path. TabvizPlot.svelte (browser)
// invokes `dispatchLifecycle` from its `$effect` on `allColumns`;
// SVG export doesn't trigger lifecycle (no mount/unmount semantics
// in the static path).

import type { ColumnSpec, ColumnDef, ColumnGroup } from "../types";
import type { WidgetContext, Cleanup } from "./render-types";
import { findSchemaForColumn } from "./dispatch";
import { getLifecycle } from "./extend";

/** Flatten ColumnGroup descendants out so callers walk a flat list. */
function flattenColumns(defs: ColumnDef[]): ColumnSpec[] {
  const out: ColumnSpec[] = [];
  for (const d of defs) {
    if ((d as ColumnGroup).isGroup) {
      out.push(...flattenColumns((d as ColumnGroup).columns));
    } else {
      out.push(d as ColumnSpec);
    }
  }
  return out;
}

/** Per-cell cleanup keyed by column id. */
type ColumnCleanups = Map<string, Cleanup>;
/** Per-schema cleanup keyed by schema key. */
type SchemaCleanups = Map<string, Cleanup>;

export interface LifecycleState {
  /** Last-seen column ids in iteration order. */
  prev: string[];
  /** Last-seen full ColumnSpec map by id — for invoking destroy hooks
   *  with the column that's leaving. */
  prevSpecs: Map<string, ColumnSpec>;
  /** Per-schema instance count. */
  presence: Map<string, number>;
  /** Cleanups returned by onColumnCreate, keyed by column id. */
  columnCleanups: ColumnCleanups;
  /** Cleanups returned by onFirstPresent, keyed by schema key. */
  schemaCleanups: SchemaCleanups;
}

export function createLifecycleState(): LifecycleState {
  return {
    prev: [],
    prevSpecs: new Map(),
    presence: new Map(),
    columnCleanups: new Map(),
    schemaCleanups: new Map(),
  };
}

/**
 * Diff the column set, fire the matching hooks, and return new state.
 * Pure-ish: mutates `state` in place (state is meant to live in a
 * store slice). Safe to call repeatedly with stable inputs (no-op).
 *
 * Order:
 *   1. onColumnDestroy for removed columns
 *   2. onLastRemoved for schemas whose instance count went to 0
 *   3. onFirstPresent for schemas whose instance count went from 0
 *   4. onColumnCreate for new columns
 *
 * Destroy/removed run first so cleanups complete before a new
 * instance of the same schema mounts.
 */
export function dispatchLifecycle(
  state: LifecycleState,
  columns: ColumnDef[],
  widget: WidgetContext,
): void {
  const flat = flattenColumns(columns);
  const currentIds = flat.map((c) => c.id);
  const currentIdSet = new Set(currentIds);
  const prevIdSet = new Set(state.prev);

  // 1. Removed columns
  for (const id of state.prev) {
    if (currentIdSet.has(id)) continue;
    const col = state.prevSpecs.get(id);
    if (!col) continue;
    const cleanup = state.columnCleanups.get(id);
    if (cleanup) {
      try { cleanup(); } catch { /* swallow per-hook errors */ }
      state.columnCleanups.delete(id);
    }
    const schema = findSchemaForColumn(col);
    if (schema) {
      const hooks = getLifecycle(schema.key);
      if (hooks?.onColumnDestroy) {
        try { hooks.onColumnDestroy(col, widget); } catch { /* swallow */ }
      }
      const count = (state.presence.get(schema.key) ?? 0) - 1;
      if (count <= 0) {
        state.presence.delete(schema.key);
        // onLastRemoved
        const schemaCleanup = state.schemaCleanups.get(schema.key);
        if (schemaCleanup) {
          try { schemaCleanup(); } catch { /* swallow */ }
          state.schemaCleanups.delete(schema.key);
        }
        if (hooks?.onLastRemoved) {
          try { hooks.onLastRemoved(widget); } catch { /* swallow */ }
        }
      } else {
        state.presence.set(schema.key, count);
      }
    }
  }

  // 2. Added columns
  for (const col of flat) {
    if (prevIdSet.has(col.id)) continue;
    const schema = findSchemaForColumn(col);
    if (!schema) continue;
    const hooks = getLifecycle(schema.key);
    const count = state.presence.get(schema.key) ?? 0;
    if (count === 0) {
      // onFirstPresent
      if (hooks?.onFirstPresent) {
        try {
          const ret = hooks.onFirstPresent(widget);
          if (typeof ret === "function") state.schemaCleanups.set(schema.key, ret);
        } catch { /* swallow */ }
      }
    }
    state.presence.set(schema.key, count + 1);
    if (hooks?.onColumnCreate) {
      try {
        const ret = hooks.onColumnCreate(col, widget);
        if (typeof ret === "function") state.columnCleanups.set(col.id, ret);
      } catch { /* swallow */ }
    }
  }

  // 3. Update state for next dispatch.
  state.prev = currentIds;
  state.prevSpecs = new Map(flat.map((c) => [c.id, c]));
}
