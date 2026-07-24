import { describe, expect, test } from "bun:test";
import {
  SPACING_TOKEN_KEYS,
  SPACING_TOKEN_BOUNDS,
  isSpacingToken,
  clampSpacing,
  sanitizeSpacingOverrides,
  applySpacingOverrides,
  type SpacingToken,
} from "./spacing-tokens";
import { densityPresetAsSpacingTokens } from "./density-presets";

describe("spacing-tokens roster", () => {
  test("roster matches the camelCased DENSITY_PX keys exactly (sync gate)", () => {
    const densityKeys = Object.keys(densityPresetAsSpacingTokens("comfortable")).sort();
    expect(([...SPACING_TOKEN_KEYS] as string[]).sort()).toEqual(densityKeys);
  });

  test("every token has bounds; bounds are ordered [min <= max]", () => {
    for (const token of SPACING_TOKEN_KEYS) {
      const bounds = SPACING_TOKEN_BOUNDS[token];
      expect(bounds).toBeDefined();
      expect(bounds[0]).toBeLessThanOrEqual(bounds[1]);
    }
  });

  test("isSpacingToken guards the roster", () => {
    expect(isSpacingToken("rowHeight")).toBe(true);
    expect(isSpacingToken("groupPadding")).toBe(true);
    expect(isSpacingToken("row_height")).toBe(false); // snake_case is not a token
    expect(isSpacingToken("nope")).toBe(false);
  });
});

describe("clampSpacing", () => {
  test("clamps to per-token bounds", () => {
    expect(clampSpacing("rowHeight", 5)).toBe(8); // min 8
    expect(clampSpacing("rowHeight", 999)).toBe(120); // max 120
    expect(clampSpacing("rowHeight", 40)).toBe(40); // in range
  });

  test("rejects non-finite (NaN / ±Infinity) — the geometry-poison class", () => {
    expect(clampSpacing("padding", NaN)).toBeNull();
    expect(clampSpacing("padding", Infinity)).toBeNull();
    expect(clampSpacing("padding", -Infinity)).toBeNull();
    // @ts-expect-error — runtime guard for non-number input
    expect(clampSpacing("padding", "12")).toBeNull();
  });
});

describe("sanitizeSpacingOverrides", () => {
  test("keeps valid tokens, clamps, drops unknown keys + non-finite", () => {
    const out = sanitizeSpacingOverrides({
      rowHeight: 40,
      cellPaddingX: 999, // clamps to 40
      bogus: 12, // unknown → dropped
      padding: NaN, // non-finite → dropped
    });
    expect(out).toEqual({ rowHeight: 40, cellPaddingX: 40 });
  });

  test("returns undefined when nothing survives (sparse)", () => {
    expect(sanitizeSpacingOverrides({})).toBeUndefined();
    expect(sanitizeSpacingOverrides({ bogus: 1, padding: Infinity })).toBeUndefined();
    expect(sanitizeSpacingOverrides(null)).toBeUndefined();
    expect(sanitizeSpacingOverrides("nope")).toBeUndefined();
  });
});

describe("applySpacingOverrides", () => {
  const base = densityPresetAsSpacingTokens("comfortable") as Record<SpacingToken, number>;

  test("absolute-px replace of set tokens; others inherit the base", () => {
    const out = applySpacingOverrides(base, { rowHeight: 40, footerGap: 3 });
    expect(out.rowHeight).toBe(40);
    expect(out.footerGap).toBe(3);
    expect(out.headerHeight).toBe(base.headerHeight); // untouched
  });

  test("undefined overrides returns the base unchanged", () => {
    expect(applySpacingOverrides(base, undefined)).toEqual(base);
  });

  test("non-finite override values are ignored (defense-in-depth)", () => {
    const out = applySpacingOverrides(base, { rowHeight: NaN as number });
    expect(out.rowHeight).toBe(base.rowHeight);
  });
});
