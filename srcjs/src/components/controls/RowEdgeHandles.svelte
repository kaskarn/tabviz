<script lang="ts">
  // Per-row-kind height drag handles (interactivity-UX arc P2; was Phase 5,
  // shipped disabled — the old mount sat at widget-root level where
  // computeRowLayout's rowPositions never aligned. The overlay now mounts
  // INSIDE the rows region — the same coordinate space the spacing
  // EdgeResize seams already use — offset by `topOffset` (the header
  // band height), so positions line up by construction and the whole
  // overlay scales WYSIWYG with zoom.)
  //
  // THE MODEL IS PER-KIND: a pin applies to every row of the dragged row's
  // kind (data / summary / spacer / group_header). That MUST be visible
  // during the gesture or "I dragged one row and twelve moved" reads as a
  // bug — so hovering or dragging a handle ghost-highlights every affected
  // row.
  //
  // Seam grammar (shared with EdgeResize):
  //   drag         → live per-kind pin updates (slice state; no op-log)
  //   Escape       → cancel: restore the drag-start pin (or release)
  //   double-click → release the pin (back to the cascade default)
  //   readout      → live "<kind> · NNpx" label while dragging/focused
  //   keyboard     → ArrowUp/Down ±1px (Shift ±10px) on focused handles

  import { onDestroy } from "svelte";
  import type { TabvizStore } from "$stores/tabvizStore.svelte";
  import type { RowKind } from "$lib/layout/row-kind";
  import { resolveRowKind } from "$lib/layout/row-kind";
  import { elementScale } from "$lib/scale-factor";
  import type { DisplayRow } from "$types";

  interface Props {
    store: TabvizStore;
    /** Per-row Y positions (top of each row), in rows-region coordinates. */
    rowPositions: readonly number[];
    /** Per-row heights — grid TRACK heights, which INCLUDE any trailing
     *  rowGroupPadding on group-boundary rows. */
    rowHeights: readonly number[];
    /** Per-row data — used to resolve each row's kind. Length must match
     *  rowPositions / rowHeights. */
    displayRows: readonly DisplayRow[];
    /** Per-row trailing rowGroupPadding (px; 0 for most rows). Handles sit
     *  on the row's VISIBLE bottom (track bottom − pad), which (a) puts the
     *  handle where the row visually ends, (b) keeps it clear of the
     *  group-gap EdgeResize seam at the track bottom (review pass: the two
     *  affordances previously occupied the exact same 10px band, with the
     *  row handle winning every hit), and (c) keeps the trailing pad OUT of
     *  the height that gets pinned for the whole kind. */
    trailingPads?: readonly number[];
    /** Y offset of the rows region inside the overlay's parent (the
     *  header band height — same offset the spacing seams apply). */
    topOffset?: number;
    /** Render + interact? (the arrange tool's armed state). */
    enabled?: boolean;
  }

  const MIN_HEIGHT_PX = 8; // absolute floor — content grows rows back anyway

  const {
    store,
    rowPositions,
    rowHeights,
    displayRows,
    trailingPads,
    topOffset = 0,
    enabled = true,
  }: Props = $props();

  // Drag state — captured on pointerdown.
  let dragKind = $state.raw<RowKind | null>(null);
  let hoverKind = $state.raw<RowKind | null>(null);
  let dragIndex = $state.raw<number | null>(null);
  let dragValue = $state(0);
  let startY = 0;
  let startHeight = 0;
  let dragScale = 1;
  let dragMoved = false; // crossed the 2px dead-zone — a pure click pins nothing
  let startPin: number | undefined; // pin value at drag start (undefined = unpinned)

  const ghostKind = $derived(dragKind ?? hoverKind);

  function kindOf(rowIdx: number): RowKind {
    return resolveRowKind(displayRows[rowIdx]);
  }

  /** Panel rows are content-driven (markdown measure) — no handle. */
  function resizable(rowIdx: number): boolean {
    return kindOf(rowIdx) !== "panel";
  }

  /** The row's VISIBLE height: grid track minus trailing group padding —
   *  the value a per-kind pin should be derived from. */
  function visibleHeight(rowIdx: number): number {
    return (rowHeights[rowIdx] ?? 0) - (trailingPads?.[rowIdx] ?? 0);
  }

  function startResize(e: PointerEvent, rowIdx: number): void {
    if (!store || !enabled || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const kind = kindOf(rowIdx);
    dragKind = kind;
    dragIndex = rowIdx;
    startY = e.clientY;
    startHeight = visibleHeight(rowIdx);
    // Client→layout px: the overlay lives inside the CSS-scaled subtree.
    dragScale = elementScale(e.currentTarget as HTMLElement);
    startPin = store.rowKindHeights[kind];
    dragValue = Math.round(startHeight);
    dragMoved = false;
    attachDragListeners();
  }

  function onResize(e: PointerEvent): void {
    if (dragKind === null || dragIndex === null || !store) return;
    const delta = (e.clientY - startY) / dragScale;
    // Dead-zone: a click with sub-2px pointer jitter must NOT pin the whole
    // kind (matches EdgeResize / column-resize "zero-movement commits nothing").
    if (!dragMoved && Math.abs(delta) < 2) return;
    dragMoved = true;
    const newHeight = Math.max(MIN_HEIGHT_PX, Math.round(startHeight + delta));
    if (newHeight !== dragValue) {
      dragValue = newHeight;
      // Live preview: per-kind pins are slice state (no op-log), so the
      // pin update IS the preview — every row of the kind tracks the drag.
      store.setRowKindHeight(dragKind, newHeight);
    }
  }

  function stopResize(commit: boolean): void {
    if (dragKind !== null && !commit) {
      // Escape = cancel: restore the drag-start pin (undefined = release).
      store.setRowKindHeight(dragKind, startPin ?? null);
    }
    dragKind = null;
    dragIndex = null;
    detachDragListeners();
  }

  function releasePin(rowIdx: number): void {
    // Double-click: back to the cascade-resolved default for this kind.
    store.setRowKindHeight(kindOf(rowIdx), null);
  }

  function handleKeydown(e: KeyboardEvent, rowIdx: number): void {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    e.stopPropagation();
    const kind = kindOf(rowIdx);
    // Nudge from the existing pin when set (else the row's visible height):
    // nudging from a content-grown row's rendered height would JUMP the
    // whole kind to the inflated value on the first keypress.
    const current = Math.round(store.rowKindHeights[kind] ?? visibleHeight(rowIdx));
    const step = (e.shiftKey ? 10 : 1) * (e.key === "ArrowDown" ? 1 : -1);
    store.setRowKindHeight(kind, Math.max(MIN_HEIGHT_PX, current + step));
  }

  function onWindowPointerUp(): void { stopResize(true); }
  function onWindowBlur(): void { stopResize(true); }
  function onWindowKey(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      stopResize(false);
    }
  }
  function attachDragListeners(): void {
    document.addEventListener("pointermove", onResize);
    document.addEventListener("pointerup", onWindowPointerUp);
    document.addEventListener("pointercancel", onWindowPointerUp);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("keydown", onWindowKey, true);
  }
  function detachDragListeners(): void {
    document.removeEventListener("pointermove", onResize);
    document.removeEventListener("pointerup", onWindowPointerUp);
    document.removeEventListener("pointercancel", onWindowPointerUp);
    window.removeEventListener("blur", onWindowBlur);
    window.removeEventListener("keydown", onWindowKey, true);
  }

  // Destroy mid-drag (e.g. a Shiny push drops enableArrange and the
  // arrange block unmounts): CANCEL the gesture — restoring the pin the
  // server-revoked mode started from — and tear the document listeners
  // down (they'd otherwise keep writing through the closure forever).
  onDestroy(() => {
    if (dragKind !== null) stopResize(false);
  });

  function handleLabel(rowIdx: number): string {
    const kind = kindOf(rowIdx).replace("_", " ");
    return `Resize all ${kind} rows`;
  }
</script>

{#if enabled}
  <div class="row-edge-overlay" data-dragging={dragKind !== null}>
    <!-- Ghost highlight: every row of the hovered/dragged KIND, so the
         per-kind model is visible before and during the gesture. -->
    {#if ghostKind !== null}
      {#each rowPositions as top, i (i)}
        {#if kindOf(i) === ghostKind}
          <div
            class="row-kind-ghost"
            style="top: {topOffset + top}px; height: {visibleHeight(i)}px;"
            aria-hidden="true"
          ></div>
        {/if}
      {/each}
    {/if}
    {#each rowPositions as top, i (i)}
      {#if resizable(i)}
        <button
          type="button"
          class="row-edge-handle"
          style="top: {topOffset + top + visibleHeight(i)}px;"
          data-active={dragIndex === i}
          onpointerdown={(e) => startResize(e, i)}
          ondblclick={() => releasePin(i)}
          onkeydown={(e) => handleKeydown(e, i)}
          onpointerenter={() => { if (dragKind === null) hoverKind = kindOf(i); }}
          onpointerleave={() => { hoverKind = null; }}
          onfocus={() => { hoverKind = kindOf(i); }}
          onblur={() => { hoverKind = null; }}
          aria-label={handleLabel(i)}
        >
          {#if dragIndex === i}
            <span class="row-edge-readout" aria-hidden="true">
              {kindOf(i).replace("_", " ")} · {dragValue}px
            </span>
          {/if}
        </button>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .row-edge-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 5;
  }
  .row-edge-overlay[data-dragging="true"] {
    cursor: row-resize;
  }
  .row-kind-ghost {
    position: absolute;
    left: 0;
    right: 0;
    background: color-mix(in srgb, var(--tv-accent, #3366cc) 9%, transparent);
    border-top: 1px solid color-mix(in srgb, var(--tv-accent, #3366cc) 25%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--tv-accent, #3366cc) 25%, transparent);
    pointer-events: none;
  }
  .row-edge-handle {
    position: absolute;
    left: 0;
    right: 0;
    height: 10px;
    transform: translateY(-50%);
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: row-resize;
    pointer-events: auto;
    touch-action: none;
    z-index: 6;
  }
  /* Armed visibility: a faint center bar, brighter on hover/drag/focus —
     the same visual language as EdgeResize seams. */
  .row-edge-handle::before {
    content: "";
    position: absolute;
    left: 8px;
    right: 8px;
    top: 50%;
    height: 2px;
    transform: translateY(-50%);
    border-radius: 1px;
    background: var(--tv-accent, #3366cc);
    opacity: 0.18;
    transition: opacity 120ms ease;
    pointer-events: none;
  }
  .row-edge-handle:hover::before,
  .row-edge-handle[data-active="true"]::before,
  .row-edge-handle:focus-visible::before {
    opacity: 0.6;
  }
  .row-edge-handle:focus-visible {
    outline: none; /* the ::before bar carries focus visibility */
  }
  .row-edge-readout {
    position: absolute;
    top: 50%;
    right: 12px;
    transform: translateY(calc(-50% - 12px));
    padding: 1px 6px;
    font-family: var(--tv-text-body-family, system-ui);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--tv-surface-bg, #fff);
    background: var(--tv-accent, #2563eb);
    border-radius: 3px;
    pointer-events: none;
  }
</style>
