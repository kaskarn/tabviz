import { test, expect } from "bun:test";
import { vizBand, vizBarLayout, VIZ_BAND_MIN } from "./viz-mark-geometry";

test("vizBand — single effect: full band, no gap", () => {
  const b = vizBand(30, 0.7, 1, 4); // 30*0.7 = 21
  expect(b).toEqual({ totalHeight: 21, bandHeight: 21, gap: 0 });
});

test("vizBand — multi-effect: 2px gap, band split (floor not binding)", () => {
  const b = vizBand(60, 0.7, 3, 4); // 42; (42 - 2*2)/3 = 12.667 > floor 4
  expect(b.totalHeight).toBe(42);
  expect(b.gap).toBe(2);
  expect(b.bandHeight).toBeCloseTo((42 - 4) / 3, 6);
});

test("vizBand — per-type floors (bar 4 / box 8 / violin 10) bind on small rows", () => {
  expect(VIZ_BAND_MIN).toEqual({ bar: 4, boxplot: 8, violin: 10 });
  expect(vizBand(5, 0.7, 4, VIZ_BAND_MIN.violin).bandHeight).toBe(10);
  expect(vizBand(5, 0.7, 4, VIZ_BAND_MIN.bar).bandHeight).toBe(4);
});

test("vizBarLayout wraps vizBand with the bar field names", () => {
  expect(vizBarLayout(30, 1)).toEqual({ totalBarHeight: 21, barHeight: 21, barGap: 0 });
});
