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
