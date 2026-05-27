// Tests for initialStateForSchema — verifies value-or-field options
// start at { mode: "off" } and optionOverrides apply correctly.

import { describe, test, expect } from "bun:test";
import { initialStateForSchema } from "./initial-state";
import { PERCENT_SCHEMA } from "./columns/percent";
import { NUMERIC_SCHEMA } from "./columns/numeric";
import { TEXT_SCHEMA } from "./columns/text";

describe("initialStateForSchema", () => {
  test("value-or-field options start at { mode: 'off' }", () => {
    // BASE.token + BASE.paddingClass + TEXT.fontClass are all
    // value-or-field. All should be off by default.
    const s = initialStateForSchema(NUMERIC_SCHEMA);
    expect(s.token).toEqual({ mode: "off" });
    expect(s.paddingClass).toEqual({ mode: "off" });
    expect(s.fontClass).toEqual({ mode: "off" });
  });

  test("scalar options take their schema default", () => {
    const s = initialStateForSchema(NUMERIC_SCHEMA);
    expect(s.decimals).toBe(2);
    expect(s.thousandsSep).toBe(false);
    expect(s.abbreviate).toBe(false);
    expect(s.sortable).toBe(true);
    expect(s.align).toBe("left");
  });

  test("optionOverrides win over inherited defaults", () => {
    // percent overrides numeric's decimals=2 -> decimals=1
    const s = initialStateForSchema(PERCENT_SCHEMA);
    expect(s.decimals).toBe(1);
    // and percent's own options have their defaults
    expect(s.multiply).toBe(true);
    expect(s.symbol).toBe(true);
  });

  test("text schema initial state covers BASE + TEXT", () => {
    const s = initialStateForSchema(TEXT_SCHEMA);
    expect(s.header).toBe(null);
    expect(s.sortable).toBe(true);
    expect(s.wrap).toBe(false);
    expect(s.maxChars).toBe(null);
    expect(s.fontClass).toEqual({ mode: "off" });
  });
});
