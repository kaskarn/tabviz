// Unit tests for the axis slice (Phase 0c-C1 PR3) — and the cross-slice
// `$derived`-chain spike.
//
// Beyond the slice's own methods, these tests exercise the critical
// reactivity invariant: a $derived owned by THIS slice (axisComputation,
// xScale) must update when a $derived OWNED BY ANOTHER SLICE (read via
// dep getter closures) changes. If that doesn't hold, the slice idiom
// fails the layout-zoom test and the C1 plan needs amendment.
//
// `$state` only legal inside `.svelte.ts` modules; the live harness with
// reactive test deps lives in `axis.test-harness.svelte.ts`.

import { describe, expect, test } from "vitest";
import { buildAxisHarness, forestCol } from "./axis.test-harness.svelte";

describe("axis slice — setAxisZoom / resetAxisZoom", () => {
  test("setAxisZoom writes domain and source-tags", () => {
    const h = buildAxisHarness();
    h.slice.setAxisZoom("fc", [0.5, 1.5]);
    expect(h.slice.axisZooms["fc"]?.domain).toEqual([0.5, 1.5]);
    expect(h.sourceMarks).toEqual(["axis_zooms"]);
  });

  test("setAxisZoom guards inverted / non-finite domains", () => {
    const h = buildAxisHarness();
    h.slice.setAxisZoom("fc", [1, 1]);
    expect(h.slice.axisZooms["fc"]).toBeUndefined();
    h.slice.setAxisZoom("fc", [2, 1]);
    expect(h.slice.axisZooms["fc"]).toBeUndefined();
    h.slice.setAxisZoom("fc", [Number.NaN, 1]);
    expect(h.slice.axisZooms["fc"]).toBeUndefined();
  });

  test("resetAxisZoom removes only the named column", () => {
    const h = buildAxisHarness();
    h.slice.setAxisZoom("a", [0, 1]);
    h.slice.setAxisZoom("b", [0, 2]);
    h.slice.resetAxisZoom("a");
    expect(h.slice.axisZooms["a"]).toBeUndefined();
    expect(h.slice.axisZooms["b"]).toBeDefined();
  });

  test("getEffectiveDomain falls back to default when no override", () => {
    const h = buildAxisHarness();
    expect(h.slice.getEffectiveDomain("fc", [0, 1])).toEqual([0, 1]);
    h.slice.setAxisZoom("fc", [0.5, 1.5]);
    expect(h.slice.getEffectiveDomain("fc", [0, 1])).toEqual([0.5, 1.5]);
  });

  test("reset clears every per-column override", () => {
    const h = buildAxisHarness();
    h.slice.setAxisZoom("a", [0, 1]);
    h.slice.setAxisZoom("b", [0, 2]);
    h.slice.reset();
    expect(h.slice.axisZooms).toEqual({});
  });
});

describe("axis slice — derived axisComputation", () => {
  test("returns finite axis limits + plot region", () => {
    const h = buildAxisHarness();
    const c = h.slice.axisComputation;
    expect(c.axisLimits.every(Number.isFinite)).toBe(true);
    expect(c.plotRegion.every(Number.isFinite)).toBe(true);
    expect(c.plotRegion[0]).toBeLessThan(c.plotRegion[1]);
    expect(c.ticks.length).toBeGreaterThan(0);
  });

  test("plotRegion shifts when domain override is set", () => {
    const h = buildAxisHarness();
    const before = h.slice.axisComputation.plotRegion;
    h.slice.setAxisZoom("fc", [0.5, 1.5]);
    const after = h.slice.axisComputation.plotRegion;
    expect(after).not.toEqual(before);
    // computeAxis pads the requested override slightly; just check that the
    // override pulled the plot region toward [0.5, 1.5] from its
    // data-derived default.
    expect(after[0]).toBeGreaterThan(before[0]);
    expect(after[1]).toBeLessThan(before[1]);
  });
});

describe("axis slice — cross-slice $derived spike", () => {
  test("xScale.range responds to layout.forestWidth changes (deps.getLayoutForestWidth)", () => {
    const h = buildAxisHarness(400);
    // VIZ_MARGIN = 12 (axis-utils constant). xScale.range = [12, forestWidth - 12].
    const before = h.slice.xScale.range();
    expect(before[0]).toBe(12);
    expect(before[1]).toBe(388);
    // Mutate the "other slice's" state. The slice's $derived must
    // re-evaluate and pick up the new value via deps.getLayoutForestWidth().
    h.setForestWidth(800);
    const after = h.slice.xScale.range();
    expect(after[0]).toBe(12);
    expect(after[1]).toBe(788);
  });

  test("axisComputation tracks forestColumns changes (deps.getForestColumns)", () => {
    const h = buildAxisHarness(400);
    const withForest = h.slice.axisComputation.plotRegion;
    // Drop forest columns — computeAxis falls through with forestWidth=0
    // and produces a different plot region than the with-forest case.
    // The spike-relevant invariant is: re-running the $derived after
    // mutating deps' result MUST produce a different value (proves the
    // dep edge wired up).
    h.setForestColumns([]);
    const noForest = h.slice.axisComputation.plotRegion;
    expect(noForest).not.toEqual(withForest);
  });

  test("xScale tracks both forestColumns AND forestWidth simultaneously", () => {
    const h = buildAxisHarness(300);
    const r0 = h.slice.xScale.range();
    h.setForestColumns([]);
    const r1 = h.slice.xScale.range();
    // No forest → forestWidth=0 path → rangeEnd floored to rangeStart+50.
    expect(r1[1]).toBe(62);
    h.setForestWidth(600); // wide forestWidth, but no forest cols → still floored
    const r2 = h.slice.xScale.range();
    expect(r2[1]).toBe(62);
    // Restore forest cols → forestWidth now contributes.
    h.setForestColumns([{ index: 0, column: forestCol() }]);
    const r3 = h.slice.xScale.range();
    expect(r3[1]).toBe(588); // 600 - 12
    // Sanity: r0 (300px) and r3 (600px) differ → forestWidth dep DID rewire.
    expect(r3[1]).not.toBe(r0[1]);
  });
});
