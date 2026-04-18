import { expect, test, describe } from "bun:test";
import { normalizeValue } from "./scale-utils";
import { truncateString } from "./formatters";

describe("normalizeValue", () => {
  test("linear: midpoint maps to 0.5", () => {
    expect(normalizeValue(50, 0, 100, "linear")).toBeCloseTo(0.5);
  });

  test("linear: clamps below 0", () => {
    expect(normalizeValue(-10, 0, 100, "linear")).toBe(0);
  });

  test("linear: clamps above 1", () => {
    expect(normalizeValue(200, 0, 100, "linear")).toBe(1);
  });

  test("linear: zero range returns 0", () => {
    expect(normalizeValue(5, 10, 10, "linear")).toBe(0);
  });

  test("linear: inverted range returns 0", () => {
    expect(normalizeValue(5, 10, 0, "linear")).toBe(0);
  });

  test("linear: null/undefined value returns 0", () => {
    expect(normalizeValue(null, 0, 100, "linear")).toBe(0);
    expect(normalizeValue(undefined, 0, 100, "linear")).toBe(0);
    expect(normalizeValue(NaN, 0, 100, "linear")).toBe(0);
  });

  test("log: geometric midpoint maps near 0.5", () => {
    // log(10) is midpoint between log(1) and log(100)
    expect(normalizeValue(10, 1, 100, "log")).toBeCloseTo(0.5);
  });

  test("log: non-positive value returns 0", () => {
    expect(normalizeValue(0, 1, 100, "log")).toBe(0);
    expect(normalizeValue(-5, 1, 100, "log")).toBe(0);
  });

  test("log: non-positive lo is clamped to small positive", () => {
    // With lo clamped to ~1e-12 and hi=100, any positive value maps somewhere in [0,1].
    const r = normalizeValue(1, 0, 100, "log");
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(1);
  });

  test("sqrt: sqrt(0.25) of span is at position 0.5", () => {
    // sqrt scale: value at (hi-lo) * 0.25 yields ratio sqrt(0.25) = 0.5
    expect(normalizeValue(25, 0, 100, "sqrt")).toBeCloseTo(0.5);
  });

  test("sqrt: below lo returns 0", () => {
    expect(normalizeValue(-5, 0, 100, "sqrt")).toBe(0);
  });

  test("defaults to linear when scale is omitted", () => {
    expect(normalizeValue(25, 0, 100)).toBeCloseTo(0.25);
  });
});

describe("truncateString", () => {
  test("returns original when maxChars is null/undefined", () => {
    expect(truncateString("hello world", null)).toBe("hello world");
    expect(truncateString("hello world", undefined)).toBe("hello world");
  });

  test("returns original when string fits", () => {
    expect(truncateString("abc", 5)).toBe("abc");
    expect(truncateString("abcde", 5)).toBe("abcde");
  });

  test("appends ellipsis when truncating", () => {
    expect(truncateString("abcdefgh", 5)).toBe("abcd\u2026");
  });

  test("maxChars = 1 returns just ellipsis", () => {
    expect(truncateString("abcdef", 1)).toBe("\u2026");
  });

  test("empty string stays empty", () => {
    expect(truncateString("", 5)).toBe("");
  });

  test("null/undefined input returns empty", () => {
    expect(truncateString(null as unknown as string, 5)).toBe("");
    expect(truncateString(undefined as unknown as string, 5)).toBe("");
  });

  test("non-positive maxChars leaves string untouched", () => {
    expect(truncateString("hello", 0)).toBe("hello");
    expect(truncateString("hello", -1)).toBe("hello");
  });
});
