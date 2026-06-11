// Structured spec validation (area D, 2026-06-11): {path, code,
// message, severity} diagnostics; assertValidSpec is the ingress wall.

import { describe, it, expect } from "bun:test";
import { validateSpec, assertValidSpec, SpecValidationError } from "./validate";
import { CURRENT_VERSION } from "./index";

function goodSpec(): Record<string, unknown> {
  return {
    version: CURRENT_VERSION,
    // Real WebData wire shape: rows carry {id, label, metadata}; ALL
    // field data lives in metadata.
    data: {
      rows: [{ id: "row_1", label: "A", metadata: { s: "A", n: 4, hr: 0.8, lo: 0.6, hi: 1.0 } }],
      groups: [],
    },
    columns: [
      { id: "c1", type: "text", field: "s" },
      { id: "c2", type: "numeric", field: "n" },
      { id: "c3", type: "forest", field: "_forest_hr", options: { forest: { point: "hr", lower: "lo", upper: "hi" } } },
    ],
    labelColumn: { id: "label", type: "text", field: "s" },
  };
}

const codes = (issues: { code: string }[]) => issues.map((i) => i.code).sort();

describe("validateSpec", () => {
  it("passes a well-formed spec with zero issues", () => {
    expect(validateSpec(goodSpec())).toEqual([]);
  });

  it("rejects non-objects and missing/alien versions as errors", () => {
    expect(codes(validateSpec(null))).toEqual(["shape"]);
    expect(codes(validateSpec({ ...goodSpec(), version: undefined }))).toEqual(["version-missing"]);
    expect(codes(validateSpec({ ...goodSpec(), version: "9.0" }))).toEqual(["version-major"]);
  });

  it("rejects broken data/columns shapes", () => {
    expect(codes(validateSpec({ ...goodSpec(), data: [] }))).toEqual(["shape"]);          // array is NOT the wire shape
    expect(codes(validateSpec({ ...goodSpec(), data: {} }))).toEqual(["shape"]);          // missing rows
    expect(codes(validateSpec({ ...goodSpec(), data: { rows: [{ id: "r1" }] } }))).toEqual(["shape"]); // row without metadata
    expect(codes(validateSpec({ ...goodSpec(), columns: "nope" }))).toEqual(["shape"]);
    const s = goodSpec();
    (s.columns as unknown[])[1] = { id: "c2", field: "n" }; // no type
    expect(codes(validateSpec(s))).toEqual(["missing-type"]);
  });

  it("enforces row ids (present, non-empty, unique)", () => {
    const s = goodSpec();
    (s.data as { rows: Record<string, unknown>[] }).rows.push(
      { id: "row_1", label: "B", metadata: { s: "B" } },  // dup
      { label: "C", metadata: { s: "C" } },                // missing
    );
    const issues = validateSpec(s);
    expect(codes(issues)).toEqual(["duplicate-id", "missing-id"]);
    expect(issues.map((i) => i.path).sort()).toEqual(["data.rows[1].id", "data.rows[2].id"]);
  });

  it("flags duplicate column ids with both positions", () => {
    const s = goodSpec();
    (s.columns as { id: string }[])[1].id = "c1";
    const issues = validateSpec(s);
    expect(codes(issues)).toEqual(["duplicate-id"]);
    expect(issues[0].path).toBe("columns[1].id");
    expect(issues[0].message).toContain("columns[0]");
  });

  it("warns (not errors) on unknown field references — incl. forest options", () => {
    const s = goodSpec();
    (s.columns as { field: string }[])[0].field = "ghost";
    const forest = (s.columns as { options?: { forest: { upper: string } } }[])[2].options!.forest;
    forest.upper = "phantom";
    const issues = validateSpec(s);
    expect(issues.every((i) => i.severity === "warning")).toBe(true);
    expect(issues.map((i) => i.path).sort()).toEqual([
      "columns[0].field",
      "columns[2].options.forest.upper",
    ]);
    expect(new Set(codes(issues))).toEqual(new Set(["unknown-ref"]));
  });

  it("treats sparse rows as legitimate (field present in ANY row)", () => {
    const s = goodSpec();
    (s.data as { rows: unknown[] }).rows.push({ id: "row_2", label: "B", metadata: { extra: 1 } }); // no `s` here
    expect(validateSpec(s)).toEqual([]);
  });

  it("unknown-type warning only fires with an explicit roster", () => {
    const s = goodSpec();
    expect(validateSpec(s, { knownTypes: ["text", "numeric"] }).map((i) => i.code)).toContain("unknown-type");
    expect(validateSpec(s)).toEqual([]); // additive-minor contract: no roster, no typo check
  });
});

describe("assertValidSpec", () => {
  it("throws SpecValidationError carrying only the errors", () => {
    const s = goodSpec();
    s.version = "9.0";
    (s.columns as { field: string }[])[0].field = "ghost"; // a warning
    let caught: SpecValidationError | null = null;
    try { assertValidSpec(s); } catch (e) { caught = e as SpecValidationError; }
    expect(caught).not.toBeNull();
    expect(caught!.issues.length).toBe(1);
    expect(caught!.issues[0].code).toBe("version-major");
    expect(caught!.message).toContain("version");
  });

  it("returns warnings when no errors exist", () => {
    const s = goodSpec();
    (s.columns as { field: string }[])[0].field = "ghost";
    const warnings = assertValidSpec(s);
    expect(warnings.length).toBe(1);
    expect(warnings[0].severity).toBe("warning");
  });
});
