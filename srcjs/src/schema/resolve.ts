// Layer-inheritance resolver.
//
// A column type's `layers` list is *declarations*: the distinctive
// layers the type wants. The resolver walks each layer's `inherits`
// chain transitively and returns the full ordered set, topologically
// sorted (BASE first, leaf-most last). The editor reverses to render
// the accordion specific-first per the design.
//
// Cycles fail loud — inheritance is acyclic by definition.

import type { ColumnTypeSpec, LayerSpec } from "./types";
import { BASE_LAYER } from "./layers/base";
import { TEXT_LAYER } from "./layers/text";
import { NUMERIC_LAYER } from "./layers/numeric";
import { PERCENT_LAYER } from "./layers/percent";
import { SORTABLE_LAYER } from "./layers/sortable";

/** Layer key → layer object. Add new layers here. */
const LAYER_REGISTRY: Record<string, LayerSpec> = {
  base: BASE_LAYER,
  text: TEXT_LAYER,
  numeric: NUMERIC_LAYER,
  percent: PERCENT_LAYER,
  sortable: SORTABLE_LAYER,
};

/** Normalize `inherits` to a string[] (handles single-string form). */
function parents(layer: LayerSpec): string[] {
  const i = layer.inherits;
  if (i == null) return [];
  return typeof i === "string" ? [i] : i;
}

/**
 * Resolve a column type's effective layers: walk `inherits`
 * transitively and topo-sort. Result is in order BASE → leaf.
 */
export function resolveLayers(col: ColumnTypeSpec): LayerSpec[] {
  // Collect every layer reachable from the column's declared layers.
  const reachable = new Map<string, LayerSpec>();
  const visit = (key: string, stack: string[]): void => {
    if (reachable.has(key)) return;
    if (stack.includes(key)) {
      throw new Error(`Layer inheritance cycle: ${[...stack, key].join(" -> ")}`);
    }
    const layer = LAYER_REGISTRY[key];
    if (!layer) throw new Error(`Unknown layer "${key}" referenced from ${col.type}`);
    for (const dep of parents(layer)) visit(dep, [...stack, key]);
    reachable.set(key, layer);
  };
  for (const declared of col.layers) visit(declared.key, []);

  // Topological sort: emit a node only after its ancestors.
  const result: LayerSpec[] = [];
  const emitted = new Set<string>();
  const emit = (key: string): void => {
    if (emitted.has(key)) return;
    const layer = reachable.get(key)!;
    for (const dep of parents(layer)) emit(dep);
    result.push(layer);
    emitted.add(key);
  };
  // Stable order: emit in the order declared on the column type so
  // that for ties (e.g. SORTABLE alongside a leaf layer), the user
  // gets the order they wrote.
  for (const declared of col.layers) emit(declared.key);

  return result;
}

export { LAYER_REGISTRY };
