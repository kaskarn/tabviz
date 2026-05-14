// Unit tests for the data slice (Phase 0c-C1 PR10).
//
// Covers pagination derived (totalPages / isPaginated / currentPageRowIds /
// paginatedRows / displayRows), banding overrides + the effective derived,
// settings panel, target aspect (incl. clamp + anchor write-through),
// watermark mutations, and the hydrate/reset lifecycle.

import { describe, expect, test } from "vitest";
import {
  buildDataHarness, buildSpec, dataRow, groupHeader,
} from "./data.test-harness.svelte";

describe("data slice — pagination", () => {
  test("isPaginated false when spec has no paginate field", () => {
    const h = buildDataHarness();
    expect(h.slice.totalPages).toBe(0);
    expect(h.slice.isPaginated).toBe(false);
    expect(h.slice.currentPageRowIds.size).toBe(0);
  });

  test("totalPages reflects spec.paginate.nPages", () => {
    const h = buildDataHarness({
      spec: buildSpec({ pages: [{ startIdx: 0, endIdx: 0 }, { startIdx: 1, endIdx: 1 }] }),
    });
    expect(h.slice.totalPages).toBe(2);
    expect(h.slice.isPaginated).toBe(true);
  });

  test("currentPageRowIds returns ids inside the page window", () => {
    const h = buildDataHarness({
      spec: buildSpec({
        rows: [{ id: "a" }, { id: "b" }, { id: "c" }],
        pages: [{ startIdx: 0, endIdx: 1 }, { startIdx: 2, endIdx: 2 }],
      }),
    });
    expect(Array.from(h.slice.currentPageRowIds)).toEqual(["a", "b"]);
    h.slice.setCurrentPage(2);
    expect(Array.from(h.slice.currentPageRowIds)).toEqual(["c"]);
  });

  test("continuousMode disables pagination — currentPageRowIds empty", () => {
    const h = buildDataHarness({
      spec: buildSpec({
        rows: [{ id: "a" }, { id: "b" }],
        pages: [{ startIdx: 0, endIdx: 0 }, { startIdx: 1, endIdx: 1 }],
      }),
    });
    h.slice.setContinuousMode(true);
    expect(h.slice.isPaginated).toBe(false);
    expect(h.slice.currentPageRowIds.size).toBe(0);
  });

  test("setCurrentPage clamps to [1, totalPages]", () => {
    const h = buildDataHarness({
      spec: buildSpec({ pages: [{ startIdx: 0, endIdx: 0 }, { startIdx: 1, endIdx: 1 }] }),
    });
    h.slice.setCurrentPage(99);
    expect(h.slice.currentPage).toBe(2);
    h.slice.setCurrentPage(-5);
    expect(h.slice.currentPage).toBe(1);
  });

  test("setCurrentPage with no pagination snaps to 1", () => {
    const h = buildDataHarness();
    h.slice.setCurrentPage(5);
    expect(h.slice.currentPage).toBe(1);
  });

  test("nextPage / prevPage move within bounds", () => {
    const h = buildDataHarness({
      spec: buildSpec({ pages: [{ startIdx: 0, endIdx: 0 }, { startIdx: 1, endIdx: 1 }] }),
    });
    h.slice.nextPage();
    expect(h.slice.currentPage).toBe(2);
    h.slice.nextPage(); // already at last
    expect(h.slice.currentPage).toBe(2);
    h.slice.prevPage();
    expect(h.slice.currentPage).toBe(1);
    h.slice.prevPage(); // already at first
    expect(h.slice.currentPage).toBe(1);
  });

  test("paginatedRows pulls in group headers whose descendants are on-page", () => {
    const h = buildDataHarness({
      spec: buildSpec({
        rows: [{ id: "a" }, { id: "b" }],
        pages: [{ startIdx: 0, endIdx: 0 }, { startIdx: 1, endIdx: 1 }],
      }),
      fullDisplayRows: [
        groupHeader("g1", 0),
        dataRow("a"),
        groupHeader("g2", 0),
        dataRow("b"),
      ],
    });
    h.slice.setCurrentPage(1);
    expect(h.slice.paginatedRows.map((r) => "row" in r ? r.row.id : r.group.id))
      .toEqual(["g1", "a"]);
    h.slice.setCurrentPage(2);
    expect(h.slice.paginatedRows.map((r) => "row" in r ? r.row.id : r.group.id))
      .toEqual(["g2", "b"]);
  });

  test("displayRows == fullDisplayRows when pagination off", () => {
    const h = buildDataHarness({
      fullDisplayRows: [dataRow("x"), dataRow("y")],
    });
    expect(h.slice.displayRows.length).toBe(2);
  });
});

describe("data slice — banding", () => {
  test("effectiveBanding falls back to {group, null} when nothing set", () => {
    const h = buildDataHarness();
    expect(h.slice.effectiveBanding).toEqual({ mode: "group", level: null });
  });

  test("effectiveBanding picks up theme banding when no override", () => {
    const h = buildDataHarness({
      spec: buildSpec({ themeBanding: { mode: "row", level: null } }),
    });
    expect(h.slice.effectiveBanding.mode).toBe("row");
  });

  test("setBandingOverride string parses + tags source", () => {
    const h = buildDataHarness();
    h.slice.setBandingOverride("none");
    expect(h.slice.bandingOverride?.mode).toBe("none");
    expect(h.sourceMarks).toContain("banding");
  });

  test("setBandingOverride(null) clears the override", () => {
    const h = buildDataHarness();
    h.slice.setBandingOverride("row");
    h.slice.setBandingOverride(null);
    expect(h.slice.bandingOverride).toBeNull();
  });

  test("bandingStartsWithBand defaults: group → true, row → false", () => {
    const h = buildDataHarness();
    h.slice.setBandingOverride({ mode: "group", level: null });
    expect(h.slice.bandingStartsWithBand).toBe(true);
    h.slice.setBandingOverride({ mode: "row", level: null });
    expect(h.slice.bandingStartsWithBand).toBe(false);
  });

  test("setBandingStartsWithBand forces a flip", () => {
    const h = buildDataHarness();
    h.slice.setBandingOverride({ mode: "row", level: null });
    h.slice.setBandingStartsWithBand(true);
    expect(h.slice.bandingStartsWithBand).toBe(true);
    expect(h.sourceMarks).toContain("banding");
  });
});

describe("data slice — settings panel", () => {
  test("open/close/toggle flips settingsOpen", () => {
    const h = buildDataHarness();
    expect(h.slice.settingsOpen).toBe(false);
    h.slice.openSettings();
    expect(h.slice.settingsOpen).toBe(true);
    h.slice.closeSettings();
    expect(h.slice.settingsOpen).toBe(false);
    h.slice.toggleSettings();
    expect(h.slice.settingsOpen).toBe(true);
    h.slice.toggleSettings();
    expect(h.slice.settingsOpen).toBe(false);
  });
});

describe("data slice — target aspect", () => {
  test("setTargetAspect clamps to [0.1, 10] + records op", () => {
    const h = buildDataHarness();
    h.slice.setTargetAspect(50);
    expect(h.slice.targetAspect).toBe(10);
    h.slice.setTargetAspect(0.01);
    expect(h.slice.targetAspect).toBeCloseTo(0.1);
    h.slice.setTargetAspect(null);
    expect(h.slice.targetAspect).toBeNull();
    expect(h.opLog.every((r) => r.kind === "set_aspect_ratio")).toBe(true);
    expect(h.opLog).toHaveLength(3);
  });

  test("setTargetAspect rejects NaN / 0 / negative", () => {
    const h = buildDataHarness();
    h.slice.setTargetAspect(NaN);
    h.slice.setTargetAspect(0);
    h.slice.setTargetAspect(-1);
    expect(h.slice.targetAspect).toBeNull();
    expect(h.opLog).toHaveLength(0);
  });

  test("setTargetAspect skips dup-value calls (no spurious op)", () => {
    const h = buildDataHarness();
    h.slice.setTargetAspect(1.5);
    h.slice.setTargetAspect(1.5);
    expect(h.opLog).toHaveLength(1);
  });

  test("setTargetAspectAnchor writes to spec + records op when aspect pinned", () => {
    const h = buildDataHarness({ spec: buildSpec() });
    h.slice.setTargetAspect(1.5);
    h.opLog.length = 0;
    h.slice.setTargetAspectAnchor("height");
    expect(h.spec?.targetAspectAnchor).toBe("height");
    expect(h.opLog[0].kind).toBe("set_aspect_ratio");
  });

  test("setTargetAspectAnchor is a no-op when anchor doesn't change", () => {
    const h = buildDataHarness({ spec: buildSpec({ targetAspectAnchor: "width" }) });
    h.slice.setTargetAspectAnchor("width");
    expect(h.opLog).toHaveLength(0);
  });
});

describe("data slice — watermark", () => {
  test("setWatermark writes spec + records (empty → NULL)", () => {
    const h = buildDataHarness({ spec: buildSpec() });
    h.slice.setWatermark("DRAFT");
    expect(h.spec?.watermark).toBe("DRAFT");
    expect(h.opLog[0].kind).toBe("set_watermark");
    expect(h.opLog[0].rCall).toContain('"DRAFT"');
    h.opLog.length = 0;
    h.slice.setWatermark("");
    expect(h.spec?.watermark).toBe("");
    expect(h.opLog[0].rCall).toContain("NULL");
  });

  test("previewWatermark mutates spec but emits no op", () => {
    const h = buildDataHarness({ spec: buildSpec() });
    h.slice.previewWatermark("typing…");
    expect(h.spec?.watermark).toBe("typing…");
    expect(h.opLog).toHaveLength(0);
  });

  test("setWatermarkColor / setWatermarkOpacity clamp + write through", () => {
    const h = buildDataHarness({ spec: buildSpec() });
    h.slice.setWatermarkColor("#ff0000");
    expect(h.spec).toMatchObject({ watermarkColor: "#ff0000" });
    h.slice.setWatermarkOpacity(2);
    expect(h.spec).toMatchObject({ watermarkOpacity: 1 });
    h.slice.setWatermarkOpacity(-1);
    expect(h.spec).toMatchObject({ watermarkOpacity: 0 });
  });
});

describe("data slice — lifecycle", () => {
  test("hydrateForSpec resets currentPage + seeds targetAspect", () => {
    const h = buildDataHarness({
      spec: buildSpec({ pages: [{ startIdx: 0, endIdx: 0 }, { startIdx: 1, endIdx: 1 }] }),
    });
    h.slice.setCurrentPage(2);
    h.slice.setContinuousMode(true);
    h.slice.hydrateForSpec(buildSpec({ targetAspect: 0.8 }));
    expect(h.slice.currentPage).toBe(1);
    expect(h.slice.targetAspect).toBe(0.8);
    // continuousMode preserved across hydrate (viewer preference)
    expect(h.slice.continuousMode).toBe(true);
  });

  test("hydrateForSpec ignores non-positive / non-finite aspect", () => {
    const h = buildDataHarness();
    h.slice.hydrateForSpec(buildSpec({ targetAspect: -1 }));
    expect(h.slice.targetAspect).toBeNull();
  });

  test("reset wipes banding overrides", () => {
    const h = buildDataHarness();
    h.slice.setBandingOverride("row");
    h.slice.setBandingStartsWithBand(false);
    h.slice.reset();
    expect(h.slice.bandingOverride).toBeNull();
    expect(h.slice.bandingStartsWithBandOverride).toBeNull();
  });
});
