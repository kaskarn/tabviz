import { expect, test, describe } from "bun:test";
import { createForestStore } from "./forestStore.svelte";
import type { WebSpec, WebTheme } from "../types";

function minimalTheme(): WebTheme {
  return {
    name: "test",
    colors: {
      background: "#fff", foreground: "#000", primary: "#2563eb",
      secondary: "#64748b", accent: "#8b5cf6", muted: "#94a3b8",
      border: "#e2e8f0", rowBg: "#fff", altBg: "#f8fafc",
      interval: "#2563eb",
      intervalLine: "#64748b", summaryFill: "#000", summaryBorder: "#000",
    },
    typography: {
      fontFamily: "system-ui", fontSizeSm: "11px", fontSizeBase: "13px",
      fontSizeLg: "16px", fontWeightNormal: 400, fontWeightMedium: 500,
      fontWeightBold: 600, lineHeight: 1.4, headerFontScale: 1.05,
    },
    spacing: {
      rowHeight: 28, headerHeight: 36,
      padding: 12, containerPadding: 0, cellPaddingX: 10,
      cellPaddingY: 4, axisGap: 12, groupPadding: 8,
    },
    shapes: { pointSize: 8, summaryHeight: 10, lineWidth: 1.5, borderRadius: 4 },
    axis: {
      rangeMin: null, rangeMax: null, tickCount: null, tickValues: null,
      gridlines: false, gridlineStyle: "solid", ciClipFactor: 2.0,
      includeNull: true, symmetric: null, nullTick: true, markerMargin: true,
    },
    layout: {
      plotWidth: "auto",
      containerBorder: true, containerBorderRadius: 8, banding: true,
    },
    groupHeaders: {
      level1FontSize: "14px", level1FontWeight: 700, level1Italic: false,
      level1Background: null, level1BorderBottom: true,
      level2FontSize: "13px", level2FontWeight: 600, level2Italic: false,
      level2Background: null, level2BorderBottom: true,
      level3FontSize: "12px", level3FontWeight: 500, level3Italic: false,
      level3Background: null, level3BorderBottom: false,
      indentPerLevel: 12,
    },
  };
}

function buildSpec(): WebSpec {
  return {
    data: {
      rows: [
        { id: "a1", label: "A1", groupId: "A", metadata: { hr: 0.8, lo: 0.6, hi: 1.0 } },
        { id: "a2", label: "A2", groupId: "A", metadata: { hr: 0.9, lo: 0.7, hi: 1.1 } },
        { id: "a3", label: "A3", groupId: "A", metadata: { hr: 1.0, lo: 0.8, hi: 1.2 } },
        { id: "b1", label: "B1", groupId: "B", metadata: { hr: 0.5, lo: 0.4, hi: 0.7 } },
        { id: "b2", label: "B2", groupId: "B", metadata: { hr: 0.6, lo: 0.5, hi: 0.8 } },
      ],
      groups: [
        { id: "A", label: "Group A", collapsed: false, depth: 0 },
        { id: "B", label: "Group B", collapsed: false, depth: 0 },
      ],
      summaries: [],
    },
    columns: [
      { id: "forest", header: "HR", field: "hr", type: "forest", align: "center",
        sortable: false, isGroup: false,
        options: { forest: { point: "hr", lower: "lo", upper: "hi",
          scale: "linear", nullValue: 1, axisLabel: "HR", showAxis: true } } },
    ],
    theme: minimalTheme(),
    interaction: {
      showFilters: false, showLegend: true, enableSort: true,
      enableCollapse: true, enableSelect: true, enableHover: true,
      enableResize: true, enableExport: true,
      enableFilters: false, enableReorderRows: true,
      enableReorderColumns: false, enableEdit: false,
    },
    layout: { plotWidth: "auto" },
  };
}

describe("row reorder flows into exportSpec", () => {
  test("initial exportSpec preserves source row order", () => {
    const store = createForestStore();
    store.setSpec(buildSpec());
    const ids = (store.exportSpec?.data.rows ?? []).map((r) => r.id);
    expect(ids).toEqual(["a1", "a2", "a3", "b1", "b2"]);
  });

  test("moving A3 to front of group A shows up in exportSpec", () => {
    const store = createForestStore();
    store.setSpec(buildSpec());
    // drag a3 from index 2 to index 0 within group A
    store.moveRowItem("a3", 0);
    const ids = (store.exportSpec?.data.rows ?? []).map((r) => r.id);
    expect(ids).toEqual(["a3", "a1", "a2", "b1", "b2"]);
  });

  test("rowOrderOverrides is set after moveRowItem", () => {
    const store = createForestStore();
    store.setSpec(buildSpec());
    store.moveRowItem("a3", 0);
    expect(store.rowOrderOverrides.byGroup["A"]).toEqual(["a3", "a1", "a2"]);
  });

  test("displayRows data-row sequence reflects reorder", () => {
    const store = createForestStore();
    store.setSpec(buildSpec());
    store.moveRowItem("a3", 0);
    const dataIds = store.displayRows
      .filter((dr) => dr.type === "data")
      .map((dr) => (dr as { row: { id: string } }).row.id);
    expect(dataIds).toEqual(["a3", "a1", "a2", "b1", "b2"]);
  });
});
