// Row-reorder integration tests.
//
// History: these were silently failing under bun:test for months
// (Svelte 5 runes don't execute outside the compiler), then re-enabled
// under vitest in 0c-PR2. At that point the fixture used the v1 theme
// shape which the store had already migrated away from — describe.skip
// preserved CI visibility while the cascade rework finished.
//
// Now that THEME_PRESETS carries real v2 themes (lib/theme/theme-presets.ts),
// the fixture uses cochrane directly. No fixture drift, no @ts-nocheck.

import { expect, test, describe } from "vitest";
import { createTabvizStore } from "./tabvizStore.svelte";
import { THEME_PRESETS } from "$lib/theme/theme-presets";
import type { WebSpec } from "$types";

function buildSpec(): WebSpec {
  return {
    version: "1.0",
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
    theme: THEME_PRESETS.nejm,
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
    const store = createTabvizStore();
    store.setSpec(buildSpec());
    const ids = (store.exportSpec?.data.rows ?? []).map((r) => r.id);
    expect(ids).toEqual(["a1", "a2", "a3", "b1", "b2"]);
  });

  test("moving A3 to front of group A shows up in exportSpec", () => {
    const store = createTabvizStore();
    store.setSpec(buildSpec());
    // drag a3 from index 2 to index 0 within group A
    store.moveRowItem("a3", 0);
    const ids = (store.exportSpec?.data.rows ?? []).map((r) => r.id);
    expect(ids).toEqual(["a3", "a1", "a2", "b1", "b2"]);
  });

  test("rowOrderOverrides is set after moveRowItem", () => {
    const store = createTabvizStore();
    store.setSpec(buildSpec());
    store.moveRowItem("a3", 0);
    expect(store.rowOrderOverrides.byGroup["A"]).toEqual(["a3", "a1", "a2"]);
  });

  test("displayRows data-row sequence reflects reorder", () => {
    const store = createTabvizStore();
    store.setSpec(buildSpec());
    store.moveRowItem("a3", 0);
    const dataIds = store.displayRows
      .filter((dr) => dr.type === "data")
      .map((dr) => (dr as { row: { id: string } }).row.id);
    expect(dataIds).toEqual(["a3", "a1", "a2", "b1", "b2"]);
  });
});
