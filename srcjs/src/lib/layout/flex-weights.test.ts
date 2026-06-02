// Tests for the flex-weight policy + column→width resolver.

import { test, expect, describe } from "bun:test";
import {
  flexWeightForType,
  vizNaturalWidth,
  resolveFlexWidths,
  DEFAULT_FLEX_WEIGHT,
  type ColumnWidthSpec,
} from "./flex-weights";

const approx = (a: number, b: number, eps = 0.5) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe("flex-weight policy", () => {
  test("plots weigh more than text; penalized types weigh less", () => {
    expect(flexWeightForType("forest")).toBeGreaterThan(flexWeightForType("text"));
    expect(flexWeightForType("viz_bar")).toBeGreaterThan(flexWeightForType("sparkline"));
    expect(flexWeightForType("pvalue")).toBeLessThan(DEFAULT_FLEX_WEIGHT);
    expect(flexWeightForType("text")).toBe(DEFAULT_FLEX_WEIGHT);
  });

  test("viz types get a designed natural; content types do not", () => {
    expect(vizNaturalWidth("forest")).toBeGreaterThan(0);
    expect(vizNaturalWidth("text")).toBeNull();
  });
});

describe("resolveFlexWidths", () => {
  test("flex=1 (all default) → uniform proportional scale", () => {
    const cols: ColumnWidthSpec[] = [
      { id: "a", type: "text", naturalWidth: 100 },
      { id: "b", type: "text", naturalWidth: 200 },
    ];
    const r = resolveFlexWidths(cols, 600); // 2× of natural 300
    approx(r.widths.a, 200); // ×2
    approx(r.widths.b, 400); // ×2 — proportions preserved
  });

  test("high-weight plot absorbs most of the extra", () => {
    const cols: ColumnWidthSpec[] = [
      { id: "t", type: "text", naturalWidth: 100 },     // eff 100
      { id: "f", type: "forest", naturalWidth: 200 },   // eff 8×200=1600
    ];
    const r = resolveFlexWidths(cols, 600); // delta 300
    expect(r.widths.f - 200).toBeGreaterThan(r.widths.t - 100); // forest grew more
    approx(r.total, 600);
  });

  test("pinned (explicit width) column is immovable", () => {
    const cols: ColumnWidthSpec[] = [
      { id: "p", type: "text", naturalWidth: 100, explicitWidth: 150 },
      { id: "f", type: "text", naturalWidth: 100 },
    ];
    const r = resolveFlexWidths(cols, 400);
    approx(r.widths.p, 150); // fixed
    approx(r.widths.f, 250); // absorbs the rest
  });

  test("small penalized column barely grows (auto-penalty)", () => {
    const cols: ColumnWidthSpec[] = [
      { id: "icon", type: "icon", naturalWidth: 20 },   // eff 0.3×20 = 6
      { id: "txt", type: "text", naturalWidth: 100 },   // eff 100
    ];
    const r = resolveFlexWidths(cols, 320); // delta 200
    expect(r.widths.icon - 20).toBeLessThan(r.widths.txt - 100);
    expect(r.widths.icon - 20).toBeLessThan(15); // absorbed only a sliver of the 200px delta
  });

  test("aspect cap bounds a column to [natural/cap, natural×cap]", () => {
    const cols: ColumnWidthSpec[] = [
      { id: "f", type: "forest", naturalWidth: 200, cap: 2 },
      { id: "t", type: "text", naturalWidth: 100 },
    ];
    const r = resolveFlexWidths(cols, 900); // big delta; forest would want >400 but caps
    expect(r.widths.f).toBeLessThanOrEqual(400 + 0.5); // natural×cap
  });

  test("shrink floors at content min, redistributes", () => {
    const cols: ColumnWidthSpec[] = [
      { id: "a", type: "text", naturalWidth: 100, minWidth: 80 },
      { id: "b", type: "text", naturalWidth: 100 },
    ];
    const r = resolveFlexWidths(cols, 100); // shrink from 200
    approx(r.widths.a, 80);
    approx(r.widths.b, 20);
  });
});
