// Tests for the numeric aggregate behavior.

import { describe, test, expect } from "bun:test";
import { summarizeNumeric } from "./aggregate-behaviors";

describe("summarizeNumeric", () => {
  test("empty input → all-null summary", () => {
    const s = summarizeNumeric([]);
    expect(s.count).toBe(0);
    expect(s.mean).toBeNull();
    expect(s.median).toBeNull();
    expect(s.min).toBeNull();
    expect(s.max).toBeNull();
  });

  test("non-numeric / null / NaN values are skipped", () => {
    const s = summarizeNumeric([1, "x", null, NaN, 3]);
    expect(s.count).toBe(2);
    expect(s.sum).toBe(4);
    expect(s.mean).toBe(2);
  });

  test("odd-count median picks the middle", () => {
    const s = summarizeNumeric([3, 1, 2]);
    expect(s.median).toBe(2);
  });

  test("even-count median averages the two middles", () => {
    const s = summarizeNumeric([4, 2, 1, 3]);
    expect(s.median).toBe(2.5);
  });

  test("min / max / sum / count are correct", () => {
    const s = summarizeNumeric([5, 1, 3, 2, 4]);
    expect(s.min).toBe(1);
    expect(s.max).toBe(5);
    expect(s.sum).toBe(15);
    expect(s.count).toBe(5);
  });

  test("single value: min = max = mean = median", () => {
    const s = summarizeNumeric([7]);
    expect(s.min).toBe(7);
    expect(s.max).toBe(7);
    expect(s.mean).toBe(7);
    expect(s.median).toBe(7);
  });
});
