<script lang="ts">
  import type { ForestStore } from "$stores/forestStore.svelte";
  import type { DragKind } from "$types";
  import { hitTestColumnGaps } from "$lib/dnd-utils";

  interface Props {
    store: ForestStore;
    kind: Extract<DragKind, "column" | "column_group">;
    id: string;
    /** HTML root of the forest widget — used to query sibling header cells. */
    root: HTMLElement | null;
  }

  let { store, kind, id, root }: Props = $props();

  let suppressClick = false;

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const scopeKey =
      kind === "column_group"
        ? "__root__"
        : (store.findColumnScope(id) ?? "__root__");

    store.beginDrag({ kind, id, scopeKey, startX: e.clientX, startY: e.clientY });
    suppressClick = false;
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }

  function getSiblingEl(siblingId: string): HTMLElement | null {
    if (!root) return null;
    return root.querySelector<HTMLElement>(`[data-header-id="${CSS.escape(siblingId)}"]`);
  }

  function onPointerMove(e: PointerEvent) {
    const drag = store.dragState;
    if (!drag) return;
    const siblings = store.siblingsForColumnScope(drag.scopeKey);
    const siblingIds = siblings.map((s) => s.id);
    const hit = hitTestColumnGaps(e.clientX, e.clientY, siblingIds, getSiblingEl);
    store.updateDrag(e.clientX, e.clientY, hit ? hit.index : null);
    if (drag.active) suppressClick = true;
  }

  function onPointerUp() {
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    store.endDrag((state) => {
      if (state.indicatorIndex == null) return;
      store.moveColumnItem(state.id, state.indicatorIndex);
    });
    // Swallow the synthetic click that a pointerup often produces.
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

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<span
  class="drag-handle column-drag-handle"
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
  /* Absolute-positioned so it doesn't consume flow width. Hidden until the
     header cell is hovered. Sits LEFT of the resize handle on the far right. */
  .column-drag-handle {
    position: absolute;
    top: 50%;
    right: 8px;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    color: var(--tv-text-muted, #64748b);
    cursor: grab;
    opacity: 0;
    transition: opacity 0.12s ease;
    touch-action: none;
    pointer-events: none;
    z-index: 5;
  }
  :global(.tabviz-container .header-cell:hover) .column-drag-handle,
  :global(.tabviz-container .column-group-header:hover) .column-drag-handle {
    opacity: 0.75;
    pointer-events: auto;
  }
  .column-drag-handle:hover { opacity: 1; }
  .column-drag-handle:active { cursor: grabbing; }
</style>
