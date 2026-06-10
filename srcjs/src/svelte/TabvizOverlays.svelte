<!--
  TabvizOverlays — popovers + drop indicator + tooltip + column-editing
  popup chain. Phase 0c-C2 first piece.

  Owns the local state for the three popover chains (right-click context
  menu → type-picker menu → column editor) plus the typeMenuMemory glue
  between them. Exposes `openHeaderContextMenu(column, e)` for the
  parent's column-header click handlers to call via bind:this.

  Receives:
    - store: the TabvizStore
    - containerRef: parent's outermost div (drop-indicator computes
      positions relative to this)
-->
<script lang="ts">
  import type { ColumnSpec } from "$types";
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import Tooltip from "$components/ui/Tooltip.svelte";
  import DropIndicator from "$components/controls/DropIndicator.svelte";
  import EditableCell from "$components/controls/EditableCell.svelte";
  import ColumnFilterPopover from "$components/controls/ColumnFilterPopover.svelte";
  import HeaderContextMenu, { type ContextMenuTarget } from "$components/controls/HeaderContextMenu.svelte";
  import ColumnTypeMenu, { type TypeMenuTarget, type TypePick } from "$components/controls/ColumnTypeMenu.svelte";
  import ColumnEditorPopover, { type EditorTarget } from "$components/column-editor-v2/ColumnEditorV2Popover.svelte";
  import { getVisualTypeDef, resolveShowHeader } from "$lib/column-types";

  interface Props {
    store: TabvizStore;
    containerRef: HTMLDivElement | undefined;
  }
  const { store, containerRef }: Props = $props();

  const spec = $derived(store.spec);
  // Resolved interaction surface (4-tier defaults chain) — never read
  // spec.interaction directly; it is the sparse explicit tier only.
  const interaction = $derived(store.interaction);
  const theme = $derived(spec?.theme);
  const tooltipRow = $derived(store.tooltipRow);
  const tooltipPosition = $derived(store.tooltipPosition);


  let headerContextMenu = $state<ContextMenuTarget | null>(null);
  let columnTypeMenuTarget = $state<TypeMenuTarget | null>(null);
  let columnEditorTarget = $state<EditorTarget | null>(null);
  // Glue between the type-picker and column-editor popovers: when the
  // user picks "Change type…", we close the editor, open the type menu,
  // and remember which anchor/existing-column we're coming from so the
  // type-pick handler can route correctly.
  let typeMenuMemory = $state<{ anchorX: number; anchorY: number; afterId?: string; existingId?: string } | null>(null);

  /**
   * Open the right-click context menu for a column header. Called by
   * the parent's table-body column-header click handlers via bind:this.
   */
  export function openHeaderContextMenu(column: ColumnSpec, e: MouseEvent): void {
    if (!interaction.enableEdit) return;
    e.preventDefault();
    columnEditorTarget = null;
    const def = getVisualTypeDef(column.type);
    // Offer "Configure…" when either the slot-based editor can round-trip
    // this type, OR the column is a viz_* type (bar/boxplot/violin) which
    // uses the multi-effect editor built into the configure popover.
    const isMultiEffectViz =
      column.type === "viz_bar" ||
      column.type === "viz_boxplot" ||
      column.type === "viz_violin";
    const canConfigure =
      isMultiEffectViz ||
      (!!def && !def.authorOnly && def.slots.length > 0);
    headerContextMenu = {
      columnId: column.id,
      columnHeader: column.header ?? column.field,
      anchorX: e.clientX,
      anchorY: e.clientY,
      canHide: true,
      canConfigure,
      headerShown: resolveShowHeader(column.showHeader, column.header),
    };
  }

  function handleContextMenuAction(action: "hide" | "insert" | "configure" | "toggle-header") {
    const target = headerContextMenu;
    if (!target) return;
    const col = store.allColumns.find((c) => c.id === target.columnId);
    headerContextMenu = null;
    if (action === "hide") {
      store.hideColumn(target.columnId);
      return;
    }
    if (action === "toggle-header" && col) {
      const next: ColumnSpec = { ...col, showHeader: !target.headerShown };
      store.updateColumn(col.id, next);
      return;
    }
    if (action === "insert") {
      typeMenuMemory = { anchorX: target.anchorX, anchorY: target.anchorY, afterId: target.columnId };
      columnTypeMenuTarget = { anchorX: target.anchorX, anchorY: target.anchorY, afterId: target.columnId };
      return;
    }
    if (action === "configure" && col) {
      typeMenuMemory = { anchorX: target.anchorX, anchorY: target.anchorY, existingId: col.id };
      columnEditorTarget = {
        mode: "configure",
        anchorX: target.anchorX,
        anchorY: target.anchorY,
        existing: col,
      };
    }
  }

  function handleTypePick(pick: TypePick) {
    const mem = typeMenuMemory;
    columnTypeMenuTarget = null;
    if (!mem) return;
    if (mem.existingId) {
      const existing = store.allColumns.find((c) => c.id === mem.existingId);
      if (!existing) return;
      columnEditorTarget = {
        mode: "configure",
        anchorX: mem.anchorX,
        anchorY: mem.anchorY,
        existing: { ...existing, type: pick.type, options: pick.seedOptions },
        type: pick.type,
        presetLabel: pick.presetLabel,
        seedOptions: pick.seedOptions,
      };
    } else {
      columnEditorTarget = {
        mode: "insert",
        anchorX: mem.anchorX,
        anchorY: mem.anchorY,
        afterId: mem.afterId,
        type: pick.type,
        presetLabel: pick.presetLabel,
        seedOptions: pick.seedOptions,
      };
    }
  }

  function handleRequestChangeType() {
    const cur = columnEditorTarget;
    if (!cur) return;
    typeMenuMemory = {
      anchorX: cur.anchorX,
      anchorY: cur.anchorY,
      afterId: cur.afterId,
      existingId: cur.existing?.id,
    };
    columnEditorTarget = null;
    columnTypeMenuTarget = {
      anchorX: cur.anchorX,
      anchorY: cur.anchorY,
      afterId: cur.afterId,
      existingId: cur.existing?.id,
    };
  }

  function handleEditorCommit(
    newSpec: ColumnSpec,
    mode: "insert" | "configure",
    afterId?: string,
  ) {
    if (mode === "insert") {
      store.insertColumn(newSpec, afterId ?? "__start__");
    } else {
      store.updateColumn(newSpec.id, newSpec);
    }
    columnEditorTarget = null;
    typeMenuMemory = null;
  }

  /** Drop-indicator position helper for column DnD. */
  function computeColumnBand(siblingIds: string[], targetIndex: number): { x: number; start: number; end: number } | null {
    if (!containerRef || siblingIds.length === 0) return null;
    const els: HTMLElement[] = [];
    for (const id of siblingIds) {
      const el = containerRef.querySelector<HTMLElement>(`[data-header-id="${CSS.escape(id)}"]`);
      if (el) els.push(el);
    }
    if (els.length === 0) return null;
    const rects = els.map((el) => el.getBoundingClientRect());
    const idx = Math.max(0, Math.min(rects.length, targetIndex));
    const x = idx === 0 ? rects[0].left : rects[idx - 1].right;
    const start = Math.min(...rects.map((r) => r.top));
    const containerRect = containerRef.getBoundingClientRect();
    const end = containerRect.bottom;
    return { x, start, end };
  }

  /** Drop-indicator position helper for row DnD. */
  function computeRowBand(allowedIndices: number[], targetIndex: number): { y: number; start: number; end: number } | null {
    if (!containerRef || allowedIndices.length === 0) return null;
    const els: HTMLElement[] = [];
    for (const di of allowedIndices) {
      const el = containerRef.querySelector<HTMLElement>(`[data-display-index="${di}"]`);
      if (el) els.push(el);
    }
    if (els.length === 0) return null;
    const rects = els.map((el) => el.getBoundingClientRect());
    const idx = Math.max(0, Math.min(rects.length, targetIndex));
    const y = idx === 0 ? rects[0].top : rects[idx - 1].bottom;
    const containerRect = containerRef.getBoundingClientRect();
    return { y, start: containerRect.left, end: containerRect.right };
  }
</script>

<!-- Tooltip -->
<Tooltip row={tooltipRow} position={tooltipPosition} fields={interaction.tooltipFields} {theme} />

<!-- Drop indicator (fixed-positioned at root) -->
{#if store.dragState?.active && store.dragState.indicatorIndex != null}
  {@const dragKind = store.dragState.kind}
  {#if dragKind === "column" || dragKind === "column_group"}
    {@const siblings = store.siblingsForColumnScope(store.dragState.scopeKey).map(s => s.id)}
    {@const band = computeColumnBand(siblings, store.dragState.indicatorIndex)}
    {#if band}
      <DropIndicator orientation="vertical" x={band.x} start={band.start} end={band.end} />
    {/if}
  {:else}
    {@const indices = dragKind === "row"
      ? (() => { const ids = new Set(store.siblingsForRowScope(store.dragState.scopeKey)); const r: number[] = []; store.displayRows.forEach((dr, i) => { if (dr.type === "data" && ids.has(dr.row.id)) r.push(i); }); return r; })()
      : (() => { const ids = new Set(store.siblingsForRowGroupScope(store.dragState.scopeKey)); const r: number[] = []; store.displayRows.forEach((dr, i) => { if (dr.type === "group_header" && ids.has(dr.group.id)) r.push(i); }); return r; })()}
    {@const band = computeRowBand(indices, store.dragState.indicatorIndex)}
    {#if band}
      <DropIndicator orientation="horizontal" y={band.y} start={band.start} end={band.end} />
    {/if}
  {/if}
{/if}

<!-- Editable cell overlay -->
{#if store.editingTarget}
  <EditableCell {store} target={store.editingTarget} root={containerRef ?? null} />
{/if}

<!-- Column filter popover (rendered at root so it escapes the scaled wrapper) -->
<ColumnFilterPopover {store} />

<!-- Right-click column menu → type menu → interactive column editor -->
<HeaderContextMenu
  target={headerContextMenu}
  onAction={handleContextMenuAction}
  onClose={() => (headerContextMenu = null)}
/>
<ColumnTypeMenu
  target={columnTypeMenuTarget}
  available={store.availableFields}
  onPick={handleTypePick}
  onClose={() => { columnTypeMenuTarget = null; typeMenuMemory = null; }}
/>
<ColumnEditorPopover
  target={columnEditorTarget}
  available={store.availableFields}
  onCommit={handleEditorCommit}
  onClose={() => { columnEditorTarget = null; typeMenuMemory = null; }}
  onRequestChangeType={handleRequestChangeType}
/>
