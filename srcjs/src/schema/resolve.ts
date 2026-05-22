// Schema-inheritance resolver.
//
// A column schema's `inherits` declares its parent(s) — single key or
// array. The resolver walks the DAG transitively and topo-sorts the
// reachable schemas so ancestors come before descendants.
//
// Multi-inheritance is real and load-bearing here. TEXT inherits both
// BASE (layout) and SORTABLE (capability). A future RING column will
// inherit both PICTOGRAM (the SVG glyph) and PERCENT (the text label
// next to the ring). The resolver is a DAG walk — no parent-pointer
// trees that would force these into a single chain.
//
// Cycles fail loud.

import type { ColumnSchema } from "./types";
import { SCHEMA_REGISTRY } from "./columns";
import { getSchema } from "./extend";

/** Normalize `inherits` to a string[] (handles single-string form). */
function parents(schema: ColumnSchema): string[] {
  const i = schema.inherits;
  if (i == null) return [];
  return typeof i === "string" ? [i] : i;
}

/**
 * Resolve a schema's effective ancestry: itself + every reachable
 * ancestor, topo-sorted (BASE-most first, leaf-most last).
 *
 * For abstract schemas this is mostly internal use; for concrete
 * schemas it's what the editor and codegen iterate to compute the
 * effective option list.
 *
 * Reads schemas via `getSchema()` so user-registered schemas (added
 * at runtime via `registerSchema`) are resolved alongside built-ins.
 */
export function resolveSchema(schema: ColumnSchema): ColumnSchema[] {
  const reachable = new Map<string, ColumnSchema>();
  const visit = (key: string, stack: string[]): void => {
    if (reachable.has(key)) return;
    if (stack.includes(key)) {
      throw new Error(`Schema inheritance cycle: ${[...stack, key].join(" -> ")}`);
    }
    const s = getSchema(key);
    if (!s) throw new Error(`Unknown schema "${key}" referenced from ${schema.key}`);
    for (const dep of parents(s)) visit(dep, [...stack, key]);
    reachable.set(key, s);
  };
  visit(schema.key, []);

  // Topological sort: emit a node only after its ancestors. For ties
  // (e.g. multi-inheritance siblings BASE + SORTABLE both reachable
  // from TEXT), emit in declaration order from the inherits list.
  const result: ColumnSchema[] = [];
  const emitted = new Set<string>();
  const emit = (key: string): void => {
    if (emitted.has(key)) return;
    const s = reachable.get(key)!;
    for (const dep of parents(s)) emit(dep);
    result.push(s);
    emitted.add(key);
  };
  emit(schema.key);

  return result;
}

export { SCHEMA_REGISTRY };
