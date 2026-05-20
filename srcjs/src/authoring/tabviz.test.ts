import { expect, test, describe } from "bun:test";
import { tabviz } from "./tabviz";
import { colText, colNumeric, colInterval } from "./columns";
import { vizForest } from "./viz";

const SAMPLE_DATA = [
  { study: "A", hr: 0.85, lcl: 0.72, ucl: 0.99, n: 1200 },
  { study: "B", hr: 0.91, lcl: 0.81, ucl: 1.02, n: 2400 },
  { study: "C", hr: 0.78, lcl: 0.65, ucl: 0.93, n: 850 },
];

describe("tabviz top-level constructor", () => {
  test("returns a WebSpec with version + bmj theme by default", () => {
    const spec = tabviz({
      data: SAMPLE_DATA,
      label: "study",
      columns: [colNumeric({ field: "hr" })],
    });
    expect(spec.version).toBe("1.0");
    expect(spec.theme.name).toBe("bmj");
    expect(spec.data.rows.length).toBe(3);
    expect(spec.data.rows[0].label).toBe("A");
  });

  test("theme name string resolves to preset", () => {
    const spec = tabviz({
      data: SAMPLE_DATA,
      label: "study",
      theme: "lancet",
      columns: [colText({ field: "study" })],
    });
    expect(spec.theme.name).toBe("lancet");
  });

  test("theme {extend, overrides} applies on top of preset", () => {
    const spec = tabviz({
      data: SAMPLE_DATA,
      label: "study",
      theme: { extend: "lancet", variants: { density: "compact" } },
      columns: [colText({ field: "study" })],
    });
    expect(spec.theme.name).toBe("lancet");
    expect(spec.theme.spacing.rowHeight).toBe(20); // compact density preset rowHeight
  });

  test("full forest plot spec with mixed columns", () => {
    const spec = tabviz({
      data: SAMPLE_DATA,
      label: "study",
      columns: [
        colInterval({ point: "hr", lower: "lcl", upper: "ucl" }),
        colNumeric({ field: "n", decimals: 0 }),
        vizForest({ point: "hr", lower: "lcl", upper: "ucl", scale: "log" }),
      ],
      title: "Genetic associations with CVD",
    });
    // Label column is auto-inserted at index 0 when `label` is set, so
    // forest is at index 3 (label + interval + numeric + forest).
    expect(spec.columns.length).toBe(4);
    expect(spec.columns[0].id).toBe("label");
    expect(spec.labels?.title).toBe("Genetic associations with CVD");
    const forestCol = spec.columns[3];
    if (forestCol.isGroup) throw new Error("expected leaf column");
    expect(forestCol.type).toBe("forest");
    expect(forestCol.options?.forest?.scale).toBe("log");
    expect(forestCol.options?.forest?.nullValue).toBe(1); // auto-default for log scale
  });

  test("group from data column populates groups list", () => {
    const data = [
      { study: "A", region: "EU", hr: 0.8 },
      { study: "B", region: "EU", hr: 0.9 },
      { study: "C", region: "US", hr: 0.7 },
    ];
    const spec = tabviz({
      data, label: "study", group: "region",
      columns: [colNumeric({ field: "hr" })],
    });
    expect(spec.data.groups.length).toBe(2);
    expect(spec.data.groups[0].id).toBe("EU");
    expect(spec.data.groups[1].id).toBe("US");
  });

  test("interaction defaults: all enabled", () => {
    const spec = tabviz({
      data: SAMPLE_DATA, label: "study",
      columns: [colText({ field: "study" })],
    });
    expect(spec.interaction.showLegend).toBe(true);
    expect(spec.interaction.enableSort).toBe(true);
    expect(spec.interaction.enableExport).toBe(true);
  });
});
