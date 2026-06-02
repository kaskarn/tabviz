// Rows + groups slice — collapse state, row/group reorder overrides,
// hover/tooltip pointers, the `groupMap` / `groupDepthMap` lookups,
// and the large `fullDisplayRows` $derived that interleaves group
// headers with data rows in hierarchy order. Plus `tooltipRow`
// (cellEdits-merged Row).
//
// This is the second large slice (after sort-filter) and the first to
// read a $derived from ANOTHER slice (sort-filter's `visibleIndices`)
// inside its own $derived (`fullDisplayRows`). The axis spike (PR3)
// validated the cross-slice $derived pattern with two scalar deps;
// PR4 (sort-filter) validated it with three deps + object-map shapes.
// This slice continues to push: `fullDisplayRows` reads
// `visibleIndices` from sort-filter and dereferences via `rowAt(i)`,
// then weaves in collapse state and reorder overrides from THIS slice.
// Multi-source composition.
//
// Owns:
//   - collapsedGroups       Set<groupId> of collapsed groups
//   - rowOrderOverrides     per-scope row + group reorders
//   - hoveredRowId          transient hover pointer
//   - tooltipRowId          transient tooltip target
//   - tooltipPosition       transient tooltip anchor
//
// Derived:
//   - groupMap              spec.data.groups indexed by id
//   - groupDepthMap         spec.data.groups indexed → depth
//   - fullDisplayRows       weave of group headers + data rows (pre-paginate)
//   - maxGroupDepth         deepest group level + 1
//   - tooltipRow            spec.data.rows[tooltipRowId] merged with cellEdits
//
// Dependencies (injected):
//   - getSpec, getAllColumns                  (data / columns — main)
//   - getVisibleIndices                       (sort-filter slice — index list)
//   - getRowAt                                (sort-filter slice — resolves an
//                                              index to its overlay-merged Row)
//   - getDisplayRows                          (post-pagination — main for now;
//                                              used by sibling helpers)
//   - getCellEdits                            (cells slice — for tooltipRow merge)
//   - appendOp, markSource
//
// Pagination-related derived (`paginatedRows` / `displayRows` /
// `currentPageRowIds`) intentionally stay in the main factory pending
// the data slice. `rowPaddedAfter` / `bandIndexes` also stay in main
// since they read `displayRows` (post-pagination) and banding state
// (layout-zoom future).

import type {
  Row, Group, WebSpec, ColumnSpec, DisplayRow,
  RowOrderOverrides,
} from "$types";
import { ops, type OpRecord } from "$lib/op-recorder";
import { maxGroupDepth as computeMaxGroupDepth } from "$lib/banding";

type CellEdits = {
  cells: Record<string, Record<string, unknown>>;
  groups: Record<string, string>;
};

export interface RowsGroupsSliceDeps {
  getSpec: () => WebSpec | null;
  getAllColumns: () => readonly ColumnSpec[];
  getVisibleIndices: () => readonly number[];
  getRowAt: (i: number) => Row;
  getDisplayRows: () => readonly DisplayRow[];
  getCellEdits: () => CellEdits;
  appendOp: (record: OpRecord) => void;
  markSource: (field: string) => void;
}

export interface RowsGroupsSlice {
  readonly collapsedGroups: Set<string>;
  readonly rowOrderOverrides: RowOrderOverrides;
  readonly hoveredRowId: string | null;
  readonly tooltipRowId: string | null;
  readonly tooltipPosition: { x: number; y: number } | null;

  readonly groupMap: Map<string, Group>;
  readonly groupDepthMap: Map<string, number>;
  readonly fullDisplayRows: DisplayRow[];
  readonly maxGroupDepth: number;
  readonly tooltipRow: Row | null;

  toggleGroup: (id: string, collapsed?: boolean) => void;
  findRowGroupScope: (groupId: string) => string;
  siblingsForRowScope: (scopeKey: string) => string[];
  siblingsForRowGroupScope: (parentKey: string) => string[];
  moveRowItem: (rowId: string, newIndex: number) => void;
  moveRowGroupItem: (groupId: string, newIndex: number) => void;
  clearRowReorder: (groupId?: string) => void;
  setHovered: (id: string | null) => void;
  setTooltip: (
    rowId: string | null,
    position: { x: number; y: number } | null,
  ) => void;
  /** Setter for tooltipRowId only (used by setSpec to clear stale
   *  references from a previous spec without touching position). */
  setTooltipRowId: (id: string | null) => void;
  /** Wipe every state field except hover (which is fine to leak —
   *  the OS or component lifecycle clears it on the next pointer
   *  event). Called from `setSpec` / `resetState`. */
  reset: () => void;
}

export function createRowsGroupsSlice(
  deps: RowsGroupsSliceDeps,
): RowsGroupsSlice {
  // REPLACE-only state (per audit): use `$state.raw` to skip proxy wrap.
  let collapsedGroups = $state.raw<Set<string>>(new Set());
  let rowOrderOverrides = $state.raw<RowOrderOverrides>({
    byGroup: {},
    groupOrderByParent: {},
  });
  // Primitives — `$state.raw` is equivalent to `$state` for primitives, so
  // these keep the simpler form.
  let hoveredRowId = $state<string | null>(null);
  let tooltipRowId = $state<string | null>(null);
  let tooltipPosition = $state<{ x: number; y: number } | null>(null);

  const groupMap = $derived.by((): Map<string, Group> => {
    const map = new Map<string, Group>();
    const spec = deps.getSpec();
    if (!spec) return map;
    for (const group of spec.data.groups) map.set(group.id, group);
    return map;
  });

  const groupDepthMap = $derived.by((): Map<string, number> => {
    const map = new Map<string, number>();
    const spec = deps.getSpec();
    if (!spec) return map;
    for (const group of spec.data.groups) map.set(group.id, group.depth);
    return map;
  });

  function getRowDepth(groupId: string | null | undefined): number {
    if (!groupId) return 0;
    const groupDepth = groupDepthMap.get(groupId) ?? 0;
    return groupDepth + 1;
  }

  function isAncestorCollapsed(groupId: string | null | undefined): boolean {
    if (!groupId) return false;
    let current: string | null | undefined = groupId;
    while (current) {
      const group = groupMap.get(current);
      if (!group) break;
      if (group.parentId && collapsedGroups.has(group.parentId)) return true;
      current = group.parentId;
    }
    return false;
  }

  // CROSS-SLICE $DERIVED: reads visibleIndices from the sort-filter
  // slice and dereferences each via deps.getRowAt(i). Reactivity
  // propagates the same way as the axis spike's xScale reading the
  // forest column's resolved flex width.
  const fullDisplayRows = $derived.by((): DisplayRow[] => {
    const spec = deps.getSpec();
    if (!spec) return [];

    const result: DisplayRow[] = [];

    // 1. Group rows by groupId, then apply any per-group reorder override.
    const rowsByGroup = new Map<string | null, Row[]>();
    for (const i of deps.getVisibleIndices()) {
      const row = deps.getRowAt(i);
      const key = row.groupId ?? null;
      if (!rowsByGroup.has(key)) rowsByGroup.set(key, []);
      rowsByGroup.get(key)!.push(row);
    }
    for (const [key, bucket] of rowsByGroup) {
      const scopeKey = key ?? "__root__";
      const override = rowOrderOverrides.byGroup[scopeKey];
      if (!override) continue;
      const idx: Record<string, number> = {};
      override.forEach((id, i) => (idx[id] = i));
      bucket.sort((a, b) => {
        const ai = idx[a.id] ?? Number.POSITIVE_INFINITY;
        const bi = idx[b.id] ?? Number.POSITIVE_INFINITY;
        return ai - bi;
      });
    }

    // 2. Collect all groups that need headers (data groups + ancestors).
    const groupsWithHeaders = new Set<string>();
    for (const groupId of rowsByGroup.keys()) {
      if (!groupId) continue;
      let current: string | null | undefined = groupId;
      while (current) {
        groupsWithHeaders.add(current);
        current = groupMap.get(current)?.parentId;
      }
    }

    // 3. Helper: child groups of a parent (with reorder override).
    function getChildGroups(parentId: string | null): Group[] {
      const matches = spec!.data.groups
        .filter(g => (g.parentId ?? null) === parentId && groupsWithHeaders.has(g.id));
      const parentKey = parentId ?? "__root__";
      const order = rowOrderOverrides.groupOrderByParent[parentKey];
      if (!order) return matches;
      const idx: Record<string, number> = {};
      order.forEach((id, i) => (idx[id] = i));
      return [...matches].sort((a, b) => {
        const ai = idx[a.id] ?? Number.POSITIVE_INFINITY;
        const bi = idx[b.id] ?? Number.POSITIVE_INFINITY;
        return ai - bi;
      });
    }

    // 3b. Helper: count direct + descendant rows for a group header.
    function countAllDescendantRows(groupId: string): number {
      let count = rowsByGroup.get(groupId)?.length ?? 0;
      for (const childGroup of getChildGroups(groupId)) {
        count += countAllDescendantRows(childGroup.id);
      }
      return count;
    }

    // 4. Recursive output: header → children → direct data rows.
    function outputGroup(groupId: string | null) {
      if (groupId) {
        const group = groupMap.get(groupId);
        if (!group) return;
        if (isAncestorCollapsed(groupId)) return;
        const isCollapsed = collapsedGroups.has(group.id);
        const rowCount = countAllDescendantRows(groupId);

        result.push({
          type: "group_header",
          group: { ...group, collapsed: isCollapsed },
          rowCount,
          depth: group.depth,
        });

        if (isCollapsed) return;
      }

      for (const childGroup of getChildGroups(groupId)) {
        outputGroup(childGroup.id);
      }

      const directRows = rowsByGroup.get(groupId) ?? [];
      for (const row of directRows) {
        result.push({
          type: "data",
          row,
          depth: getRowDepth(row.groupId),
        });
      }
    }

    outputGroup(null);
    return result;
  });

  const maxGroupDepth = $derived.by((): number => {
    return computeMaxGroupDepth(deps.getSpec()?.data.groups);
  });

  // tooltipRow merges cellEdits so the tooltip reflects in-session
  // edits (including the primary column = row label).
  const tooltipRow = $derived.by((): Row | null => {
    const spec = deps.getSpec();
    if (!tooltipRowId || !spec) return null;
    const base = spec.data.rows.find((r) => r.id === tooltipRowId);
    if (!base) return null;
    const edited = deps.getCellEdits().cells[base.id];
    if (!edited) return base;
    const primaryField = deps.getAllColumns()[0]?.field;
    const newLabel = primaryField && edited[primaryField] != null
      ? String(edited[primaryField])
      : base.label;
    return { ...base, label: newLabel, metadata: { ...base.metadata, ...edited } };
  });

  function toggleGroup(id: string, collapsed?: boolean): void {
    const newCollapsed = new Set(collapsedGroups);
    const shouldCollapse = collapsed ?? !newCollapsed.has(id);
    if (shouldCollapse) newCollapsed.add(id);
    else newCollapsed.delete(id);
    collapsedGroups = newCollapsed;
    deps.markSource("collapsed_groups");
  }

  function findRowGroupScope(groupId: string): string {
    const spec = deps.getSpec();
    if (!spec) return "__root__";
    const g = spec.data.groups.find((x) => x.id === groupId);
    return g?.parentId ?? "__root__";
  }

  function siblingsForRowScope(scopeKey: string): string[] {
    const spec = deps.getSpec();
    if (!spec) return [];
    const result: string[] = [];
    for (const dr of deps.getDisplayRows()) {
      if (dr.type === "data") {
        const gid = dr.row.groupId ?? "__root__";
        if (gid === scopeKey) result.push(dr.row.id);
      }
    }
    return result;
  }

  function siblingsForRowGroupScope(parentKey: string): string[] {
    const spec = deps.getSpec();
    if (!spec) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const dr of deps.getDisplayRows()) {
      if (dr.type === "group_header") {
        const parent = dr.group.parentId ?? "__root__";
        if (parent === parentKey && !seen.has(dr.group.id)) {
          seen.add(dr.group.id);
          result.push(dr.group.id);
        }
      }
    }
    return result;
  }

  function moveRowItem(rowId: string, newIndex: number): void {
    const spec = deps.getSpec();
    if (!spec) return;
    const row = spec.data.rows.find((r) => r.id === rowId);
    if (!row) return;
    const scope = row.groupId ?? "__root__";
    const currentOrder = rowOrderOverrides.byGroup[scope]
      ?? siblingsForRowScope(scope);
    const order = currentOrder.includes(rowId)
      ? [...currentOrder]
      : [...siblingsForRowScope(scope)];
    const fromIdx = order.indexOf(rowId);
    if (fromIdx === -1) return;
    order.splice(fromIdx, 1);
    const targetIdx = newIndex > fromIdx ? newIndex - 1 : newIndex;
    const clamped = Math.max(0, Math.min(order.length, targetIdx));
    order.splice(clamped, 0, rowId);
    rowOrderOverrides = {
      ...rowOrderOverrides,
      byGroup: { ...rowOrderOverrides.byGroup, [scope]: order },
    };
    deps.appendOp(ops.moveRow(rowId, newIndex + 1));
  }

  function moveRowGroupItem(groupId: string, newIndex: number): void {
    const spec = deps.getSpec();
    if (!spec) return;
    const parentKey = findRowGroupScope(groupId);
    const existing = rowOrderOverrides.groupOrderByParent[parentKey]
      ?? siblingsForRowGroupScope(parentKey);
    const order = [...existing];
    const fromIdx = order.indexOf(groupId);
    if (fromIdx === -1) return;
    order.splice(fromIdx, 1);
    const targetIdx = newIndex > fromIdx ? newIndex - 1 : newIndex;
    const clamped = Math.max(0, Math.min(order.length, targetIdx));
    order.splice(clamped, 0, groupId);
    rowOrderOverrides = {
      ...rowOrderOverrides,
      groupOrderByParent: {
        ...rowOrderOverrides.groupOrderByParent,
        [parentKey]: order,
      },
    };
  }

  function clearRowReorder(groupId?: string): void {
    if (groupId) {
      const { [groupId]: _omit, ...rest } = rowOrderOverrides.byGroup;
      rowOrderOverrides = { ...rowOrderOverrides, byGroup: rest };
    } else {
      rowOrderOverrides = { byGroup: {}, groupOrderByParent: {} };
    }
  }

  function setHovered(id: string | null): void {
    hoveredRowId = id;
    deps.markSource("hover");
  }

  function setTooltip(
    rowId: string | null,
    position: { x: number; y: number } | null,
  ): void {
    tooltipRowId = rowId;
    tooltipPosition = position;
  }

  function setTooltipRowId(id: string | null): void {
    tooltipRowId = id;
  }

  function reset(): void {
    collapsedGroups = new Set();
    rowOrderOverrides = { byGroup: {}, groupOrderByParent: {} };
    tooltipRowId = null;
    tooltipPosition = null;
    // hoveredRowId left alone — the next pointermove sets it again,
    // and clearing it from setSpec / resetState created a flicker.
  }

  return {
    get collapsedGroups() { return collapsedGroups; },
    get rowOrderOverrides() { return rowOrderOverrides; },
    get hoveredRowId() { return hoveredRowId; },
    get tooltipRowId() { return tooltipRowId; },
    get tooltipPosition() { return tooltipPosition; },

    get groupMap() { return groupMap; },
    get groupDepthMap() { return groupDepthMap; },
    get fullDisplayRows() { return fullDisplayRows; },
    get maxGroupDepth() { return maxGroupDepth; },
    get tooltipRow() { return tooltipRow; },

    toggleGroup, findRowGroupScope, siblingsForRowScope,
    siblingsForRowGroupScope, moveRowItem, moveRowGroupItem,
    clearRowReorder, setHovered, setTooltip, setTooltipRowId,
    reset,
  };
}
