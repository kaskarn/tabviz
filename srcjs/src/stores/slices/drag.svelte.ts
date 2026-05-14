// Drag micro-slice — transient pointer-drag state for column and row
// reorder gestures. Both the columns slice (column-header drag) and
// the rows-groups slice (row + group drag) consume this, so the slice
// is constructed independently and injected into both.
//
// Owns:
//   - dragState  current drag (or null when not dragging)
//
// Methods:
//   - beginDrag (seeds dragState from a pointerdown)
//   - updateDrag (per pointermove: bumps cursor + activates after threshold)
//   - endDrag    (per pointerup: fires commit if active + has target indicator)
//   - cancelDrag (Escape or out-of-bounds)
//
// Phase 0c-C1 PR7 (micro-slice). No cross-slice deps — pure local state
// + a `commit` callback the caller passes to endDrag.

import type { DragState } from "$types";

export interface DragSlice {
  readonly dragState: DragState | null;
  beginDrag: (
    partial: Omit<DragState, "threshold" | "active" | "indicatorIndex" | "currentX" | "currentY">,
  ) => void;
  updateDrag: (clientX: number, clientY: number, indicatorIndex: number | null) => void;
  endDrag: (commit: (state: DragState) => void) => void;
  cancelDrag: () => void;
  /** Force-clear drag state. Used by `setSpec` / `resetState` to make
   *  sure a spec swap can't leave a phantom drag mid-gesture. */
  reset: () => void;
}

export function createDragSlice(): DragSlice {
  let dragState = $state<DragState | null>(null);

  function beginDrag(
    partial: Omit<DragState, "threshold" | "active" | "indicatorIndex" | "currentX" | "currentY">,
  ): void {
    dragState = {
      ...partial,
      currentX: partial.startX,
      currentY: partial.startY,
      threshold: 4,
      active: false,
      indicatorIndex: null,
    };
  }

  function updateDrag(
    clientX: number,
    clientY: number,
    indicatorIndex: number | null,
  ): void {
    if (!dragState) return;
    const dx = clientX - dragState.startX;
    const dy = clientY - dragState.startY;
    const active = dragState.active || Math.hypot(dx, dy) > dragState.threshold;
    dragState = { ...dragState, currentX: clientX, currentY: clientY, active, indicatorIndex };
  }

  function endDrag(commit: (state: DragState) => void): void {
    if (!dragState) return;
    if (dragState.active && dragState.indicatorIndex != null) commit(dragState);
    dragState = null;
  }

  function cancelDrag(): void {
    dragState = null;
  }

  function reset(): void {
    dragState = null;
  }

  return {
    get dragState() { return dragState; },
    beginDrag, updateDrag, endDrag, cancelDrag, reset,
  };
}
