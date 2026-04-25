import { expect, test, describe } from "bun:test";
import { FONT_PRESETS, matchPresetStack, normalizeStack } from "./font-presets";

describe("FONT_PRESETS", () => {
  test("ships 10 stacks", () => {
    expect(FONT_PRESETS.length).toBe(10);
  });

  test("each entry has a non-empty name and stack", () => {
    for (const p of FONT_PRESETS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.stack.length).toBeGreaterThan(0);
    }
  });

  test("System UI is the first option (default-friendly)", () => {
    expect(FONT_PRESETS[0].name).toBe("System UI");
  });
});

describe("matchPresetStack", () => {
  test("returns null for null/undefined/empty value", () => {
    expect(matchPresetStack(null)).toBeNull();
    expect(matchPresetStack(undefined)).toBeNull();
    expect(matchPresetStack("")).toBeNull();
  });

  test("matches an exact preset stack", () => {
    expect(matchPresetStack("system-ui, -apple-system, sans-serif"))
      .toBe("system-ui, -apple-system, sans-serif");
  });

  test("is whitespace-tolerant", () => {
    expect(matchPresetStack("system-ui,  -apple-system,sans-serif"))
      .toBe("system-ui, -apple-system, sans-serif");
  });

  test("is quote-style-tolerant (single vs double)", () => {
    const dbl = `"Helvetica Neue", Helvetica, Arial, sans-serif`;
    expect(matchPresetStack(dbl))
      .toBe("'Helvetica Neue', Helvetica, Arial, sans-serif");
  });

  test("is case-insensitive", () => {
    expect(matchPresetStack("ARIAL, helvetica, SANS-SERIF"))
      .toBe("Arial, Helvetica, sans-serif");
  });

  test("returns null for non-preset value", () => {
    expect(matchPresetStack("Comic Sans MS, sans-serif")).toBeNull();
  });
});

describe("normalizeStack", () => {
  test("collapses whitespace and lowercases", () => {
    expect(normalizeStack("  Foo,   Bar,  Baz  "))
      .toBe("foo, bar, baz");
  });

  test("normalizes quote style", () => {
    expect(normalizeStack(`'foo', "bar"`))
      .toBe("'foo', 'bar'");
  });
});
