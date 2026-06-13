import { expect, test, describe } from "bun:test";
import { tabviz } from "./tabviz";
import { colText, colNumeric, colInterval } from "./columns";
import { vizForest } from "./viz";
import { CURRENT_VERSION } from "../spec";
import { resolveInteraction } from "../lib/interaction-resolve";

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
    expect(spec.version).toBe(CURRENT_VERSION);
    expect(spec.theme.name).toBe("nejm");
    expect(spec.data.rows.length).toBe(3);
    expect(spec.data.rows[0].label).toBe("A");
  });

  test("theme name string resolves to preset", () => {
    const spec = tabviz({
      data: SAMPLE_DATA,
      label: "study",
      theme: "nejm",
      columns: [colText({ field: "study" })],
    });
    expect(spec.theme.name).toBe("nejm");
  });

  test("theme {extend, overrides} applies on top of preset", () => {
    const spec = tabviz({
      data: SAMPLE_DATA,
      label: "study",
      theme: { extend: "nejm", overrides: { density: "compact" } },
      columns: [colText({ field: "study" })],
    });
    expect(spec.theme.name).toBe("nejm");
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
    // Label column lives on `spec.labelColumn` (wire-level slot), not
    // prepended to `columns`. User-supplied columns stay in their
    // declared order.
    expect(spec.columns.length).toBe(3);
    expect(spec.labelColumn?.id).toBe("label");
    expect(spec.labels?.title).toBe("Genetic associations with CVD");
    const forestCol = spec.columns[2];
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

  test("interaction tier is SPARSE; resolution supplies conservative defaults", () => {
    const spec = tabviz({
      data: SAMPLE_DATA, label: "study",
      columns: [colText({ field: "study" })],
    });
    // The explicit tier carries ONLY what the author passed — nothing here.
    expect(Object.keys(spec.interaction)).toEqual([]);
    // The resolved surface: reader-safe ON, AND author-grade ON as of the
    // D9 reversal (pre-release maximal-defaults stance, 2026-06-13).
    const r = resolveInteraction(spec);
    expect(r.showLegend).toBe(true);
    expect(r.enableSort).toBe(true);
    expect(r.enableExport).toBe(true);
    expect(r.enableEdit).toBe(true);
    expect(r.enableAxisZoom).toBe(true);
  });

  test("explicitly passed interaction flags reach the sparse tier", () => {
    const spec = tabviz({
      data: SAMPLE_DATA, label: "study",
      columns: [colText({ field: "study" })],
      enableEdit: true,
      enableSort: false,
    });
    expect(spec.interaction).toEqual({ enableSort: false, enableEdit: true });
    const r = resolveInteraction(spec);
    expect(r.enableEdit).toBe(true);
    expect(r.enableSort).toBe(false);
  });
});
