// Integration test: tabviz({ conditions }) authoring args round-trip
// through to WebSpec.banks.conditions on the wire.

import { describe, test, expect } from "bun:test";
import { tabviz } from "../authoring/tabviz";
import { colText } from "../authoring/columns";
import { cond, fieldRef } from "./styling";

const DATA = [
  { study: "Smith 2020", p: 0.01,  hr: 0.65 },
  { study: "Jones 2021", p: 0.20,  hr: 1.10 },
  { study: "Kim 2022",   p: 0.001, hr: 0.45 },
  { study: "Liu 2023",   p: 0.06,  hr: 0.92 },
];

describe("tabviz({ conditions }) authoring", () => {
  test("conditions land on spec.banks.conditions with materialized values", () => {
    const spec = tabviz({
      data: DATA,
      conditions: [
        { name: "significant", rule: (r) => Number(r.p) < 0.05 },
      ],
      columns: [colText({ field: "study" })],
    });

    expect(spec.banks?.conditions).toBeDefined();
    expect(spec.banks!.conditions).toHaveLength(1);
    const sig = spec.banks!.conditions![0];
    expect(sig.id).toBe("significant");
    expect(sig.kind).toBe("boolean");
    expect(sig.values).toEqual([true, false, true, false]);
  });

  test("Bonferroni-style rule using row count works", () => {
    const spec = tabviz({
      data: DATA,
      conditions: [
        {
          name: "bonferroni",
          rule: (r, rows) => Number(r.p) < 0.05 / rows.length,
        },
      ],
      columns: [colText({ field: "study" })],
    });

    const c = spec.banks!.conditions![0];
    // 0.05 / 4 = 0.0125; only p < 0.0125 passes
    expect(c.values).toEqual([true, false, true, false]);
  });

  test("multiple conditions accumulate", () => {
    const spec = tabviz({
      data: DATA,
      conditions: [
        { name: "sig", rule: (r) => Number(r.p) < 0.05 },
        { name: "low_hr", rule: (r) => Number(r.hr) < 1 },
      ],
      columns: [colText({ field: "study" })],
    });

    expect(spec.banks!.conditions).toHaveLength(2);
    expect(spec.banks!.conditions![0].id).toBe("sig");
    expect(spec.banks!.conditions![1].id).toBe("low_hr");
  });

  test("no conditions → no banks.conditions field", () => {
    const spec = tabviz({
      data: DATA,
      columns: [colText({ field: "study" })],
    });
    expect(spec.banks?.conditions).toBeUndefined();
  });
});

describe("styleMapping with tagged union", () => {
  test("cond() reference flows through the wire", () => {
    const spec = tabviz({
      data: DATA,
      conditions: [{ name: "sig", rule: (r) => Number(r.p) < 0.05 }],
      columns: [
        colText({
          field: "study",
          style: { bold: cond("sig") as never },
        }),
      ],
    });

    const styleMapping = spec.columns[0].isGroup
      ? undefined
      : (spec.columns[0] as { styleMapping?: { bold?: unknown } }).styleMapping;
    expect(styleMapping?.bold).toEqual({ kind: "condition", name: "sig" });
  });

  test("bare-string back-compat: legacy field reference still passes through", () => {
    const spec = tabviz({
      data: DATA,
      columns: [
        colText({
          field: "study",
          style: { bold: "highlight_col" as never },
        }),
      ],
    });
    const styleMapping = spec.columns[0].isGroup
      ? undefined
      : (spec.columns[0] as { styleMapping?: { bold?: unknown } }).styleMapping;
    // Bare string passes through unchanged on the wire (renderer
    // normalizes at read time).
    expect(styleMapping?.bold).toBe("highlight_col");
  });

  test("fieldRef() helper produces tagged union", () => {
    const spec = tabviz({
      data: DATA,
      columns: [
        colText({
          field: "study",
          style: { bold: fieldRef("highlight_col") as never },
        }),
      ],
    });
    const styleMapping = spec.columns[0].isGroup
      ? undefined
      : (spec.columns[0] as { styleMapping?: { bold?: unknown } }).styleMapping;
    expect(styleMapping?.bold).toEqual({ kind: "field", field: "highlight_col" });
  });
});
