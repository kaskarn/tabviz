// Column-order application — ONE implementation shared by the store's
// effective-column derivation and the SVG export path (interactivity
// review pass: figureLayout.columnOrder was honored by the widget but
// silently ignored by save_plot/V8 export, breaking WYSIWYG).

import type { ColumnDef, WebSpec } from "$types";

/**
 * Apply an ordered id list to a ColumnDef[] (top-level or a group's
 * children). Tolerant at apply time: unknown ids in the order are dropped;
 * columns missing from the order are appended in their original order.
 */
export function applyColumnOrder(
  defs: ColumnDef[],
  order: string[] | null | undefined,
): ColumnDef[] {
  if (!order || order.length === 0) return defs;
  const byId = new Map<string, ColumnDef>();
  for (const d of defs) byId.set(d.id, d);
  const result: ColumnDef[] = [];
  const seen = new Set<string>();
  for (const id of order) {
    const d = byId.get(id);
    if (d) { result.push(d); seen.add(id); }
  }
  for (const d of defs) if (!seen.has(d.id)) result.push(d);
  return result;
}

/**
 * Apply a spec's `figureLayout.columnOrder` block to its columns array
 * (top level + per-group children). Pure — returns a new spec when an
 * order applies, the input spec otherwise. The export path runs this at
 * spec ingest; the live widget applies the same order via the columns
 * slice (`effectiveColumnDefs`), so re-applying an already-baked order
 * here is an idempotent no-op.
 */
export function applyFigureLayoutColumnOrder(spec: WebSpec): WebSpec {
  const order = spec.figureLayout?.columnOrder;
  if (!order || !Array.isArray(spec.columns)) return spec;
  const topLevel = Array.isArray(order.topLevel)
    ? order.topLevel.filter((id) => typeof id === "string")
    : null;
  const byGroup = order.byGroup ?? {};
  const reordered = applyColumnOrder(spec.columns, topLevel).map((def) => {
    if (!def.isGroup) return def;
    const groupOrder = byGroup[def.id];
    if (!Array.isArray(groupOrder)) return def;
    return {
      ...def,
      columns: applyColumnOrder(
        def.columns as ColumnDef[],
        groupOrder.filter((id) => typeof id === "string"),
      ),
    } as ColumnDef;
  });
  return { ...spec, columns: reordered };
}
