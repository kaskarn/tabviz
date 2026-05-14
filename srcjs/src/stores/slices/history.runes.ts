// Unit tests for the history micro-slice (Phase 0c-C1 PR8).
//
// Critical regression target: the coalesce + dedupe rules. The
// aspect-slider drag bug from commit 8b39868 (dozens of slider-tick
// `set_aspect_ratio(...)` lines in View Source) is what made coalesce
// necessary; these tests pin that behaviour.

import { describe, expect, test } from "vitest";
import { createHistorySlice } from "./history.svelte";
import { ops } from "$lib/op-recorder";

describe("history micro-slice — appendOp + coalesce", () => {
  test("appendOp appends distinct records in order", () => {
    const h = createHistorySlice();
    h.appendOp(ops.sortRows("x", "asc"));
    h.appendOp(ops.clearFilters());
    expect(h.opLog).toHaveLength(2);
    expect(h.opLog[0].kind).toBe("sort_rows");
    expect(h.opLog[1].kind).toBe("clear_filters");
  });

  test("appendOp drops byte-for-byte duplicates of the previous record", () => {
    const h = createHistorySlice();
    h.appendOp(ops.sortRows("x", "asc"));
    h.appendOp(ops.sortRows("x", "asc"));
    expect(h.opLog).toHaveLength(1);
  });

  test("appendOp keeps duplicates separated by a different op", () => {
    const h = createHistorySlice();
    h.appendOp(ops.sortRows("x", "asc"));
    h.appendOp(ops.clearFilters());
    h.appendOp(ops.sortRows("x", "asc"));
    expect(h.opLog).toHaveLength(3);
  });

  test("set_aspect_ratio: consecutive values coalesce to the latest", () => {
    const h = createHistorySlice();
    h.appendOp(ops.setAspectRatio(0.961));
    h.appendOp(ops.setAspectRatio(0.975));
    h.appendOp(ops.setAspectRatio(1.002));
    h.appendOp(ops.setAspectRatio(1.143));
    expect(h.opLog).toHaveLength(1);
    expect(h.opLog[0].rCall).toContain("1.143");
  });

  test("set_aspect_ratio coalesce DOES NOT cross a different op", () => {
    const h = createHistorySlice();
    h.appendOp(ops.setAspectRatio(0.5));
    h.appendOp(ops.sortRows("x", "asc"));
    h.appendOp(ops.setAspectRatio(0.7));
    expect(h.opLog).toHaveLength(3);
    expect(h.opLog[0].kind).toBe("set_aspect_ratio");
    expect(h.opLog[1].kind).toBe("sort_rows");
    expect(h.opLog[2].kind).toBe("set_aspect_ratio");
  });

  test("non-coalesce kinds keep every distinct record", () => {
    const h = createHistorySlice();
    h.appendOp(ops.sortRows("x", "asc"));
    h.appendOp(ops.sortRows("y", "desc"));
    h.appendOp(ops.sortRows("z", "asc"));
    expect(h.opLog).toHaveLength(3);
  });
});

describe("history micro-slice — reset", () => {
  test("reset wipes the log", () => {
    const h = createHistorySlice();
    h.appendOp(ops.sortRows("x", "asc"));
    h.appendOp(ops.clearFilters());
    h.reset();
    expect(h.opLog).toEqual([]);
  });
});
