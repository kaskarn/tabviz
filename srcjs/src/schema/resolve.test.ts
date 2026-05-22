// Tests for the schema inheritance resolver.

import { describe, test, expect } from "bun:test";
import { resolveSchema } from "./resolve";
import { TEXT_SCHEMA } from "./columns/text";
import { NUMERIC_SCHEMA } from "./columns/numeric";
import { PERCENT_SCHEMA } from "./columns/percent";

describe("resolveSchema", () => {
  test("text resolves to [base, text]", () => {
    const keys = resolveSchema(TEXT_SCHEMA).map((s) => s.key);
    expect(keys).toEqual(["base", "text"]);
  });

  test("numeric resolves to [base, text, numeric]", () => {
    const keys = resolveSchema(NUMERIC_SCHEMA).map((s) => s.key);
    expect(keys).toEqual(["base", "text", "numeric"]);
  });

  test("percent resolves to [base, text, numeric, percent]", () => {
    const keys = resolveSchema(PERCENT_SCHEMA).map((s) => s.key);
    expect(keys).toEqual(["base", "text", "numeric", "percent"]);
  });

  test("ancestor appears before descendant (topological)", () => {
    const keys = resolveSchema(PERCENT_SCHEMA).map((s) => s.key);
    expect(keys.indexOf("base")).toBeLessThan(keys.indexOf("text"));
    expect(keys.indexOf("text")).toBeLessThan(keys.indexOf("numeric"));
    expect(keys.indexOf("numeric")).toBeLessThan(keys.indexOf("percent"));
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
