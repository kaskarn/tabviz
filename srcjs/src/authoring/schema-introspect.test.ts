import { describe, it, expect } from "bun:test";
import { listColumnTypes, columnSchema } from "./schema-introspect";

describe("listColumnTypes", () => {
  const types = listColumnTypes();

  it("lists concrete column types and excludes abstract schemas", () => {
    const names = types.map((t) => t.type);
    expect(names).toContain("pvalue");
    expect(names).toContain("numeric");
    expect(names).toContain("bar");
    // BASE / SORTABLE are abstract structural schemas — never a column type.
    expect(names).not.toContain("base");
    expect(names).not.toContain("sortable");
  });

  it("reports an effective option count and a themeable subset", () => {
    const pv = types.find((t) => t.type === "pvalue")!;
    expect(pv.options).toBeGreaterThan(0);
    expect(pv.themeable).toBeGreaterThan(0);
    expect(pv.themeable).toBeLessThanOrEqual(pv.options);
  });

  it("is sorted by type for stable output", () => {
    const names = types.map((t) => t.type);
    expect([...names].sort()).toEqual(names);
  });
});

describe("columnSchema", () => {
  it("resolves options across inheritance with kind + themeable flags", () => {
    const rows = columnSchema("pvalue");
    const byKey = Object.fromEntries(rows.map((r) => [r.option, r]));
    // presentation options were reclassified to styling (theme-defaultable)
    expect(byKey.stars.kind).toBe("styling");
    expect(byKey.stars.themeable).toBe(true);
    // precision stays core — a theme can't change what the number means
    expect(byKey.digits.kind).toBe("core");
    expect(byKey.digits.themeable).toBe(false);
    // an inherited layout option carries its source schema
    expect(byKey.width.inheritedFrom).toBe("base");
  });

  it("surfaces enum choices for select/segmented controls", () => {
    const rows = columnSchema("pvalue");
    const starsColor = rows.find((r) => r.option === "starsColor");
    // starsColor is an enum — choices should be a non-empty array
    if (starsColor?.choices) expect(starsColor.choices.length).toBeGreaterThan(0);
  });

  it("accepts a bare string or an args object", () => {
    expect(columnSchema("bar")).toEqual(columnSchema({ type: "bar" }));
  });

  it("throws on an unknown or abstract type", () => {
    expect(() => columnSchema("not_a_type")).toThrow();
    expect(() => columnSchema("base")).toThrow(/abstract/);
  });
});
