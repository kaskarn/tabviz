<script lang="ts">
  // Drag-handle overlay layer for per-row-kind height resize (Phase 5).
  //
  // Per Stage 1 §34b + Q-P5.4 closure (separate component, mounted as
  // sibling overlay over the plot). Mirrors the ColumnHeaders.svelte
  // startResize pattern.
  //
  // Mechanics:
  //   - Renders one absolutely-positioned handle per row boundary at
  //     `top: rowPositions[i] + rowHeights[i] - HANDLE_THICKNESS/2`.
  //   - pointerdown captures + starts a drag, recording the row's resolved
  //     RowKind and the starting height.
  //   - pointermove computes newHeight = startHeight + (clientY - startY),
  //     clamped at the per-row content minimum, and calls
  //     store.setRowKindHeight(kind, newHeight). This commits per-move so
  //     re-layouts happen live.
  //   - pointerup detaches the drag listeners.
  //
  // Fallback paths (per startResize precedent):
  //   - window blur → stopResize (covers focus loss)
  //   - Escape key → stopResize (cancels)
  //   - pointercancel → stopResize (browser-quirk safety net)

  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import type { RowKind } from "$lib/layout/row-kind";
  import { resolveRowKind } from "$lib/layout/row-kind";
  import type { DisplayRow } from "$types";

  interface Props {
    store: TabvizStore;
    /** Per-row Y positions (top of each row). */
    rowPositions: readonly number[];
    /** Per-row heights. */
    rowHeights: readonly number[];
    /** Per-row data — used to resolve each row's kind. Length must match
     *  rowPositions / rowHeights. */
    displayRows: readonly DisplayRow[];
    /** Optional: per-row content minimum heights (px). When the user drags
     *  below content[i], the height clamps. Default 4px per row when not
     *  given. */
    contentMinHeights?: readonly number[];
    /** Whether the handles render at all. Hide via opacity until hover/drag. */
    enabled?: boolean;
  }

  const HANDLE_THICKNESS = 6; // px — the hover/grab target thickness
  const MIN_HEIGHT_PX = 4;     // absolute floor regardless of content

  const {
    store,
    rowPositions,
    rowHeights,
    displayRows,
    contentMinHeights,
    enabled = true,
  }: Props = $props();

  // Drag state — captured on pointerdown, used by pointermove/pointerup.
  let dragKind = $state.raw<RowKind | null>(null);
  let dragIndex = $state.raw<number | null>(null);
  let startY = 0;
  let startHeight = 0;

  function kindOf(rowIdx: number): RowKind {
    const dr = displayRows[rowIdx];
    return resolveRowKind(dr);
  }

  function startResize(e: PointerEvent, rowIdx: number): void {
    if (!store || !enabled) return;
    e.preventDefault();
    e.stopPropagation();
    dragKind = kindOf(rowIdx);
    dragIndex = rowIdx;
    startY = e.clientY;
    startHeight = rowHeights[rowIdx] ?? 0;
    attachDragListeners();
  }

  function onResize(e: PointerEvent): void {
    if (dragKind === null || dragIndex === null || !store) return;
    const delta = e.clientY - startY;
    const proposed = startHeight + delta;
    // Clamp at content minimum (or MIN_HEIGHT_PX if no content minimum).
    const floor = Math.max(
      MIN_HEIGHT_PX,
      contentMinHeights?.[dragIndex] ?? MIN_HEIGHT_PX,
    );
    const newHeight = Math.max(floor, Math.round(proposed));
    store.setRowKindHeight(dragKind, newHeight);
  }

  function stopResize(): void {
    dragKind = null;
    dragIndex = null;
    detachDragListeners();
  }

  function onWindowBlur(): void { stopResize(); }
  function onWindowKey(e: KeyboardEvent): void {
    if (e.key === "Escape") stopResize();
  }
  function attachDragListeners(): void {
    document.addEventListener("pointermove", onResize);
    document.addEventListener("pointerup", stopResize);
    document.addEventListener("pointercancel", stopResize);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("keydown", onWindowKey);
  }
  function detachDragListeners(): void {
    document.removeEventListener("pointermove", onResize);
    document.removeEventListener("pointerup", stopResize);
    document.removeEventListener("pointercancel", stopResize);
    window.removeEventListener("blur", onWindowBlur);
    window.removeEventListener("keydown", onWindowKey);
  }

  // For accessibility: each handle gets an aria-label naming its row.
  function handleLabel(rowIdx: number): string {
    const kind = kindOf(rowIdx);
    return `Resize ${kind.replace("_", " ")} rows (row ${rowIdx + 1})`;
  }
</script>

<div class="row-edge-overlay" aria-hidden={!enabled} data-dragging={dragKind !== null}>
  {#each rowPositions as top, i (i)}
    {@const height = rowHeights[i] ?? 0}
    {@const handleTop = top + height - HANDLE_THICKNESS / 2}
    <button
      type="button"
      class="row-edge-handle"
      style="top: {handleTop}px;"
      data-active={dragIndex === i}
      onpointerdown={(e) => startResize(e, i)}
      aria-label={handleLabel(i)}
      tabindex="-1"
    ></button>
  {/each}
</div>

<style>
  .row-edge-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .row-edge-overlay[data-dragging="true"] {
    /* While dragging, allow the document-level listeners to handle move/up
       events without the overlay's child elements blocking them. */
    cursor: row-resize;
  }
  .row-edge-handle {
    position: absolute;
    left: 0;
    right: 0;
    height: 6px;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: row-resize;
    pointer-events: auto;
    opacity: 0;
    transition: opacity 120ms ease, background-color 120ms ease;
    z-index: 5;
  }
  /* Reveal on hover (or while dragging — the [data-active] selector
     keeps the dragged handle visible even after pointer drifts off). */
  .row-edge-handle:hover,
  .row-edge-handle[data-active="true"] {
    opacity: 1;
    background: color-mix(in srgb, var(--tv-accent, #3366cc) 35%, transparent);
  }
  .row-edge-handle:focus-visible {
    opacity: 1;
    outline: 2px solid var(--tv-focus, var(--tv-accent, #3366cc));
    outline-offset: -2px;
  }
</style>
