import { test, expect } from "bun:test";
import { vizBarLayout } from "./viz-mark-geometry";

test("vizBarLayout — single effect: full band, no gap, byte-identical to inline", () => {
  // rowHeight 30 × 0.7 = 21; single effect → gap 0, barHeight max(4, 21) = 21
  expect(vizBarLayout(30, 1)).toEqual({ totalBarHeight: 21, barHeight: 21, barGap: 0 });
});

test("vizBarLayout — multi-effect: 2px gap, band split, 4px floor", () => {
  // total 21, gap 2, 3 effects → (21 - 2*2)/3 = 5.667
  const l = vizBarLayout(30, 3);
  expect(l.totalBarHeight).toBe(21);
  expect(l.barGap).toBe(2);
  expect(l.barHeight).toBeCloseTo((21 - 4) / 3, 6);
  // tiny row floors at 4
  expect(vizBarLayout(5, 4).barHeight).toBe(4);
});
