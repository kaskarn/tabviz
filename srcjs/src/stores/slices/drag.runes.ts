// Unit tests for the drag micro-slice (Phase 0c-C1 PR7).
//
// Tiny slice — bounded state + 4 actions + reset. Tests cover the threshold
// activation, the commit callback firing only when active + targeted, and
// reset for spec-swap cleanup.

import { describe, expect, test, vi } from "vitest";
import { createDragSlice } from "./drag.svelte";
import type { DragState } from "$types";

function seed(): Omit<DragState, "threshold" | "active" | "indicatorIndex" | "currentX" | "currentY"> {
  return {
    kind: "column",
    itemId: "col-1",
    scopeKey: "__root__",
    startX: 100,
    startY: 50,
  } as never;
}

describe("drag micro-slice", () => {
  test("beginDrag seeds state from partial; not yet active", () => {
    const d = createDragSlice();
    d.beginDrag(seed());
    expect(d.dragState).not.toBeNull();
    expect(d.dragState?.active).toBe(false);
    expect(d.dragState?.threshold).toBe(4);
    expect(d.dragState?.currentX).toBe(100);
    expect(d.dragState?.currentY).toBe(50);
  });

  test("updateDrag is a no-op when no drag in flight", () => {
    const d = createDragSlice();
    d.updateDrag(200, 200, 3);
    expect(d.dragState).toBeNull();
  });

  test("updateDrag below threshold keeps active=false", () => {
    const d = createDragSlice();
    d.beginDrag(seed());
    d.updateDrag(102, 51, 0); // sqrt(4+1) < 4
    expect(d.dragState?.active).toBe(false);
    expect(d.dragState?.currentX).toBe(102);
    expect(d.dragState?.indicatorIndex).toBe(0);
  });

  test("updateDrag past threshold flips active=true; stays true after", () => {
    const d = createDragSlice();
    d.beginDrag(seed());
    d.updateDrag(110, 50, 1); // dx=10 > 4
    expect(d.dragState?.active).toBe(true);
    // Subsequent move back near origin still keeps active=true.
    d.updateDrag(101, 50, 2);
    expect(d.dragState?.active).toBe(true);
    expect(d.dragState?.indicatorIndex).toBe(2);
  });

  test("endDrag fires commit when active and has indicator", () => {
    const d = createDragSlice();
    const commit = vi.fn();
    d.beginDrag(seed());
    d.updateDrag(120, 50, 3);
    d.endDrag(commit);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0][0].indicatorIndex).toBe(3);
    expect(d.dragState).toBeNull();
  });

  test("endDrag does NOT fire commit when not active", () => {
    const d = createDragSlice();
    const commit = vi.fn();
    d.beginDrag(seed());
    d.updateDrag(101, 50, 3); // below threshold
    d.endDrag(commit);
    expect(commit).not.toHaveBeenCalled();
    expect(d.dragState).toBeNull();
  });

  test("endDrag does NOT fire commit when indicatorIndex null", () => {
    const d = createDragSlice();
    const commit = vi.fn();
    d.beginDrag(seed());
    d.updateDrag(120, 50, null);
    d.endDrag(commit);
    expect(commit).not.toHaveBeenCalled();
  });

  test("endDrag with no drag in flight is a no-op", () => {
    const d = createDragSlice();
    const commit = vi.fn();
    d.endDrag(commit);
    expect(commit).not.toHaveBeenCalled();
  });

  test("cancelDrag wipes state without firing commit", () => {
    const d = createDragSlice();
    d.beginDrag(seed());
    d.updateDrag(200, 50, 5); // active + targeted
    d.cancelDrag();
    expect(d.dragState).toBeNull();
  });

  test("reset wipes state (used by setSpec / resetState)", () => {
    const d = createDragSlice();
    d.beginDrag(seed());
    d.reset();
    expect(d.dragState).toBeNull();
  });
});
