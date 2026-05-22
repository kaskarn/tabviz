// Tests for the layer inheritance resolver.

import { describe, test, expect } from "bun:test";
import { resolveLayers } from "./resolve";
import { TEXT_COLUMN } from "./columns/text";
import { NUMERIC_COLUMN } from "./columns/numeric";
import { PERCENT_COLUMN } from "./columns/percent";

describe("resolveLayers", () => {
  test("text composes [base, text, sortable]", () => {
    const keys = resolveLayers(TEXT_COLUMN).map((l) => l.key);
    expect(keys).toEqual(["base", "text", "sortable"]);
  });

  test("numeric composes [base, text, numeric, sortable]", () => {
    const keys = resolveLayers(NUMERIC_COLUMN).map((l) => l.key);
    expect(keys).toEqual(["base", "text", "numeric", "sortable"]);
  });

  test("percent composes [base, text, numeric, percent, sortable]", () => {
    const keys = resolveLayers(PERCENT_COLUMN).map((l) => l.key);
    expect(keys).toEqual(["base", "text", "numeric", "percent", "sortable"]);
  });

  test("ancestor appears before descendant (topological)", () => {
    const keys = resolveLayers(PERCENT_COLUMN).map((l) => l.key);
    expect(keys.indexOf("base")).toBeLessThan(keys.indexOf("text"));
    expect(keys.indexOf("text")).toBeLessThan(keys.indexOf("numeric"));
    expect(keys.indexOf("numeric")).toBeLessThan(keys.indexOf("percent"));
  });

  test("each layer appears exactly once even when declared transitively", () => {
    const keys = resolveLayers(PERCENT_COLUMN).map((l) => l.key);
    const counts = keys.reduce<Record<string, number>>((acc, k) => {
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
    for (const [k, n] of Object.entries(counts)) {
      expect(n, `layer ${k} appeared ${n} times`).toBe(1);
    }
  });
});
