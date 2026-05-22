// Tests for the schema inheritance resolver.

import { describe, test, expect } from "bun:test";
import { resolveSchema } from "./resolve";
import { TEXT_SCHEMA } from "./columns/text";
import { NUMERIC_SCHEMA } from "./columns/numeric";
import { PERCENT_SCHEMA } from "./columns/percent";

describe("resolveSchema", () => {
  test("text resolves to [base, sortable, text]", () => {
    // Multi-inheritance: text inherits [base, sortable] simultaneously.
    // Resolver emits ancestors before the leaf; sibling order follows
    // the declaration order in `inherits`.
    const keys = resolveSchema(TEXT_SCHEMA).map((s) => s.key);
    expect(keys).toEqual(["base", "sortable", "text"]);
  });

  test("numeric resolves to [base, sortable, text, numeric]", () => {
    const keys = resolveSchema(NUMERIC_SCHEMA).map((s) => s.key);
    expect(keys).toEqual(["base", "sortable", "text", "numeric"]);
  });

  test("percent resolves to [base, sortable, text, numeric, percent]", () => {
    const keys = resolveSchema(PERCENT_SCHEMA).map((s) => s.key);
    expect(keys).toEqual(["base", "sortable", "text", "numeric", "percent"]);
  });

  test("ancestor appears before descendant (topological)", () => {
    const keys = resolveSchema(PERCENT_SCHEMA).map((s) => s.key);
    expect(keys.indexOf("base")).toBeLessThan(keys.indexOf("text"));
    expect(keys.indexOf("text")).toBeLessThan(keys.indexOf("numeric"));
    expect(keys.indexOf("numeric")).toBeLessThan(keys.indexOf("percent"));
    expect(keys.indexOf("sortable")).toBeLessThan(keys.indexOf("text"));
  });

  test("each schema appears exactly once", () => {
    const keys = resolveSchema(PERCENT_SCHEMA).map((s) => s.key);
    const counts = keys.reduce<Record<string, number>>((acc, k) => {
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
    for (const [k, n] of Object.entries(counts)) {
      expect(n, `schema ${k} appeared ${n} times`).toBe(1);
    }
  });
});
