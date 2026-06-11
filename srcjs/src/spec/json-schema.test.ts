// JSON Schema publication gate (roadmap area D, 2026-06-11).
//
// The publishable schema (generated from SCHEMA_REGISTRY by
// scripts/generate-json-schema.ts) must:
//   1. validate a REAL spec produced by the TS authoring path,
//   2. reject structurally broken specs (the schema has teeth),
//   3. stay in sync with the registry (regeneration is clean — the
//      drift half: an option added without regenerating fails here).

import { describe, it, expect } from "bun:test";
import { readFileSync } from "fs";
import Ajv from "ajv/dist/2020";
import { tabviz, colText, colNumeric, vizForest } from "../authoring";
import { buildTheme } from "../lib/theme/theme-adapter";
import { NEJM } from "../lib/theme/theme-presets-inputs";
import { SCHEMA_REGISTRY } from "../schema/columns/index";

const schemaPath = new URL("./generated/tabviz-spec.schema.json", import.meta.url);
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema(schema);
const validate = ajv.compile({ $ref: `${schema.$id}#/$defs/webSpec` });

function realSpec(): unknown {
  return tabviz({
    data: [
      { s: "A", n: 4, hr: 0.8, lo: 0.6, hi: 1.0 },
      { s: "B", n: 9, hr: 1.1, lo: 0.9, hi: 1.4 },
    ],
    label: "s",
    columns: [
      colText({ field: "s", header: "Study" }),
      colNumeric({ field: "n", header: "N", decimals: 0 }),
      vizForest({ point: "hr", lower: "lo", upper: "hi", header: "HR" }),
    ],
    theme: buildTheme(NEJM, "nejm"),
    title: "Schema gate",
  });
}

describe("published JSON Schema", () => {
  it("validates a real authored spec", () => {
    const ok = validate(realSpec());
    expect(ok, JSON.stringify(validate.errors?.slice(0, 3), null, 1)).toBe(true);
  });

  it("rejects a structurally broken spec", () => {
    expect(validate({ version: "9.0", data: {} })).toBe(false);       // bad major + missing required
    const bad = realSpec() as { columns: { options: Record<string, unknown> }[] };
    bad.columns[1]!.options = { numeric: { decimals: "lots" } };       // wrong option type
    expect(validate(bad)).toBe(false);
  });

  it("stays in sync with SCHEMA_REGISTRY (regenerate on drift)", () => {
    const wireTypes = new Set(Object.values(SCHEMA_REGISTRY)
      .filter((s) => !(s as { abstract?: boolean }).abstract)
      .map((s) => (s as { type?: string }).type)
      .filter(Boolean));
    const defs = Object.keys(schema.$defs).filter((k) => k.startsWith("column_")).length;
    expect(defs, "wire-type def count ≠ registry — run scripts/generate-json-schema.ts").toBe(wireTypes.size);
  });
});
