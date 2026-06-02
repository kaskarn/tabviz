/**
 * Region tree — the row-system structural foundation.
 *
 * Rows are modelled as a **tree of regions** that the renderer **flattens** into
 * the flat `DisplayRow[]` it already consumes. Today the tree mirrors exactly
 * what the old `fullDisplayRows` recursion produced (groups → child groups →
 * direct rows), so the output is byte-identical — but the tree is now an
 * explicit, extensible structure: a node can own children of any kind, which is
 * how the upcoming **details/disclosure** panels and **faceting** per-group axis
 * strips will attach (see docs/dev/region-tree.md + row-types.md §6).
 *
 * ## The performance contract (load-bearing — region-tree.md §1)
 *
 * The tree is the STRUCTURE layer only; the flat `DisplayRow[]` stays the
 * layout/render contract. Layout (`computeRowLayout`) and render keep iterating a
 * flat array — they never walk the tree. The split this module enforces:
 *
 *   - `buildRegionTree(structural inputs)` — depends ONLY on groups, the visible
 *     rows, and reorder overrides. Collapse state is NOT an input.
 *   - `flatten(tree, collapsed)` — applies collapse at emit time (a `Set` lookup),
 *     emitting the flat units. Container resize / measured heights never touch
 *     either; they re-run `computeRowLayout` over the existing array.
 *
 * Pure, V8-safe, no DOM / Svelte / theme-resolver — bun-testable.
 */
import type { Row, Group, DisplayRow } from "$types";
import type { RowKind } from "./row-kind";

/** The kinds a region can be: every display `RowKind` (the single source of
 *  truth, row-kind.ts — includes `panel`) plus the structural-only `axis_strip`
 *  (per-group faceted axis), declared for the foundation but not yet produced. */
export type RegionKind = RowKind | "axis_strip";

/** Orthogonal modifiers a region may carry (many-of). Empty today. */
export type RegionTrait = "expandable" | "sticky" | "editable" | "computed";

/** Which level a region describes. */
export type RegionScope = "table" | "group" | "overall";

/** A node in the region tree. `body` is either column-aligned cells (today's
 *  rows/group headers) or free content (future panels); `children` lets a node
 *  own a subtree (a group owns its rows; a data row will own a details panel). */
export interface RegionNode {
  /** Stable id (`group:<id>` / `row:<id>`) for keying + future incremental ops. */
  id: string;
  kind: RegionKind;
  traits: ReadonlySet<RegionTrait>;
  scope: RegionScope;
  depth: number;
  body:
    | { type: "cells"; row?: Row; group?: Group; rowCount?: number }
    | { type: "free"; content: string; ownerRowId: string };
  children?: RegionNode[];
}

export interface RegionTreeInput {
  /** All groups (spec.data.groups). */
  groups: Group[];
  /** Visible rows in display order (post sort/filter/pagination-source). */
  visibleRows: Row[];
  /** Per-group row reorder + per-parent group reorder overrides. */
  rowOrder: {
    byGroup: Record<string, string[]>;
    groupOrderByParent: Record<string, string[]>;
  };
}

const NO_TRAITS: ReadonlySet<RegionTrait> = new Set();
const EXPANDABLE: ReadonlySet<RegionTrait> = new Set(["expandable"]);
const EMPTY_SET: ReadonlySet<string> = new Set();
const ROOT_SCOPE_KEY = "__root__";

/**
 * Build the structural region tree (top-level forest). Collapse-independent:
 * the full tree is built regardless of collapse; `flatten` decides what shows.
 * Faithful port of the old `fullDisplayRows` recursion.
 */
export function buildRegionTree(input: RegionTreeInput): RegionNode[] {
  const { groups, visibleRows, rowOrder } = input;
  const groupMap = new Map<string, Group>(groups.map((g) => [g.id, g]));
  const rowDepth = (groupId: string | null | undefined): number =>
    groupId ? (groupMap.get(groupId)?.depth ?? 0) + 1 : 0;

  // 1. Bucket visible rows by group, then apply any per-group reorder override.
  const rowsByGroup = new Map<string | null, Row[]>();
  for (const row of visibleRows) {
    const key = row.groupId ?? null;
    if (!rowsByGroup.has(key)) rowsByGroup.set(key, []);
    rowsByGroup.get(key)!.push(row);
  }
  for (const [key, bucket] of rowsByGroup) {
    const override = rowOrder.byGroup[key ?? ROOT_SCOPE_KEY];
    if (!override) continue;
    const idx: Record<string, number> = {};
    override.forEach((id, i) => (idx[id] = i));
    bucket.sort(
      (a, b) =>
        (idx[a.id] ?? Number.POSITIVE_INFINITY) -
        (idx[b.id] ?? Number.POSITIVE_INFINITY),
    );
  }

  // 2. Groups that need a header: every group with data + all its ancestors.
  const groupsWithHeaders = new Set<string>();
  for (const groupId of rowsByGroup.keys()) {
    let current: string | null | undefined = groupId;
    while (current) {
      groupsWithHeaders.add(current);
      current = groupMap.get(current)?.parentId;
    }
  }

  // 3. Child groups of a parent (header-bearing only), with reorder override.
  const childGroups = (parentId: string | null): Group[] => {
    const matches = groups.filter(
      (g) => (g.parentId ?? null) === parentId && groupsWithHeaders.has(g.id),
    );
    const order = rowOrder.groupOrderByParent[parentId ?? ROOT_SCOPE_KEY];
    if (!order) return matches;
    const idx: Record<string, number> = {};
    order.forEach((id, i) => (idx[id] = i));
    return [...matches].sort(
      (a, b) =>
        (idx[a.id] ?? Number.POSITIVE_INFINITY) -
        (idx[b.id] ?? Number.POSITIVE_INFINITY),
    );
  };

  // 3b. Direct + descendant row count for a group header's "(N)".
  const countDescendantRows = (groupId: string): number => {
    let count = rowsByGroup.get(groupId)?.length ?? 0;
    for (const child of childGroups(groupId)) count += countDescendantRows(child.id);
    return count;
  };

  // 4. Build nodes: a group's children are its child-group subtrees then its
  //    direct rows (mirrors `outputGroup`: header → children → direct rows).
  const buildLevel = (groupId: string | null): RegionNode[] => {
    const nodes: RegionNode[] = [];
    for (const group of childGroups(groupId)) {
      nodes.push({
        id: `group:${group.id}`,
        kind: "group_header",
        traits: NO_TRAITS,
        scope: "group",
        depth: group.depth,
        body: { type: "cells", group, rowCount: countDescendantRows(group.id) },
        children: buildLevel(group.id),
      });
    }
    for (const row of rowsByGroup.get(groupId) ?? []) {
      const depth = rowDepth(row.groupId);
      const node: RegionNode = {
        id: `row:${row.id}`,
        kind: "data",
        traits: NO_TRAITS,
        scope: "table",
        depth,
        body: { type: "cells", row },
      };
      // A row with details content owns an expandable full-width panel child.
      if (typeof row.details === "string" && row.details.trim() !== "") {
        node.traits = EXPANDABLE;
        node.children = [{
          id: `panel:${row.id}`,
          kind: "panel",
          traits: NO_TRAITS,
          scope: "table",
          depth,
          body: { type: "free", content: row.details, ownerRowId: row.id },
        }];
      }
      nodes.push(node);
    }
    return nodes;
  };

  return buildLevel(null);
}

/**
 * Flatten the region tree to the flat `DisplayRow[]` the layout + render paths
 * consume. Disclosure state is applied here (a `Set` lookup), keeping it off the
 * structural pass: a collapsed group emits its header but not its subtree; a
 * details panel emits only when its owner row is in `expandedRows`. Single
 * linear DFS.
 */
export function flatten(
  forest: RegionNode[],
  collapsedGroups: ReadonlySet<string>,
  expandedRows: ReadonlySet<string> = EMPTY_SET,
): DisplayRow[] {
  const out: DisplayRow[] = [];

  const walk = (node: RegionNode): void => {
    if (node.kind === "group_header" && node.body.type === "cells" && node.body.group) {
      const group = node.body.group;
      const collapsed = collapsedGroups.has(group.id);
      out.push({
        type: "group_header",
        group: { ...group, collapsed },
        rowCount: node.body.rowCount ?? 0,
        depth: node.depth,
      });
      if (collapsed) return; // header shown, subtree hidden
    } else if (node.kind === "data" && node.body.type === "cells" && node.body.row) {
      out.push({ type: "data", row: node.body.row, depth: node.depth });
    } else if (node.kind === "panel" && node.body.type === "free") {
      if (!expandedRows.has(node.body.ownerRowId)) return; // collapsed panel: skip subtree
      out.push({ type: "panel", rowId: node.body.ownerRowId, content: node.body.content, depth: node.depth });
    }
    if (node.children) {
      for (const child of node.children) walk(child);
    }
  };

  for (const node of forest) walk(node);
  return out;
}
