// Theme-as-house-style: theme.column_defaults kind-gate + author-wins tests.

import { describe, it, expect } from "bun:test";
import { applyThemeColumnDefaults, applyThemeColumnDefaultsToSpec } from "./column-defaults";
import type { ColumnDef, WebSpec } from "../../types";

// Explicit wire-shaped pvalue column (avoids any builder default-omission
// ambiguity — we control exactly which options are set).
const pcol = (opts: Record<string, unknown> = {}): ColumnDef =>
  ({ id: "p", field: "p", type: "pvalue", header: "P", options: { pvalue: opts } }) as unknown as ColumnDef;

const optsOf = (c: ColumnDef): Record<string, unknown> =>
  (c as unknown as { options: { pvalue: Record<string, unknown> } }).options.pvalue;

describe("applyThemeColumnDefaults", () => {
  it("fills an UNSET styling option from the theme default", () => {
    const out = applyThemeColumnDefaults([pcol({})], { pvalue: { significantStyle: "pill", stars: true } });
    expect(optsOf(out[0]!).significantStyle).toBe("pill");
    expect(optsOf(out[0]!).stars).toBe(true);
  });

  it("the AUTHOR'S non-default value wins (default mode — never clobbered)", () => {
    // starsColor default is "accent"; the author deviated to "none", so the
    // theme's "negative" must NOT override it.
    const out = applyThemeColumnDefaults([pcol({ starsColor: "none" })], { pvalue: { starsColor: "negative" } });
    expect(optsOf(out[0]!).starsColor).toBe("none");
  });

  it("a value still at the SCHEMA default is themeable (theme default > schema default)", () => {
    // starsColor at its schema default "accent" → the theme may move it.
    const out = applyThemeColumnDefaults([pcol({ starsColor: "accent" })], { pvalue: { starsColor: "negative" } });
    expect(optsOf(out[0]!).starsColor).toBe("negative");
  });

  it("CORE options are DROPPED (kind gate — theme can't change data/precision)", () => {
    const out = applyThemeColumnDefaults([pcol({})], { pvalue: { digits: 5, significantStyle: "pill" } });
    expect(optsOf(out[0]!).digits).toBeUndefined(); // digits is kind:"core"
    expect(optsOf(out[0]!).significantStyle).toBe("pill"); // styling still applies
  });

  it("drops a hostile string value (XSS gate — untrusted theme wire → SVG attr)", () => {
    // bar.color is a styling option that reaches `fill="${color}"` raw in the
    // SVG renderer. A value carrying attribute-breaking chars must be dropped.
    const bcol = (opts: Record<string, unknown> = {}): ColumnDef =>
      ({ id: "b", field: "b", type: "bar", header: "B", options: { bar: opts } }) as unknown as ColumnDef;
    const evil = 'red" onmouseover="alert(1)';
    const out = applyThemeColumnDefaults([bcol({})], { bar: { color: evil } });
    const got = (out[0] as unknown as { options: { bar: Record<string, unknown> } }).options.bar.color;
    expect(got).toBeUndefined(); // hostile value never applied
    // A clean color string still applies.
    const ok = applyThemeColumnDefaults([bcol({})], { bar: { color: "#3366cc" } });
    expect((ok[0] as unknown as { options: { bar: Record<string, unknown> } }).options.bar.color).toBe("#3366cc");
  });

  it("UNKNOWN option keys are dropped (treated as core)", () => {
    const out = applyThemeColumnDefaults([pcol({})], { pvalue: { notARealOption: 1 } });
    expect(optsOf(out[0]!).notARealOption).toBeUndefined();
  });

  it("a column whose type has no defaults is returned BY REFERENCE", () => {
    const cols = [pcol({})];
    const out = applyThemeColumnDefaults(cols, { interval: { variant: "x" } });
    expect(out[0]).toBe(cols[0]);
  });

  it("undefined column_defaults is a no-op", () => {
    const cols = [pcol({ stars: true })];
    const out = applyThemeColumnDefaults(cols, undefined);
    expect(out[0]).toBe(cols[0]);
  });
});

describe("applyThemeColumnDefaultsToSpec (cross-runtime ingest seam)", () => {
  const specWith = (column_defaults?: Record<string, Record<string, unknown>>): WebSpec =>
    ({
      columns: [pcol({})],
      theme: { authoringInputs: column_defaults ? { column_defaults } : {} },
    }) as unknown as WebSpec;

  it("applies theme.authoringInputs.column_defaults to the spec's columns", () => {
    const out = applyThemeColumnDefaultsToSpec(specWith({ pvalue: { stars: true } }));
    const col = out.columns[0] as unknown as { options: { pvalue: Record<string, unknown> } };
    expect(col.options.pvalue.stars).toBe(true);
  });

  it("returns the SAME spec reference when nothing changes (hot-path no-op)", () => {
    const spec = specWith(undefined);
    expect(applyThemeColumnDefaultsToSpec(spec)).toBe(spec);
    // A core-only default also changes nothing → same ref.
    const coreOnly = specWith({ pvalue: { digits: 5 } });
    expect(applyThemeColumnDefaultsToSpec(coreOnly)).toBe(coreOnly);
  });

  it("is idempotent — re-applying does not move the value again", () => {
    const once = applyThemeColumnDefaultsToSpec(specWith({ pvalue: { stars: true } }));
    const twice = applyThemeColumnDefaultsToSpec(once);
    expect(twice).toBe(once); // already merged → no further change → same ref
  });
});
