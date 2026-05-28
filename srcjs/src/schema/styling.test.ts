import { describe, test, expect } from "bun:test";
import {
  normalizeStyle,
  cond,
  staticValue,
  fieldRef,
  isFieldOverride,
  isConditionOverride,
  isStaticOverride,
  isThemeOverride,
  type StyleMappingValue,
} from "./styling";

describe("normalizeStyle", () => {
  test("undefined → theme", () => {
    expect(normalizeStyle(undefined)).toEqual({ kind: "theme" });
  });

  test("null → theme", () => {
    expect(normalizeStyle(null)).toEqual({ kind: "theme" });
  });

  test("bare string → field reference (back-compat)", () => {
    expect(normalizeStyle("highlight_col")).toEqual({
      kind: "field",
      field: "highlight_col",
    });
  });

  test("tagged union passes through unchanged", () => {
    const v: StyleMappingValue<boolean> = { kind: "static", value: true };
    expect(normalizeStyle(v)).toEqual(v);
  });

  // Non-string, non-object literal inputs (e.g. bare `true`) aren't
  // permitted by the StyleOverride type — authors who want a static
  // value should write `staticValue(...)` or `{ kind: "static", value }`.
});

describe("authoring helpers", () => {
  test("cond(name) returns condition reference", () => {
    expect(cond("significant")).toEqual({ kind: "condition", name: "significant" });
  });

  test("staticValue(v) wraps explicitly", () => {
    expect(staticValue(true)).toEqual({ kind: "static", value: true });
  });

  test("fieldRef(name) wraps as field", () => {
    expect(fieldRef("col")).toEqual({ kind: "field", field: "col" });
  });
});

describe("type guards", () => {
  test("isFieldOverride / isConditionOverride / isStaticOverride / isThemeOverride", () => {
    const f = fieldRef("x");
    const c = cond("sig");
    const s = staticValue(true);
    const t: StyleMappingValue<boolean> = { kind: "theme" };

    expect(isFieldOverride(f)).toBe(true);
    expect(isFieldOverride(c)).toBe(false);
    expect(isConditionOverride(c)).toBe(true);
    expect(isConditionOverride(f)).toBe(false);
    expect(isStaticOverride(s)).toBe(true);
    expect(isStaticOverride(c)).toBe(false);
    expect(isThemeOverride(t)).toBe(true);
    expect(isThemeOverride(s)).toBe(false);
  });
});
