// Tests for the naturalWidth schema behaviors. Validates that the
// dispatcher returns the SAME pixel widths as the old per-type switch
// in width-utils.ts (the migration is supposed to be behavior-preserving).

import { describe, test, expect } from "bun:test";
import { dispatchForColumn } from "../dispatch";
import type { ColumnSpec } from "../../types";
import "../init";

const col = (type: string, options: Record<string, unknown>): ColumnSpec =>
  ({
    id: type, header: type, field: "v", type: type as never,
    align: "left", sortable: false, isGroup: false, width: "auto", options,
  }) as unknown as ColumnSpec;

const dispatch = (c: ColumnSpec, rows: { metadata: Record<string, unknown> }[] = []): number => {
  const fn = dispatchForColumn(c, "naturalWidth");
  if (!fn) return 0;
  return fn(c, rows);
};

describe("naturalWidth — pictogram", () => {
  test("count-mode track sizes to row max", () => {
    const c = col("pictogram", { pictogram: { size: "base", layout: "row" } });
    const rows = [{ metadata: { v: 3 } }, { metadata: { v: 7 } }, { metadata: { v: 5 } }];
    // base glyph 14px, 7 slots → 7*14 + 6*1 = 98 + 6 = 104
    expect(dispatch(c, rows)).toBe(104);
  });

  test("count-mode capped at 20 slots", () => {
    const c = col("pictogram", { pictogram: { size: "base", layout: "row" } });
    const rows = [{ metadata: { v: 999 } }];
    // capped at 20: 20*14 + 19*1 = 280 + 19 = 299
    expect(dispatch(c, rows)).toBe(299);
  });

  test("stack-mode is one slot regardless of data", () => {
    const c = col("pictogram", { pictogram: { size: "base", layout: "stack" } });
    const rows = [{ metadata: { v: 50 } }];
    expect(dispatch(c, rows)).toBe(14);
  });

  test("maxGlyphs caps at the configured value", () => {
    const c = col("pictogram", { pictogram: { size: "sm", layout: "row", maxGlyphs: 4 } });
    // sm glyph 10px, 4 slots → 4*10 + 3*1 = 43
    expect(dispatch(c, [])).toBe(43);
  });

  test("lg + valueLabel adds label budget", () => {
    const c = col("pictogram", {
      pictogram: { size: "lg", layout: "row", maxGlyphs: 5, valueLabel: true },
    });
    // 5*20 + 4*1 = 104 track; lg labelFont 14, label = 5*14*0.55 = 38.5; + 4 gap
    expect(dispatch(c, [])).toBeCloseTo(104 + 4 + 5 * 14 * 0.55);
  });
});

describe("naturalWidth — stars", () => {
  test("default 5 stars at 12px + 2px gap", () => {
    const c = col("stars", {});
    // 5*12 + 4*2 = 60 + 8 = 68
    expect(dispatch(c)).toBe(68);
  });

  test("maxGlyphs override", () => {
    const c = col("stars", { stars: { maxGlyphs: 3 } });
    expect(dispatch(c)).toBe(3 * 12 + 2 * 2);
  });
});

describe("naturalWidth — icon", () => {
  test("size keys map to expected px", () => {
    expect(dispatch(col("icon", { icon: { size: "sm" } }))).toBe(12);
    expect(dispatch(col("icon", { icon: { size: "base" } }))).toBe(14);
    expect(dispatch(col("icon", { icon: { size: "lg" } }))).toBe(16);
    expect(dispatch(col("icon", { icon: { size: "xl" } }))).toBe(26);
  });
});

describe("naturalWidth — ring", () => {
  test("with label (default)", () => {
    const c = col("ring", { ring: { size: "base" } });
    // 24 diameter + 4 gap + 4 chars * 11 * 0.55 = 24 + 4 + 24.2 = 52.2
    expect(dispatch(c)).toBeCloseTo(24 + 4 + 4 * 11 * 0.55);
  });

  test("without label", () => {
    const c = col("ring", { ring: { size: "lg", showLabel: false } });
    expect(dispatch(c)).toBe(32);
  });
});

describe("naturalWidth — non-glyph types fall through", () => {
  test("text → undefined dispatcher (caller falls back)", () => {
    const fn = dispatchForColumn(col("text", {}), "naturalWidth");
    expect(fn).toBeUndefined();
  });

  test("numeric → undefined", () => {
    const fn = dispatchForColumn(col("numeric", {}), "naturalWidth");
    expect(fn).toBeUndefined();
  });
});
