<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import type { DragKind } from "$types";
  import { hitTestRowGaps } from "$lib/dnd-utils";

  interface Props {
    store: ForestStore;
    kind: Extract<DragKind, "row" | "row_group">;
    id: string;          // rowId or groupId depending on kind
    scopeKey: string;    // groupId ("__root__" for top-level rows) or parentKey for row_group
    root: HTMLElement | null;
  }

  let { store, kind, id, scopeKey, root }: Props = $props();

  let suppressClick = false;

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    store.beginDrag({ kind, id, scopeKey, startX: e.clientX, startY: e.clientY });
    suppressClick = false;
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }

  // The displayRow list contains all rows + group headers; we need the indices
  // that belong to this drag's scope.
  function getAllowedIndices(): number[] {
    const rows = store.displayRows;
    const indices: number[] = [];
    if (kind === "row") {
      const siblingIds = new Set(store.siblingsForRowScope(scopeKey));
      rows.forEach((dr, i) => {
        if (dr.type === "data" && siblingIds.has(dr.row.id)) indices.push(i);
      });
    } else {
      const siblingIds = new Set(store.siblingsForRowGroupScope(scopeKey));
      rows.forEach((dr, i) => {
        if (dr.type === "group_header" && siblingIds.has(dr.group.id)) indices.push(i);
      });
    }
    return indices;
  }

  function getRowEl(displayIndex: number): HTMLElement | null {
    if (!root) return null;
    return root.querySelector<HTMLElement>(`[data-display-index="${displayIndex}"]`);
  }

  function onPointerMove(e: PointerEvent) {
    const drag = store.dragState;
    if (!drag) return;
    const allowed = getAllowedIndices();
    const hit = hitTestRowGaps(e.clientX, e.clientY, allowed, getRowEl);
    store.updateDrag(e.clientX, e.clientY, hit ? hit.index : null);
    if (drag.active) suppressClick = true;
  }

  function onPointerUp() {
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    store.endDrag((state) => {
      if (state.indicatorIndex == null) return;
      if (state.kind === "row") {
        store.moveRowItem(state.id, state.indicatorIndex);
      } else if (state.kind === "row_group") {
        store.moveRowGroupItem(state.id, state.indicatorIndex);
      }
    });
    if (suppressClick) {
      const swallow = (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
        window.removeEventListener("click", swallow, true);
      };
      window.addEventListener("click", swallow, true);
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<span
  class="drag-handle row-drag-handle"
  title="Drag to reorder"
  onpointerdown={onPointerDown}
  onclick={(e) => e.stopPropagation()}
>
  <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor" aria-hidden="true">
    <circle cx="2" cy="2" r="1" />
    <circle cx="6" cy="2" r="1" />
    <circle cx="2" cy="6" r="1" />
    <circle cx="6" cy="6" r="1" />
    <circle cx="2" cy="10" r="1" />
    <circle cx="6" cy="10" r="1" />
  </svg>
</span>

<style>
  .row-drag-handle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    margin-right: 4px;
    color: var(--wf-secondary, #64748b);
    cursor: grab;
    opacity: 0;
    transition: opacity 0.12s ease;
    touch-action: none;
    vertical-align: middle;
  }
  :global(.data-cell:hover) .row-drag-handle,
  :global(.group-row:hover) .row-drag-handle {
    opacity: 0.55;
  }
  .row-drag-handle:hover { opacity: 1 !important; }
  .row-drag-handle:active { cursor: grabbing; }
</style>
