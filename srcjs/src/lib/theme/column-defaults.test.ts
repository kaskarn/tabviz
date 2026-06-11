// Theme-as-house-style: theme.column_defaults kind-gate + author-wins tests.

import { describe, it, expect } from "bun:test";
import { applyThemeColumnDefaults, applyThemeColumnDefaultsToSpec, rebaseThemeColumnDefaults, rebaseSpecForThemeSwitch } from "./column-defaults";
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

  it("drops a hostile leaf inside an OBJECT-valued styling option (badge.colors)", () => {
    // badge.colors is a Record<string,string> reaching fill="${color}" raw —
    // a single poisoned leaf must reject the whole value (recursive gate).
    const gcol = (opts: Record<string, unknown> = {}): ColumnDef =>
      ({ id: "g", field: "g", type: "badge", header: "G", options: { badge: opts } }) as unknown as ColumnDef;
    const evil = applyThemeColumnDefaults([gcol({})], {
      badge: { colors: { yes: "#0a0", no: 'red" onload="alert(1)' } },
    });
    expect((evil[0] as unknown as { options: { badge: Record<string, unknown> } }).options.badge.colors).toBeUndefined();
    // An all-clean color map applies.
    const clean = applyThemeColumnDefaults([gcol({})], { badge: { colors: { yes: "#0a0", no: "#a00" } } });
    expect((clean[0] as unknown as { options: { badge: { colors: Record<string, string> } } }).options.badge.colors)
      .toEqual({ yes: "#0a0", no: "#a00" });
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

describe("theme-switch re-base (#65)", () => {
  it("the OLD theme's baked value resets to the schema default", () => {
    // Theme A baked stars=true (schema default is false).
    const baked = applyThemeColumnDefaults([pcol({})], { pvalue: { stars: true } });
    expect(optsOf(baked[0]!).stars).toBe(true);
    const rebased = rebaseThemeColumnDefaults(baked, { pvalue: { stars: true } });
    expect(optsOf(rebased[0]!).stars).toBe(false); // back to schema default
  });

  it("an author value DIFFERENT from the old theme's default survives the re-base", () => {
    const cols = [pcol({ starsColor: "none" })]; // author deviation
    const rebased = rebaseThemeColumnDefaults(cols, { pvalue: { starsColor: "negative" } });
    expect(optsOf(rebased[0]!).starsColor).toBe("none");
  });

  it("A → B switch: B's house style applies instead of A's sticking", () => {
    const mkSpec = (columns: ColumnDef[], cd: Record<string, Record<string, unknown>> | undefined): WebSpec =>
      ({ columns, theme: { authoringInputs: cd ? { column_defaults: cd } : {} } }) as unknown as WebSpec;
    // Ingest under theme A.
    const a = applyThemeColumnDefaultsToSpec(mkSpec([pcol({})], { pvalue: { significantStyle: "pill" } }));
    expect(optsOf(a.columns[0]!).significantStyle).toBe("pill");
    // Switch to theme B (incoming spec carries A's baked columns + B's theme).
    const incoming = mkSpec(a.columns as ColumnDef[], { pvalue: { significantStyle: "bold" } });
    const b = rebaseSpecForThemeSwitch(incoming, { pvalue: { significantStyle: "pill" } });
    expect(optsOf(b.columns[0]!).significantStyle).toBe("bold"); // not "pill"
  });

  it("switch to a theme WITHOUT defaults fully un-themes", () => {
    const mkSpec = (columns: ColumnDef[], cd?: Record<string, Record<string, unknown>>): WebSpec =>
      ({ columns, theme: { authoringInputs: cd ? { column_defaults: cd } : {} } }) as unknown as WebSpec;
    const a = applyThemeColumnDefaultsToSpec(mkSpec([pcol({})], { pvalue: { stars: true } }));
    const b = rebaseSpecForThemeSwitch(mkSpec(a.columns as ColumnDef[]), { pvalue: { stars: true } });
    expect(optsOf(b.columns[0]!).stars).toBe(false);
  });

  it("same-theme re-ingest is value-stable (rebase + re-merge round-trips)", () => {
    const cd = { pvalue: { stars: true } };
    const mk = (columns: ColumnDef[]): WebSpec =>
      ({ columns, theme: { authoringInputs: { column_defaults: cd } } }) as unknown as WebSpec;
    const a = applyThemeColumnDefaultsToSpec(mk([pcol({})]));
    const again = rebaseSpecForThemeSwitch(mk(a.columns as ColumnDef[]), cd);
    expect(optsOf(again.columns[0]!).stars).toBe(true);
  });
});
