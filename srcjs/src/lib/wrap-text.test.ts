import { expect, test, describe } from "bun:test";

// Pure-function test: replicate the wrap-line-count logic used by both
// forestStore (live widget) and svg-generator (SVG export). If those two
// drift, this test pins what the contract is — wrap = N caps at N+1 lines.

function wrapCapForValue(w: boolean | number | undefined): number {
  if (typeof w === "number") return w + 1;
  return w ? 2 : 1;
}

function isWrapEnabled(w: boolean | number | undefined): boolean {
  return typeof w === "number" ? w > 0 : !!w;
}

describe("wrap schema", () => {
  test("wrap = false → cap 1 (no wrap)", () => {
    expect(wrapCapForValue(false)).toBe(1);
    expect(isWrapEnabled(false)).toBe(false);
  });

  test("wrap = 0 → cap 1 (no wrap)", () => {
    expect(wrapCapForValue(0)).toBe(1);
    expect(isWrapEnabled(0)).toBe(false);
  });

  test("wrap = true → cap 2 (1 extra line)", () => {
    expect(wrapCapForValue(true)).toBe(2);
    expect(isWrapEnabled(true)).toBe(true);
  });

  test("wrap = 1 → cap 2 (1 extra line)", () => {
    expect(wrapCapForValue(1)).toBe(2);
    expect(isWrapEnabled(1)).toBe(true);
  });

  test("wrap = 2 → cap 3 (2 extra lines)", () => {
    expect(wrapCapForValue(2)).toBe(3);
    expect(isWrapEnabled(2)).toBe(true);
  });

  test("wrap = 5 → cap 6 (5 extra lines)", () => {
    expect(wrapCapForValue(5)).toBe(6);
    expect(isWrapEnabled(5)).toBe(true);
  });

  test("wrap = undefined → cap 1, disabled", () => {
    expect(wrapCapForValue(undefined)).toBe(1);
    expect(isWrapEnabled(undefined)).toBe(false);
  });
});
