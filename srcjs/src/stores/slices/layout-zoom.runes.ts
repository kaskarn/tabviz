// Unit tests for the layout-zoom slice (Phase 0c-C1 PR11).
//
// Covers the action surface (setDimensions, container/scalable setters,
// plot-width override, zoom family, fit-to-width, max-dim setters) and
// the fit/scale derived chain (fitScale, minZoomFloor, actualScale,
// isClamped, naturalContentWidth). The big `layout` $derived itself is
// validated by the visual battery — jsdom can't run a canvas
// measureText pass reliably enough to assert layout numbers here.
//
// localStorage persistence is exercised indirectly through setZoom +
// reload by clearing state and re-setting the container id.

import { describe, expect, test, beforeEach } from "vitest";
import { buildLayoutZoomHarness } from "./layout-zoom.test-harness.svelte";

// vitest's jsdom env doesn't supply a working Storage prototype. Hand-roll
// a Map-backed mock and mount it on both `globalThis` and `window` so the
// slice's `localStorage.{getItem,setItem}` calls land on it.
beforeEach(() => {
  const store = new Map<string, string>();
  const mock: Storage = {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (k: string) => store.get(k) ?? null,
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    removeItem: (k: string) => { store.delete(k); },
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
  };
  Object.defineProperty(globalThis, "localStorage", { value: mock, configurable: true });
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", { value: mock, configurable: true });
  }
});

describe("layout-zoom slice — effective dims", () => {
  test("effectiveWidth/Height prefer container over initial", () => {
    const h = buildLayoutZoomHarness();
    h.slice.setDimensions(800, 400);
    expect(h.slice.effectiveWidth).toBe(800);
    expect(h.slice.effectiveHeight).toBe(400);
    h.slice.setContainerDimensions(1200, 600);
    expect(h.slice.effectiveWidth).toBe(1200);
    expect(h.slice.effectiveHeight).toBe(600);
  });

  test("setContainerDimensions writes through (no markSource)", () => {
    const h = buildLayoutZoomHarness();
    h.slice.setContainerDimensions(999, 500);
    expect(h.slice.containerWidth).toBe(999);
    expect(h.slice.containerHeight).toBe(500);
    expect(h.sourceMarks).toHaveLength(0);
  });

  test("setScalableNaturalDimensions writes through", () => {
    const h = buildLayoutZoomHarness();
    h.slice.setScalableNaturalDimensions(700, 350);
    expect(h.slice.scalableNaturalWidth).toBe(700);
    expect(h.slice.scalableNaturalHeight).toBe(350);
  });
});

describe("layout-zoom slice — zoom controls", () => {
  test("setZoom clamps to [0.5, 2.0] + tags source", () => {
    const h = buildLayoutZoomHarness();
    h.slice.setZoom(5);
    expect(h.slice.zoom).toBe(2.0);
    h.slice.setZoom(0.1);
    expect(h.slice.zoom).toBe(0.5);
    expect(h.sourceMarks.filter((m) => m === "zoom").length).toBe(2);
  });

  test("zoomIn / zoomOut step by ×1.1 and clamp", () => {
    const h = buildLayoutZoomHarness();
    h.slice.setZoom(1.0);
    h.slice.zoomIn();
    expect(h.slice.zoom).toBeCloseTo(1.1);
    h.slice.zoomOut();
    expect(h.slice.zoom).toBeCloseTo(1.0);
  });

  test("resetZoom returns to 1.0", () => {
    const h = buildLayoutZoomHarness();
    h.slice.setZoom(1.8);
    h.slice.resetZoom();
    expect(h.slice.zoom).toBe(1.0);
  });

  test("setAutoFit / setMaxWidth / setMaxHeight / setShowZoomControls tag source", () => {
    const h = buildLayoutZoomHarness();
    h.slice.setAutoFit(false);
    h.slice.setMaxWidth(1200);
    h.slice.setMaxHeight(800);
    h.slice.setShowZoomControls(false);
    expect(h.slice.autoFit).toBe(false);
    expect(h.slice.maxWidth).toBe(1200);
    expect(h.slice.maxHeight).toBe(800);
    expect(h.slice.showZoomControls).toBe(false);
    expect(h.sourceMarks.every((m) => m === "zoom")).toBe(true);
  });

  test("fitToWidth no-ops without containerWidth / scalableNaturalWidth", () => {
    const h = buildLayoutZoomHarness();
    h.slice.fitToWidth();
    expect(h.slice.zoom).toBe(1.0);
  });

  test("fitToWidth sizes zoom to containerWidth/scalableNaturalWidth, clamped", () => {
    const h = buildLayoutZoomHarness();
    h.slice.setContainerDimensions(600, 400);
    h.slice.setScalableNaturalDimensions(1200, 800); // ratio 0.5
    h.slice.fitToWidth();
    expect(h.slice.zoom).toBe(0.5);

    h.slice.setContainerDimensions(2000, 400);
    h.slice.setScalableNaturalDimensions(500, 800); // ratio 4 → clamps to 2.0
    h.slice.fitToWidth();
    expect(h.slice.zoom).toBe(2.0);
  });
});

describe("layout-zoom slice — plot width", () => {
  test("setPlotWidth clamps at 100px floor + tags source", () => {
    const h = buildLayoutZoomHarness();
    h.slice.setPlotWidth(50);
    expect(h.slice.getPlotWidth()).toBe(100);
    h.slice.setPlotWidth(300);
    expect(h.slice.getPlotWidth()).toBe(300);
    h.slice.setPlotWidth(null);
    expect(h.slice.getPlotWidth()).toBeNull();
    expect(h.sourceMarks.every((m) => m === "plot_width")).toBe(true);
  });
});

describe("layout-zoom slice — fit/scale derived", () => {
  test("fitScale 1 when container or scalable are zero", () => {
    const h = buildLayoutZoomHarness();
    expect(h.slice.fitScale).toBe(1);
    h.slice.setContainerDimensions(500, 300);
    expect(h.slice.fitScale).toBe(1);
  });

  test("fitScale shrinks proportionally when content overflows", () => {
    const h = buildLayoutZoomHarness();
    h.slice.setContainerDimensions(500, 300);
    h.slice.setScalableNaturalDimensions(1000, 600);
    expect(h.slice.fitScale).toBe(0.5);
  });

  test("fitScale 1 when content fits", () => {
    const h = buildLayoutZoomHarness();
    h.slice.setContainerDimensions(1000, 600);
    h.slice.setScalableNaturalDimensions(500, 300);
    expect(h.slice.fitScale).toBe(1);
  });

  test("isClamped is true iff autoFit && fitScale < 1", () => {
    const h = buildLayoutZoomHarness();
    h.slice.setContainerDimensions(500, 300);
    h.slice.setScalableNaturalDimensions(1000, 600);
    expect(h.slice.isClamped).toBe(true);
    h.slice.setAutoFit(false);
    expect(h.slice.isClamped).toBe(false);
  });

  test("minZoomFloor: 0.5 by default, 0.05 when aspect pinned + autoFit", () => {
    const h = buildLayoutZoomHarness();
    expect(h.slice.minZoomFloor).toBe(0.5);
    h.setTargetAspect(1.5);
    expect(h.slice.minZoomFloor).toBe(0.05);
    h.slice.setAutoFit(false);
    expect(h.slice.minZoomFloor).toBe(0.5);
  });

  test("actualScale = zoom × fitScale when autoFit, clamped by minZoomFloor", () => {
    const h = buildLayoutZoomHarness();
    h.slice.setContainerDimensions(500, 300);
    h.slice.setScalableNaturalDimensions(1000, 600);
    h.slice.setZoom(1.0);
    expect(h.slice.actualScale).toBe(0.5);
    h.slice.setAutoFit(false);
    expect(h.slice.actualScale).toBe(1.0);
  });
});

describe("layout-zoom slice — localStorage persistence", () => {
  test("setContainerElementId loads persisted state", () => {
    // Seed localStorage manually
    window.localStorage.setItem("tabviz_zoom_pin1", JSON.stringify({
      zoom: 1.7, autoFit: false, maxWidth: 800, maxHeight: null, version: 2,
    }));
    const h = buildLayoutZoomHarness();
    h.slice.setContainerElementId("pin1");
    expect(h.slice.zoom).toBe(1.7);
    expect(h.slice.autoFit).toBe(false);
    expect(h.slice.maxWidth).toBe(800);
  });

  test("setZoom persists to localStorage when container id set", () => {
    const h = buildLayoutZoomHarness();
    h.slice.setContainerElementId("pin2");
    h.slice.setZoom(1.4);
    const stored = JSON.parse(window.localStorage.getItem("tabviz_zoom_pin2")!);
    expect(stored).toMatchObject({ zoom: 1.4, version: 2 });
  });

  test("old version 1 entries are ignored (defaults stay)", () => {
    window.localStorage.setItem("tabviz_zoom_pin3", JSON.stringify({
      zoom: 1.5, version: 1,
    }));
    const h = buildLayoutZoomHarness();
    h.slice.setContainerElementId("pin3");
    expect(h.slice.zoom).toBe(1.0);
  });

  test("malformed JSON is silently tolerated", () => {
    window.localStorage.setItem("tabviz_zoom_pin4", "{not-json");
    const h = buildLayoutZoomHarness();
    expect(() => h.slice.setContainerElementId("pin4")).not.toThrow();
    expect(h.slice.zoom).toBe(1.0);
  });
});

describe("layout-zoom slice — empty-spec layout fallback", () => {
  test("layout returns canvas-sized fallback when spec is null", () => {
    const h = buildLayoutZoomHarness({ spec: null });
    h.slice.setDimensions(900, 500);
    const l = h.slice.layout;
    expect(l.totalWidth).toBe(900);
    expect(l.totalHeight).toBe(500);
    expect(l.headerHeight).toBe(36);
    expect(l.rowHeight).toBe(28);
    expect(l.rowPositions).toEqual([]);
    expect(l.rowHeights).toEqual([]);
  });
});

describe("layout-zoom slice — reset", () => {
  test("reset restores zoom/autoFit/maxes/plotWidth defaults", () => {
    const h = buildLayoutZoomHarness();
    h.slice.setZoom(1.7);
    h.slice.setAutoFit(false);
    h.slice.setMaxWidth(1000);
    h.slice.setMaxHeight(800);
    h.slice.setPlotWidth(500);
    h.slice.reset();
    expect(h.slice.zoom).toBe(1.0);
    expect(h.slice.autoFit).toBe(true);
    expect(h.slice.maxWidth).toBeNull();
    expect(h.slice.maxHeight).toBeNull();
    expect(h.slice.plotWidthOverride).toBeNull();
  });
});

describe("layout-zoom slice — contrast override (a11y B2)", () => {
  test("defaults to auto; setContrastOverride flips it + tags source", () => {
    const h = buildLayoutZoomHarness();
    expect(h.slice.contrastOverride).toBe("auto");
    h.slice.setContrastOverride("more");
    expect(h.slice.contrastOverride).toBe("more");
    expect(h.sourceMarks).toContain("zoom");
  });
});
