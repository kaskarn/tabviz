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
import { getCssVars } from "./consumer-bridge";
import { buildThemeCSS } from "./theme-css";
import { PRESETS } from "./theme-presets-inputs";

const inputs = PRESETS["cochrane"]!;

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

  it("unset ≡ hairline (no existing theme shifts)", () => {
    const unset = buildTheme(inputs, "u").borders;
    const hair = buildTheme({ ...inputs, border_preset: "hairline" }, "h").borders;
    expect(unset).toEqual(hair);
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
});
