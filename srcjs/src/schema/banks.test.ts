// Tests for widget banks + computeEffectiveBanks dispatcher.

import { describe, test, expect, beforeEach } from "bun:test";
import {
  computeEffectiveBanks,
  derivedId,
  type AxisEntry,
} from "./banks";
import {
  registerBehaviors,
  __resetRuntimeRegistries,
} from "./extend";
import type { ColumnSpec } from "../types";

const fakeColumn = (
  id: string,
  type: string,
  options?: Record<string, unknown>,
): ColumnSpec =>
  ({
    id,
    header: id,
    field: id,
    type: type as ColumnSpec["type"],
    align: "left",
    sortable: true,
    isGroup: false,
    width: "auto",
    options,
  }) as ColumnSpec;

beforeEach(() => __resetRuntimeRegistries());

describe("computeEffectiveBanks — author-supplied entries", () => {
  test("user-authored footnotes pass through unchanged", () => {
    const eff = computeEffectiveBanks({
      columns: [],
      banks: {
        footnotes: [
          { id: "fn1", text: "Methods note 1" },
          { id: "fn2", text: "Disclaimer" },
        ],
      },
    });
    expect(eff.footnotes).toHaveLength(2);
    expect(eff.footnotes[0].id).toBe("fn1");
    expect(eff.footnotes[0].index).toBe(1);
    expect(eff.footnotes[1].index).toBe(2);
  });

  test("user-authored axes/legends pass through", () => {
    const axis: AxisEntry = {
      id: "main",
      scale: "linear",
      range: [0, 1],
      position: "bottom",
    };
    const eff = computeEffectiveBanks({
      columns: [],
      banks: { axes: [axis] },
    });
    expect(eff.axes).toEqual([axis]);
  });

  test("empty spec returns empty banks", () => {
    const eff = computeEffectiveBanks({ columns: [] });
    expect(eff.footnotes).toEqual([]);
    expect(eff.axes).toEqual([]);
    expect(eff.legends).toEqual([]);
  });
});

describe("computeEffectiveBanks — schema contributions", () => {
  test("built-in schema with user-overlay behaviors fires", () => {
    // The reference schema is built-in. Overlaying its behaviors
    // lets us declare contributeBanks without registering a new
    // schema. Dispatcher finds REFERENCE_SCHEMA by type then calls
    // its (newly-registered) behaviors.
    registerBehaviors("reference", {
      contributeBanks: (column) => ({
        footnotes: [
          { id: derivedId(column.id, "0"), text: "Auto-derived note" },
        ],
      }),
    });
    const eff = computeEffectiveBanks({
      columns: [fakeColumn("c1", "reference")],
      banks: { footnotes: [{ id: "manual", text: "Manual" }] },
    });
    expect(eff.footnotes).toHaveLength(2);
    expect(eff.footnotes[0].id).toBe("manual");
    expect(eff.footnotes[1].id).toBe("c1:0");
    expect(eff.footnotes[1].producer).toBe("c1");
    expect(eff.footnotes[0].producer).toBeUndefined();
  });

  test("removing a column removes its derived entries (next dispatch)", () => {
    registerBehaviors("reference", {
      contributeBanks: (column) => ({
        footnotes: [
          { id: derivedId(column.id, "0"), text: "Note for " + column.id },
        ],
      }),
    });
    const withColumn = computeEffectiveBanks({
      columns: [fakeColumn("c2", "reference")],
    });
    expect(withColumn.footnotes).toHaveLength(1);
    const withoutColumn = computeEffectiveBanks({ columns: [] });
    expect(withoutColumn.footnotes).toHaveLength(0);
  });

  test("multiple columns contribute additively; ordering follows columns array", () => {
    registerBehaviors("reference", {
      contributeBanks: (column) => ({
        footnotes: [{ id: derivedId(column.id, "x"), text: column.id }],
      }),
    });
    const eff = computeEffectiveBanks({
      columns: [
        fakeColumn("first", "reference"),
        fakeColumn("second", "reference"),
      ],
    });
    expect(eff.footnotes.map((f) => f.text)).toEqual(["first", "second"]);
    expect(eff.footnotes[0].index).toBe(1);
    expect(eff.footnotes[1].index).toBe(2);
  });

  test("(type, bucket) disambiguation: percent overlay fires on percent column", () => {
    // Both NUMERIC and PERCENT schemas have type "numeric"; the
    // dispatcher should prefer PERCENT when the column has
    // `options.percent` set.
    registerBehaviors("percent", {
      contributeBanks: (column) => ({
        legends: [
          {
            id: derivedId(column.id, "pct-leg"),
            items: [{ label: "%", color: "#000" }],
          },
        ],
      }),
    });
    registerBehaviors("numeric", {
      contributeBanks: () => ({
        legends: [{ id: "num-leg", items: [{ label: "raw", color: "#0000ff" }] }],
      }),
    });

    // Percent-bucketed column: bucket "percent" present → percent fires
    const percentCol = fakeColumn("p1", "numeric", {
      percent: { multiply: true, symbol: true },
    });
    const effPct = computeEffectiveBanks({ columns: [percentCol] });
    expect(effPct.legends.some((l) => l.id === "p1:pct-leg")).toBe(true);
    expect(effPct.legends.some((l) => l.id === "num-leg")).toBe(false);

    // Plain numeric column: bucket "numeric" present → numeric fires
    const numericCol = fakeColumn("n1", "numeric", {
      numeric: { decimals: 2 },
    });
    const effNum = computeEffectiveBanks({ columns: [numericCol] });
    expect(effNum.legends.some((l) => l.id === "num-leg")).toBe(true);
    expect(effNum.legends.some((l) => l.id === "p1:pct-leg")).toBe(false);
  });
});

describe("derivedId", () => {
  test("composes column id + key with a colon", () => {
    expect(derivedId("ref_col", 0)).toBe("ref_col:0");
    expect(derivedId("ref_col", "x")).toBe("ref_col:x");
  });
});
