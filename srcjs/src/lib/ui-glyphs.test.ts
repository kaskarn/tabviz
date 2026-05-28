import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GLYPHS,
  glyph,
  glyphOr,
  TYPE_GLYPHS,
  FIELD_GLYPHS,
  ALIGN_GLYPHS,
  DENSITY_GLYPHS,
  SORT_GLYPHS,
  ACTION_GLYPHS,
  SECTION_GLYPHS,
  MODE_GLYPHS,
  STATUS_GLYPHS,
} from "./ui-glyphs";

describe("ui-glyphs table", () => {
  it("every value is a non-empty short string", () => {
    for (const [token, val] of Object.entries(GLYPHS)) {
      expect(val, `token ${token}`).toBeTruthy();
      expect(val.length, `token ${token} length`).toBeLessThanOrEqual(8);
    }
  });

  it("every key is a dotted `category.token` form", () => {
    for (const token of Object.keys(GLYPHS)) {
      expect(token, "key shape").toMatch(/^[a-z]+\.[a-zA-Z]+$/);
    }
  });

  it("no two tokens collide on glyph character for the same category", () => {
    // We allow cross-category collisions (e.g. `#` is both type.numeric
    // and field.numeric — that's intentional). Within a category they
    // must be distinct.
    const byCategory: Record<string, Set<string>> = {};
    for (const [token, val] of Object.entries(GLYPHS)) {
      const cat = token.split(".")[0];
      byCategory[cat] ??= new Set();
      expect(byCategory[cat].has(val), `dup glyph "${val}" in ${cat}`).toBe(false);
      byCategory[cat].add(val);
    }
  });
});

describe("glyph()", () => {
  it("returns the table value for a known token", () => {
    expect(glyph("type.numeric")).toBe("#");
    expect(glyph("align.left")).toBe("L");
    expect(glyph("density.compact")).toBe("⫶");
  });
});

describe("glyphOr()", () => {
  beforeEach(() => {
    // Reset internal warned-set is private; spy on console to verify behavior.
    vi.restoreAllMocks();
  });

  it("returns the table value for a known token", () => {
    expect(glyphOr("type.numeric")).toBe("#");
  });

  it("returns the fallback for unknown token", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(glyphOr("type.nonexistent")).toBe("•");
    expect(glyphOr("type.nonexistent", "?")).toBe("?");
    expect(warn).toHaveBeenCalled();
  });

  it("warns only once per unknown token", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    glyphOr("type.alsofake");
    glyphOr("type.alsofake");
    glyphOr("type.alsofake");
    // Across this whole test file the set is global, so we can't
    // assert "exactly once" — only that the count for this unique
    // token is at most 1 after multiple calls.
    const calls = warn.mock.calls.filter(c => String(c[0]).includes("type.alsofake"));
    expect(calls.length).toBe(1);
  });
});

describe("subgroup accessors", () => {
  it("strip the category prefix from keys", () => {
    expect(TYPE_GLYPHS.numeric).toBe("#");
    expect(FIELD_GLYPHS.string).toBe("abc");
    expect(ALIGN_GLYPHS.left).toBe("L");
    expect(DENSITY_GLYPHS.compact).toBe("⫶");
    expect(SORT_GLYPHS.asc).toBe("↑");
    expect(ACTION_GLYPHS.reset).toBe("⤺");
    expect(SECTION_GLYPHS.data).toBeTruthy();
    expect(MODE_GLYPHS.theme).toBeTruthy();
    expect(STATUS_GLYPHS.ok).toBe("✓");
  });

  it("subgroup keys are the suffix portion of the dotted token", () => {
    for (const k of Object.keys(TYPE_GLYPHS)) {
      expect(`type.${k}` in GLYPHS).toBe(true);
    }
  });
});
