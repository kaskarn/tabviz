// Unit gate for the B2 grow-merge commit semantics (sizing-model §6c).
//
// The measure loop reports ONLY rows whose content overflows its pinned
// track; growMergeHeights folds each report into the committed map.
// These tests pin the three properties the fix depends on:
//   1. growth commits;
//   2. settled rows (absent from a report) KEEP their committed heights
//      — replacing the map was the oscillation half of B2;
//   3. a no-growth report returns the SAME REFERENCE so the store's
//      reassignment guard settles the commit loop.

import { describe, it, expect } from "bun:test";
import { growMergeHeights } from "./layout-zoom.svelte";

describe("growMergeHeights (B2 commit semantics)", () => {
  it("commits growth from an empty base", () => {
    const out = growMergeHeights(null, { r1: 188 });
    expect(out).toEqual({ r1: 188 });
  });

  it("keeps committed heights for rows absent from the report", () => {
    const prev = { r1: 188, r2: 40 };
    const out = growMergeHeights(prev, { r3: 90 });
    expect(out).toEqual({ r1: 188, r2: 40, r3: 90 });
  });

  it("only grows — a smaller report value never shrinks a committed height", () => {
    const prev = { r1: 188 };
    const out = growMergeHeights(prev, { r1: 100 });
    expect(out).toBe(prev); // unchanged, same reference
  });

  it("returns the same reference on a no-op report (loop-settle guard)", () => {
    const prev = { r1: 188 };
    expect(growMergeHeights(prev, {})).toBe(prev);
    expect(growMergeHeights(prev, { r1: 188 })).toBe(prev);
  });

  it("mixed report: grows some keys, ignores shrinks, keeps the rest", () => {
    const prev = { r1: 188, r2: 40 };
    const out = growMergeHeights(prev, { r1: 100, r2: 60 });
    expect(out).toEqual({ r1: 188, r2: 60 });
    expect(out).not.toBe(prev);
  });
});
