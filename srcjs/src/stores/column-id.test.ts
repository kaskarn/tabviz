import { expect, test, describe } from "bun:test";
import { mintUniqueId, RESERVED_COLUMN_IDS } from "./forestStore.svelte";

// Unit tests for the column-id uniqueness helper extracted from
// `mintUniqueColumnId`. See the audit in v0.20.2 for the full set of
// "taken" sources the store-level caller folds in (spec, hidden, overrides,
// widths, axisZooms, resized, sentinels). Here we just pin the resolution
// logic — given a set, return a unique id.

describe("mintUniqueId", () => {
  test("returns base unchanged when not taken", () => {
    expect(mintUniqueId("drug", new Set())).toBe("drug");
  });

  test("appends _2 on first collision", () => {
    expect(mintUniqueId("drug", new Set(["drug"]))).toBe("drug_2");
  });

  test("walks up until unique", () => {
    expect(mintUniqueId("drug", new Set(["drug", "drug_2", "drug_3"]))).toBe("drug_4");
  });

  test("skips gaps (_2 taken, _3 free → returns _3)", () => {
    expect(mintUniqueId("drug", new Set(["drug", "drug_2"]))).toBe("drug_3");
  });

  test("respects reserved sentinels when folded in", () => {
    const taken = new Set<string>(RESERVED_COLUMN_IDS);
    // User "base" that is itself a sentinel bumps to `_2`.
    expect(mintUniqueId("__root__", taken)).toBe("__root___2");
    expect(mintUniqueId("__start__", taken)).toBe("__start___2");
  });

  test("treats hidden-column ids as taken", () => {
    const hidden = new Set(["drug"]);
    const taken = new Set([...hidden]);
    expect(mintUniqueId("drug", taken)).toBe("drug_2");
  });

  test("treats axis-zoom orphans as taken", () => {
    // Simulates the scenario: column was removed but axisZooms["forest_hr"]
    // still has a stale entry. A new forest_hr column must get _2.
    const axisZoomKeys = new Set(["forest_hr"]);
    const taken = new Set([...axisZoomKeys]);
    expect(mintUniqueId("forest_hr", taken)).toBe("forest_hr_2");
  });

  test("treats columnWidths orphans as taken", () => {
    const widthKeys = new Set(["n"]);
    const taken = new Set([...widthKeys]);
    expect(mintUniqueId("n", taken)).toBe("n_2");
  });

  test("idempotent when the base is unique among multiple sources", () => {
    const taken = new Set([
      "drug", "dose", "__root__", "__start__", "ci",
    ]);
    expect(mintUniqueId("hr", taken)).toBe("hr");
  });
});

describe("RESERVED_COLUMN_IDS", () => {
  test("contains the two scope sentinels", () => {
    expect(RESERVED_COLUMN_IDS.has("__root__")).toBe(true);
    expect(RESERVED_COLUMN_IDS.has("__start__")).toBe(true);
  });

  test("does not leak broader `__xx__` patterns", () => {
    // R's internal `__row_number__` id must NOT be reserved — the widget
    // uses it for default label columns.
    expect(RESERVED_COLUMN_IDS.has("__row_number__")).toBe(false);
  });
});
