// Tests for the weighted width-distribution engine. Pure arithmetic.

import { test, expect, describe } from "bun:test";
import { distributeFlexWidths, type FlexItem } from "./flex-distribute";

const approx = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe("distributeFlexWidths", () => {
  test("no delta → widths equal naturals", () => {
    const items: FlexItem[] = [
      { id: "a", natural: 100, weight: 1 },
      { id: "b", natural: 100, weight: 3 },
    ];
    const r = distributeFlexWidths(items, 200);
    approx(r.widths.a, 100);
    approx(r.widths.b, 100);
    approx(r.residual, 0);
  });

  test("grows proportional to weight", () => {
    const items: FlexItem[] = [
      { id: "a", natural: 100, weight: 1 },
      { id: "b", natural: 100, weight: 3 },
    ];
    const r = distributeFlexWidths(items, 400); // delta 200 → a +50, b +150
    approx(r.widths.a, 150);
    approx(r.widths.b, 250);
    approx(r.total, 400);
    approx(r.residual, 0);
  });

  test("weight 0 columns are immovable", () => {
    const items: FlexItem[] = [
      { id: "pinned", natural: 100, weight: 0 },
      { id: "flex", natural: 100, weight: 1 },
    ];
    const r = distributeFlexWidths(items, 300); // all delta to flex
    approx(r.widths.pinned, 100);
    approx(r.widths.flex, 200);
  });

  test("shrink: min clamp redistributes deficit to others", () => {
    const items: FlexItem[] = [
      { id: "a", natural: 100, weight: 1, min: 80 },
      { id: "b", natural: 100, weight: 1 },
    ];
    const r = distributeFlexWidths(items, 100); // delta -100; a floors at 80, b eats the rest
    approx(r.widths.a, 80);
    approx(r.widths.b, 20);
    approx(r.total, 100);
    approx(r.residual, 0);
  });

  test("grow: max clamp redistributes surplus to others", () => {
    const items: FlexItem[] = [
      { id: "a", natural: 100, weight: 1, max: 120 },
      { id: "b", natural: 100, weight: 1 },
    ];
    const r = distributeFlexWidths(items, 400); // delta 200; a caps at 120, b takes the rest
    approx(r.widths.a, 120);
    approx(r.widths.b, 280);
    approx(r.total, 400);
    approx(r.residual, 0);
  });

  test("residual reported when every flexible column saturates", () => {
    const items: FlexItem[] = [
      { id: "a", natural: 100, weight: 1, max: 120 },
    ];
    const r = distributeFlexWidths(items, 300); // wants +200, can only take +20
    approx(r.widths.a, 120);
    approx(r.total, 120);
    approx(r.residual, 180);
  });

  test("reversible: distributing back to naturalSum restores naturals", () => {
    const items: FlexItem[] = [
      { id: "a", natural: 137, weight: 2, min: 50 },
      { id: "b", natural: 89, weight: 5 },
      { id: "c", natural: 210, weight: 0 },
    ];
    const naturalSum = 137 + 89 + 210;
    // Out to an arbitrary target, then back to natural — back must equal naturals.
    distributeFlexWidths(items, 700);
    const back = distributeFlexWidths(items, naturalSum);
    approx(back.widths.a, 137);
    approx(back.widths.b, 89);
    approx(back.widths.c, 210);
  });

  test("deterministic: same inputs → same result", () => {
    const items: FlexItem[] = [
      { id: "a", natural: 100, weight: 1, max: 130 },
      { id: "b", natural: 100, weight: 2, min: 60 },
    ];
    const r1 = distributeFlexWidths(items, 350);
    const r2 = distributeFlexWidths(items, 350);
    expect(r1).toEqual(r2);
  });

  test("total is conserved when bounds don't bind", () => {
    const items: FlexItem[] = [
      { id: "a", natural: 50, weight: 1 },
      { id: "b", natural: 50, weight: 2 },
      { id: "c", natural: 50, weight: 7 },
    ];
    for (const target of [150, 300, 600, 90]) {
      const r = distributeFlexWidths(items, target);
      approx(r.total, target);
    }
  });
});
