// roleOverrides → rendering wiring gate (settings-overhaul P0, DT-8/9).
//
// Before this arc, role pins were studio-preview-only: getCssVars built
// its wire with EMPTY overrides (spine rebinds never affected widget
// rendering) and every studio export serialized bare inputs (the rebind
// didn't survive the studio's own Copy JSON). This gate pins the chain:
// buildTheme stores overrides on the artifact → getCssVars resolves with
// them → distinct override sets don't poison each other's cache entry.

import { describe, it, expect } from "bun:test";
import { buildTheme } from "./theme-adapter";
import { getCssVars, isValidPinValue } from "./consumer-bridge";
import { TOKENS_BY_VAR } from "./component-tokens";
import { buildThemeCSS } from "./theme-css";
import { PRESETS } from "./theme-presets-inputs";

const inputs = PRESETS["nejm"]!;

describe("roleOverrides on the theme artifact", () => {
  it("buildTheme stores overrides and getCssVars resolves with them", () => {
    const plain = buildTheme(inputs, "a");
    const pinned = buildTheme(inputs, {
      name: "a",
      roleOverrides: { "text-muted": { ramp: "brand", grade: 8 } },
    });
    expect(pinned.roleOverrides?.["text-muted"]?.grade).toBe(8);
    const v0 = getCssVars(plain);
    const v1 = getCssVars(pinned);
    expect(v1["--tv-text-muted"]).not.toBe(v0["--tv-text-muted"]);
  });

  it("cache is override-aware: same inputs, different pins → different vars", () => {
    // Both themes share the SAME authoringInputs object identity — the
    // exact case the old single-level WeakMap cache got wrong.
    const a = buildTheme(inputs, {
      name: "a",
      roleOverrides: { "text-muted": { ramp: "brand", grade: 8 } },
    });
    const b = buildTheme(inputs, {
      name: "b",
      roleOverrides: { "text-muted": { ramp: "accent", grade: 9 } },
    });
    const va = getCssVars(a);
    const vb = getCssVars(b);
    expect(va["--tv-text-muted"]).not.toBe(vb["--tv-text-muted"]);
    // And the unpinned resolve is not contaminated either.
    const plain = getCssVars(buildTheme(inputs, "c"));
    expect(plain["--tv-text-muted"]).not.toBe(va["--tv-text-muted"]);
  });

  it("pins reach the WIDGET PAINT CSS, not just getCssVars (P0 review #1)", () => {
    // The paint path (_emitV4CssVarsBody -> buildThemeCSS/buildWidgetCSS/
    // getThemeCSS) builds its own wire — it dropped roleOverrides while
    // getCssVars carried them, so the live widget diverged from SVG
    // export for any pinned theme. This is the gate for the test blind
    // spot the adversarial review found.
    const plain = buildTheme(inputs, "p");
    const pinned = buildTheme(inputs, {
      name: "p",
      roleOverrides: { "text-muted": { ramp: "brand", grade: 8 } },
    });
    expect(buildThemeCSS(pinned)).not.toBe(buildThemeCSS(plain));
    expect(buildThemeCSS(pinned)).toContain(
      getCssVars(pinned)["--tv-text-muted"]!,
    );
  });

  it("string second arg stays a name shorthand (back-compat)", () => {
    const t = buildTheme(inputs, "shorthand");
    expect(t.name).toBe("shorthand");
    expect(t.roleOverrides).toEqual({});
  });
});

describe("border_preset → borders cluster expansion", () => {
  it("five presets produce five distinct clusters", () => {
    const sig = (p: NonNullable<typeof inputs.border_preset>): string => {
      const b = buildTheme({ ...inputs, border_preset: p }, p).borders;
      return `${b.layout}/${b.major.thickness}/${b.minor.thickness}/${b.table.thickness}`;
    };
    const sigs = (["none", "hairline", "ruled", "frame", "boxed"] as const).map(sig);
    expect(new Set(sigs).size).toBe(5);
  });

  it("unset ≡ hairline (the resolver default)", () => {
    // Strip border_preset from the fixture — cochrane now ships "frame"
    // (2026-06-08 elegance pass), so the UNSET default must be tested on a
    // border_preset-free input.
    const bare = { ...inputs, border_preset: undefined };
    const unset = buildTheme(bare, "u").borders;
    const hair = buildTheme({ ...bare, border_preset: "hairline" }, "h").borders;
    expect(unset).toEqual(hair);
  });
});

describe("pin accessibility ratchet (theme-rework W0 — paint enforcement)", () => {
  it("a pin on a modes.hc token applies in standard mode but is DROPPED under HC", () => {
    // The accessibility ratchet must win at paint, not just lint: a raw pin
    // overlays after the cascade's mode logic, so without this a pin would
    // defeat modes.hc:"drop" and ship the wrong color to an HC viewer.
    const hcTok = [...TOKENS_BY_VAR.values()].find((t) => t.modes?.hc)!;
    const pin = "#abcdef";
    const std = buildTheme(inputs, { name: "std", pins: { [hcTok.cssVar]: pin } });
    const hc = buildTheme({ ...inputs, mode: "high-contrast" },
      { name: "hc", pins: { [hcTok.cssVar]: pin }, skipValidation: true });
    expect(getCssVars(std)[hcTok.cssVar]).toBe(pin);        // standard: pin wins
    expect(getCssVars(hc)[hcTok.cssVar]).not.toBe(pin);     // HC: ratchet wins
  });
});

describe("token pins (P3 — the typed T2/3 channel)", () => {
  it("pins overlay both resolve paths (getCssVars + paint CSS)", () => {
    const pinned = buildTheme(inputs, {
      name: "p",
      pins: { "--tv-text-footnote-size": "0.7rem" },
    });
    expect(getCssVars(pinned)["--tv-text-footnote-size"]).toBe("0.7rem");
    expect(buildThemeCSS(pinned)).toContain("--tv-text-footnote-size: 0.7rem");
  });

  it("pin cache key separates pinned from unpinned (same inputs identity)", () => {
    const a = buildTheme(inputs, { name: "a", pins: { "--tv-text-footnote-size": "0.7rem" } });
    const b = buildTheme(inputs, "b");
    expect(getCssVars(a)["--tv-text-footnote-size"]).toBe("0.7rem");
    expect(getCssVars(b)["--tv-text-footnote-size"]).not.toBe("0.7rem");
  });

  it("non --tv- keys are ignored by the overlay (no style injection)", () => {
    const t = buildTheme(inputs, { name: "x", pins: { "background": "red" } as Record<string, string> });
    expect(getCssVars(t)["background"]).toBeUndefined();
  });

  // Round-2 robustness P0: a pin value with structural chars must not
  // reach getCssVars / the paint CSS — it would break out of the SVG
  // attribute / CSS declaration in a SHARED exported artifact.
  it("hostile pin values are dropped by the value gate (XSS guard)", () => {
    const hostile = '#fff"/><script>alert(1)</script><rect x="0';
    const t = buildTheme(inputs, { name: "h", pins: { "--tv-surface-bg": hostile } });
    expect(getCssVars(t)["--tv-surface-bg"]).not.toBe(hostile);
    expect(getCssVars(t)["--tv-surface-bg"] ?? "").not.toContain("<");
    expect(buildThemeCSS(t)).not.toContain("<script>");
  });

  it("valid pin values with single quotes / parens survive the gate", () => {
    const t = buildTheme(inputs, {
      name: "ok",
      pins: { "--tv-text-body-family": "'Inter', sans-serif" },
    });
    expect(getCssVars(t)["--tv-text-body-family"]).toBe("'Inter', sans-serif");
  });
});

describe("spacing pins: paint CSS matches export (round-2 cross-runtime P1)", () => {
  it("a theme.spacing edit appears in BOTH getCssVars and the paint CSS", () => {
    const t = buildTheme(inputs, "s") as unknown as { spacing: Record<string, number> };
    t.spacing.cellPaddingX = 77;
    const theme = t as never;
    // Export/layout path:
    expect(getCssVars(theme)["--tv-spacing-cell-padding-x"]).toBe("77px");
    // Paint path (the divergence the review caught): must agree, not the
    // density default.
    expect(buildThemeCSS(theme)).toContain("--tv-spacing-cell-padding-x: 77px");
  });
});

describe("isValidPinValue (the shared ingress gate)", () => {
  it("rejects structural chars, control chars, over-length; accepts normal CSS", () => {
    expect(isValidPinValue("#abcdef")).toBe(true);
    expect(isValidPinValue("0.7rem")).toBe(true);
    expect(isValidPinValue("'Inter', sans-serif")).toBe(true);
    expect(isValidPinValue("rgb(1,2,3)")).toBe(true);
    expect(isValidPinValue('a"b')).toBe(false);
    expect(isValidPinValue("a<b")).toBe(false);
    expect(isValidPinValue("a;b")).toBe(false);
    expect(isValidPinValue("a{b}")).toBe(false);
    expect(isValidPinValue("a\nb")).toBe(false);
    expect(isValidPinValue("")).toBe(false);
    expect(isValidPinValue("x".repeat(513))).toBe(false);
    expect(isValidPinValue(42)).toBe(false);
  });
});
