import { describe, test, expect, beforeEach } from "bun:test";
import {
  registerFontMetrics,
  hasFontMetrics,
  listRegisteredFonts,
  getCharWidth,
  measureString,
  _resetFontMetricsRegistry,
  type FontKey,
  type FontMetrics,
} from "./width-measure";

const FONT: FontKey = { family: "Inter, system-ui, sans-serif", weight: 400 };
const FONT_BOLD: FontKey = { ...FONT, weight: 600 };

function fixture(extra: Partial<Record<string, number>> = {}): FontMetrics {
  return {
    charWidths: new Map<string, number>([
      ["a", 0.55],
      ["b", 0.56],
      ["i", 0.30],
      ["0", 0.60],
      [" ", 0.25],
      ...Object.entries(extra),
    ]),
    fallbackCharWidth: 0.50,
  };
}

beforeEach(() => {
  _resetFontMetricsRegistry();
});

describe("width-measure registry", () => {
  test("hasFontMetrics is false before registration", () => {
    expect(hasFontMetrics(FONT)).toBe(false);
  });

  test("registerFontMetrics persists entries by (family, weight, italic)", () => {
    registerFontMetrics(FONT, fixture());
    expect(hasFontMetrics(FONT)).toBe(true);
    // Different weight is a different key.
    expect(hasFontMetrics(FONT_BOLD)).toBe(false);
  });

  test("listRegisteredFonts reflects registrations", () => {
    registerFontMetrics(FONT, fixture());
    registerFontMetrics(FONT_BOLD, fixture());
    expect(listRegisteredFonts().length).toBe(2);
  });

  test("re-registering overwrites the prior entry", () => {
    registerFontMetrics(FONT, fixture());
    registerFontMetrics(FONT, fixture({ a: 0.99 }));
    // 0.99 em × 100 px font size = 99 px.
    expect(getCharWidth("a", FONT, 100)).toBeCloseTo(99, 5);
  });
});

describe("getCharWidth", () => {
  test("returns registered em-width × fontSize for known chars", () => {
    registerFontMetrics(FONT, fixture());
    expect(getCharWidth("a", FONT, 100)).toBeCloseTo(55, 5);
    expect(getCharWidth("a", FONT, 14)).toBeCloseTo(7.7, 4);
  });

  test("uses fallbackCharWidth for unknown chars", () => {
    registerFontMetrics(FONT, fixture());
    expect(getCharWidth("Z", FONT, 100)).toBeCloseTo(50, 5);
  });

  test("falls through to estimator when font is unregistered", () => {
    // No registration — should not throw, returns a positive number.
    const w = getCharWidth("a", FONT, 14);
    expect(w).toBeGreaterThan(0);
    expect(Number.isFinite(w)).toBe(true);
  });
});

describe("measureString", () => {
  test("sums registered character widths", () => {
    registerFontMetrics(FONT, fixture());
    // "abi" = (0.55 + 0.56 + 0.30) × 14 = 1.41 × 14 = 19.74
    expect(measureString("abi", FONT, 14)).toBeCloseTo(19.74, 4);
  });

  test("empty string is zero width", () => {
    registerFontMetrics(FONT, fixture());
    expect(measureString("", FONT, 14)).toBe(0);
  });

  test("falls through to estimator when font is unregistered", () => {
    const w = measureString("hello", FONT, 14);
    expect(w).toBeGreaterThan(0);
    expect(Number.isFinite(w)).toBe(true);
  });

  test("isolates fonts: different weights don't share cache", () => {
    registerFontMetrics(FONT, fixture({ a: 0.50 }));
    registerFontMetrics(FONT_BOLD, fixture({ a: 0.70 }));
    expect(measureString("a", FONT, 100)).toBeCloseTo(50, 5);
    expect(measureString("a", FONT_BOLD, 100)).toBeCloseTo(70, 5);
  });

  test("italic flag is part of the key", () => {
    const roman: FontKey = { family: "X", weight: 400, italic: false };
    const italic: FontKey = { family: "X", weight: 400, italic: true };
    registerFontMetrics(roman, fixture({ a: 0.55 }));
    registerFontMetrics(italic, fixture({ a: 0.62 }));
    expect(measureString("a", roman, 100)).toBeCloseTo(55, 5);
    expect(measureString("a", italic, 100)).toBeCloseTo(62, 5);
  });
});
