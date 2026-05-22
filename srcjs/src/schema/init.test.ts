// Integration test — importing init.ts boots schemas + behaviors so
// the dispatcher fires built-in contributeBanks for reference columns.

import { describe, test, expect, beforeAll } from "bun:test";
import { computeEffectiveBanks } from "./banks";
import type { ColumnSpec } from "../types";

// Side-effect import triggers behavior registrations.
beforeAll(async () => {
  await import("./init");
});

describe("schema/init — boot wires reference contributeBanks", () => {
  test("reference column populates footnotes from row data", () => {
    const col: ColumnSpec = {
      id: "studies",
      header: "Citation",
      field: "citation",
      type: "reference",
      align: "left",
      sortable: true,
      isGroup: false,
      width: "auto",
      options: { reference: { hrefField: "doi_url" } },
    } as ColumnSpec;

    const eff = computeEffectiveBanks({
      columns: [col],
      data: {
        rows: [
          {
            id: "r1",
            metadata: { citation: "Smith 2020", doi_url: "https://doi.org/1" },
          },
          {
            id: "r2",
            metadata: { citation: "Jones 2021", doi_url: "https://doi.org/2" },
          },
        ],
      },
    } as never);

    expect(eff.footnotes).toHaveLength(2);
    expect(eff.footnotes[0]).toMatchObject({
      id: "studies:r1",
      text: "Smith 2020",
      href: "https://doi.org/1",
      producer: "studies",
      index: 1,
    });
    expect(eff.footnotes[1]).toMatchObject({
      id: "studies:r2",
      text: "Jones 2021",
      producer: "studies",
      index: 2,
    });
  });

  test("reference column without hrefField produces footnotes without href", () => {
    const col: ColumnSpec = {
      id: "notes",
      header: "Notes",
      field: "note",
      type: "reference",
      align: "left",
      sortable: true,
      isGroup: false,
      width: "auto",
      options: { reference: {} },
    } as ColumnSpec;

    const eff = computeEffectiveBanks({
      columns: [col],
      data: { rows: [{ id: "r1", metadata: { note: "Internal memo" } }] },
    } as never);

    expect(eff.footnotes[0].text).toBe("Internal memo");
    expect(eff.footnotes[0].href).toBeUndefined();
  });

  test("user-authored + reference-derived footnotes coexist", () => {
    const col: ColumnSpec = {
      id: "studies",
      header: "Studies",
      field: "ref",
      type: "reference",
      align: "left",
      sortable: true,
      isGroup: false,
      width: "auto",
      options: { reference: {} },
    } as ColumnSpec;

    const eff = computeEffectiveBanks({
      columns: [col],
      data: { rows: [{ id: "r1", metadata: { ref: "Auto" } }] },
      banks: { footnotes: [{ id: "manual", text: "Disclaimer" }] },
    } as never);

    expect(eff.footnotes).toHaveLength(2);
    expect(eff.footnotes[0].id).toBe("manual");
    expect(eff.footnotes[1].id).toBe("studies:r1");
  });
});

describe("schema/init — viz_* contributeBanks: axis + legend", () => {
  test("viz_forest single-effect emits one axis entry", () => {
    const col: ColumnSpec = {
      id: "fr1",
      header: "HR",
      field: "_forest_hr",
      type: "forest",
      align: "center",
      sortable: false,
      isGroup: false,
      width: "auto",
      options: {
        forest: {
          point: "hr",
          scale: "log",
          axisLabel: "Hazard Ratio",
          axisRange: [0.1, 10],
          showAxis: true,
        },
      },
    } as ColumnSpec;
    const eff = computeEffectiveBanks({ columns: [col] } as never);
    expect(eff.axes).toHaveLength(1);
    expect(eff.axes[0]).toMatchObject({
      id: "fr1:axis",
      scale: "log",
      range: [0.1, 10],
      label: "Hazard Ratio",
      attachedTo: ["fr1"],
      producer: "fr1",
    });
    // Single effect → no legend
    expect(eff.legends).toHaveLength(0);
  });

  test("viz_forest with multiple effects emits axis + legend", () => {
    const col: ColumnSpec = {
      id: "fr2",
      header: "HR",
      field: "_forest_multi",
      type: "forest",
      align: "center",
      sortable: false,
      isGroup: false,
      width: "auto",
      options: {
        forest: {
          effects: [
            { id: "e1", label: "Adjusted",   color: "#1f77b4" },
            { id: "e2", label: "Unadjusted", color: "#ff7f0e" },
          ],
          scale: "log",
          showAxis: true,
        },
      },
    } as ColumnSpec;
    const eff = computeEffectiveBanks({ columns: [col] } as never);
    expect(eff.axes).toHaveLength(1);
    expect(eff.legends).toHaveLength(1);
    expect(eff.legends[0].items).toEqual([
      { label: "Adjusted",   color: "#1f77b4" },
      { label: "Unadjusted", color: "#ff7f0e" },
    ]);
    expect(eff.legends[0].attachedTo).toEqual(["fr2"]);
  });

  test("viz_bar with multi-effect emits axis + legend", () => {
    const col: ColumnSpec = {
      id: "bars",
      header: "Pre / Post",
      field: "_viz_bar_pre",
      type: "viz_bar",
      align: "center",
      sortable: false,
      isGroup: false,
      width: "auto",
      options: {
        vizBar: {
          type: "bar",
          effects: [
            { value: "pre",  label: "Pre",  color: "#aaa" },
            { value: "post", label: "Post", color: "#000" },
          ],
          scale: "linear",
          showAxis: true,
        },
      },
    } as ColumnSpec;
    const eff = computeEffectiveBanks({ columns: [col] } as never);
    expect(eff.axes).toHaveLength(1);
    expect(eff.legends).toHaveLength(1);
    expect(eff.legends[0].items.map((i) => i.label)).toEqual(["Pre", "Post"]);
  });

  test("viz_violin shape works", () => {
    const col: ColumnSpec = {
      id: "v1",
      header: "Dist",
      field: "_viz_violin_x",
      type: "viz_violin",
      align: "center",
      sortable: false,
      isGroup: false,
      width: "auto",
      options: {
        vizViolin: {
          effects: [{ data: "values" }],
          scale: "linear",
          showAxis: true,
        },
      },
    } as ColumnSpec;
    const eff = computeEffectiveBanks({ columns: [col] } as never);
    expect(eff.axes).toHaveLength(1);
    // Single effect → no legend
    expect(eff.legends).toHaveLength(0);
  });

  test("showAxis: false suppresses the axis entry", () => {
    const col: ColumnSpec = {
      id: "noax",
      header: "noax",
      field: "_forest_x",
      type: "forest",
      align: "center",
      sortable: false,
      isGroup: false,
      width: "auto",
      options: { forest: { point: "x", showAxis: false } },
    } as ColumnSpec;
    const eff = computeEffectiveBanks({ columns: [col] } as never);
    expect(eff.axes).toHaveLength(0);
  });

  test("removing the viz column removes its axis (next dispatch)", () => {
    const col: ColumnSpec = {
      id: "x",
      header: "x",
      field: "_forest_x",
      type: "forest",
      align: "center",
      sortable: false,
      isGroup: false,
      width: "auto",
      options: { forest: { point: "x", showAxis: true } },
    } as ColumnSpec;
    const before = computeEffectiveBanks({ columns: [col] } as never);
    expect(before.axes).toHaveLength(1);
    const after = computeEffectiveBanks({ columns: [] });
    expect(after.axes).toHaveLength(0);
  });
});
