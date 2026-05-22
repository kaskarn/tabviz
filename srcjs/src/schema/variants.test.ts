// Tests for variants + suppressedOptions + mutuallyExclusive
// resolution machinery on ColumnSchema.

import { describe, test, expect } from "bun:test";
import { INTERVAL_SCHEMA } from "./columns/interval";
import { BADGE_SCHEMA } from "./columns/badge";
import { PICTOGRAM_SCHEMA } from "./columns/pictogram";
import { NUMERIC_SCHEMA } from "./columns/numeric";
import { CATEGORICAL_SCHEMA } from "./columns/categorical";
import { ORDINAL_SCHEMA } from "./columns/ordinal";
import { resolveSchema } from "./resolve";

describe("VariantSpec — declared on schemas", () => {
  test("INTERVAL declares four variants", () => {
    expect(INTERVAL_SCHEMA.variants).toBeDefined();
    expect(INTERVAL_SCHEMA.variants!.map((v) => v.id)).toEqual([
      "traditional",
      "bracket_muted",
      "plus_minus",
      "stacked",
    ]);
  });

  test("BADGE declares four variants", () => {
    expect(BADGE_SCHEMA.variants).toBeDefined();
    expect(BADGE_SCHEMA.variants!.map((v) => v.id)).toEqual([
      "pill",
      "outline",
      "square",
      "minimal",
    ]);
  });

  test("PICTOGRAM declares three variants", () => {
    expect(PICTOGRAM_SCHEMA.variants).toBeDefined();
    expect(PICTOGRAM_SCHEMA.variants!.map((v) => v.id)).toEqual([
      "row",
      "stack",
      "row_value_trail",
    ]);
  });

  test("each variant carries label + description", () => {
    for (const v of INTERVAL_SCHEMA.variants ?? []) {
      expect(v.label).toBeTruthy();
      expect(v.description).toBeTruthy();
    }
  });

  test("first variant is the default convention", () => {
    expect(INTERVAL_SCHEMA.variants?.[0].id).toBe("traditional");
    expect(BADGE_SCHEMA.variants?.[0].id).toBe("pill");
  });
});

describe("suppressedOptions", () => {
  test("NUMERIC suppresses inherited TEXT.maxChars", () => {
    expect(NUMERIC_SCHEMA.suppressedOptions).toContain("maxChars");
  });

  test("editor consumers will honor suppressedOptions (contract test)", () => {
    // The actual editor honors `suppressedOptions` by skipping
    // listed keys when rendering inherited FieldRows. Here we just
    // verify the field exists on the schema and is read-able.
    const numeric = NUMERIC_SCHEMA;
    expect(numeric.suppressedOptions).toBeDefined();
    expect(Array.isArray(numeric.suppressedOptions)).toBe(true);
  });
});

describe("mutuallyExclusive", () => {
  test("NUMERIC declares decimals ⊥ digits", () => {
    expect(NUMERIC_SCHEMA.mutuallyExclusive).toEqual([["decimals", "digits"]]);
  });

  test("CATEGORICAL declares levels ⊥ levelsRef", () => {
    expect(CATEGORICAL_SCHEMA.mutuallyExclusive).toEqual([["levels", "levelsRef"]]);
  });
});

describe("CATEGORICAL / ORDINAL schemas", () => {
  test("CATEGORICAL is abstract", () => {
    expect(CATEGORICAL_SCHEMA.abstract).toBe(true);
    expect(CATEGORICAL_SCHEMA.bucket).toBeUndefined();
    expect(CATEGORICAL_SCHEMA.type).toBeUndefined();
  });

  test("ORDINAL is abstract and inherits CATEGORICAL", () => {
    expect(ORDINAL_SCHEMA.abstract).toBe(true);
    expect(ORDINAL_SCHEMA.inherits).toBe("categorical");
  });

  test("ORDINAL resolution walks through CATEGORICAL → BASE", () => {
    const chain = resolveSchema(ORDINAL_SCHEMA).map((s) => s.key);
    expect(chain).toEqual(["base", "categorical", "ordinal"]);
  });

  test("CATEGORICAL contributes a `levels` option", () => {
    expect(CATEGORICAL_SCHEMA.options.find((o) => o.key === "levels")).toBeDefined();
    expect(CATEGORICAL_SCHEMA.options.find((o) => o.key === "levelsRef")).toBeDefined();
  });
});
