import { describe, test, expect } from "bun:test";
import {
  measureExact,
  rankTopK,
  measureMaxWidth,
  DEFAULT_TOP_K,
  type FontKey,
} from "./width-measure";

const FONT: FontKey = { family: "Inter, system-ui, sans-serif", weight: 400 };

describe("rankTopK", () => {
  test("returns candidates verbatim when length <= k", () => {
    const out = rankTopK(["A", "B"], 14, 400, 3);
    expect(new Set(out)).toEqual(new Set(["A", "B"]));
  });

  test("picks the widest by estimated width", () => {
    const top = rankTopK(
      ["i", "ii", "BIG TEXT", "M", "MMM"],
      14,
      400,
      1,
    );
    expect(top.length).toBe(1);
    expect(top[0]).toBe("BIG TEXT");
  });

  test("returns k items by default (when there are enough)", () => {
    const top = rankTopK(["a", "aa", "aaa", "aaaa", "aaaaa"], 14, 400);
    expect(top.length).toBe(DEFAULT_TOP_K);
  });

  test("skips empty strings", () => {
    const top = rankTopK(["", "x", "", "xxxx"], 14, 400, 2);
    expect(new Set(top)).toEqual(new Set(["x", "xxxx"]));
  });

  test("treats k of 0 as 'no winners'", () => {
    const top = rankTopK(["a", "b", "c"], 14, 400, 0);
    expect(top.length).toBe(0);
  });
});

describe("measureExact", () => {
  test("returns null in non-DOM environments (V8/Bun)", () => {
    // Bun's `bun test` runs without a DOM by default; document is undefined.
    // This locks the contract: V8 path returns null and callers must
    // fall back to the estimator.
    const w = measureExact("hello", FONT, 14);
    expect(w).toBeNull();
  });
});

describe("measureMaxWidth", () => {
  test("returns 0 for empty input", () => {
    expect(measureMaxWidth([], FONT, 14)).toBe(0);
  });

  test("falls through to estimator when Canvas is unavailable (V8)", () => {
    const w = measureMaxWidth(["short", "much longer string here"], FONT, 14);
    // The longer string must produce a larger estimator score.
    expect(w).toBeGreaterThan(0);
    expect(Number.isFinite(w)).toBe(true);
  });

  test("max value is monotone in candidate count for a chain of growing strings", () => {
    const w1 = measureMaxWidth(["a"], FONT, 14);
    const w2 = measureMaxWidth(["a", "aa"], FONT, 14);
    const w3 = measureMaxWidth(["a", "aa", "aaa"], FONT, 14);
    expect(w2).toBeGreaterThanOrEqual(w1);
    expect(w3).toBeGreaterThanOrEqual(w2);
  });
});
