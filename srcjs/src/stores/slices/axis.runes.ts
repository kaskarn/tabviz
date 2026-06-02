// Unit tests for the axis slice — the per-context forest axis resolver
// (`forestAxes` / `primaryForestAxis`) and the cross-slice `$derived` edge.
//
// Beyond the slice's own methods, these tests exercise the reactivity
// invariant: a $derived owned by THIS slice (forestAxes) must update when a
// value OWNED BY ANOTHER SLICE (forest columns, flex widths — read via dep
// getter closures) changes.
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

describe("axis slice — primaryForestAxis", () => {
  test("returns finite axis limits + plot region + ticks", () => {
    const h = buildAxisHarness();
    const c = h.slice.primaryForestAxis;
    expect(c.axisLimits.every(Number.isFinite)).toBe(true);
    expect(c.plotRegion.every(Number.isFinite)).toBe(true);
    expect(c.plotRegion[0]).toBeLessThan(c.plotRegion[1]);
    expect(c.ticks.length).toBeGreaterThan(0);
  });

  test("plotRegion shifts when the primary column's domain override is set", () => {
    const h = buildAxisHarness();
    const before = h.slice.primaryForestAxis.plotRegion;
    h.slice.setAxisZoom("fc", [0.5, 1.5]);
    const after = h.slice.primaryForestAxis.plotRegion;
    expect(after).not.toEqual(before);
    // computeAxis pads the requested override slightly; just check that the
    // override pulled the plot region toward [0.5, 1.5] from its default.
    expect(after[0]).toBeGreaterThan(before[0]);
    expect(after[1]).toBeLessThan(before[1]);
  });
});

describe("axis slice — per-context forestAxes resolver", () => {
  test("scale.range responds to flex-width changes (deps.getFlexWidths)", () => {
    const h = buildAxisHarness(400);
    // VIZ_MARGIN = 12. scale.range = [12, width - 12].
    expect(h.slice.forestAxes.get("fc")!.scale.range()).toEqual([12, 388]);
    h.setForestWidth(800);
    expect(h.slice.forestAxes.get("fc")!.scale.range()).toEqual([12, 788]);
  });

  test("forestAxes tracks forestColumns changes (deps.getForestColumns)", () => {
    const h = buildAxisHarness(400);
    expect(h.slice.forestAxes.size).toBe(1);
    expect(h.slice.forestAxes.has("fc")).toBe(true);
    h.setForestColumns([]);
    expect(h.slice.forestAxes.size).toBe(0);
    // No forest columns → primaryForestAxis is the empty back-stop.
    expect(h.slice.primaryForestAxis.axisLimits).toEqual([0, 1]);
  });

  test("each forest column resolves an independent, keyed axis (per-context)", () => {
    const h = buildAxisHarness(400);
    h.setForestColumns([
      { index: 0, column: forestCol("a") },
      { index: 1, column: forestCol("b") },
    ]);
    expect(h.slice.forestAxes.size).toBe(2);
    expect(h.slice.forestAxes.has("a")).toBe(true);
    expect(h.slice.forestAxes.has("b")).toBe(true);
    // A zoom on one column must not move the other's scale (independent context).
    const bBefore = h.slice.forestAxes.get("b")!.scale.domain();
    h.slice.setAxisZoom("a", [0.5, 1.5]);
    expect(h.slice.forestAxes.get("b")!.scale.domain()).toEqual(bBefore);
    expect(h.slice.forestAxes.get("a")!.scale.domain()).not.toEqual(bBefore);
  });
});
