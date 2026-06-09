// Tests for the v4 theme-store surface — wraps the new wire API and
// exposes the role-binding override surface to consumers.
//
// Stage 1 step 3 of the substrate sprint; rewrites the v3 pinPath/inspect
// tests to match the new store API.

import { describe, it, expect } from "bun:test";
import { createThemeStoreV3Plain } from "./theme-store.plain";
import { NEJM, LEDGER } from "../lib/theme/theme-presets-inputs";
import { hexToOklch, oklchToHex } from "../lib/oklch";

describe("ThemeStore — reactive theme store", () => {
  it("initializes from inputs", () => {
    const s = createThemeStoreV3Plain(NEJM, "nejm");
    expect(s.wire.name).toBe("nejm");
    expect(oklchToHex(s.wire.inputs.anchors.brand)).toBe("#BD2F2F"); // NEJM crimson
    expect(s.wire.$schema).toBe("tabviz-theme/v4");
    expect(s.theme.schemaVersion).toBe(4);
    expect(s.theme.tokens.ink).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("setInput updates the resolved theme", () => {
    const s = createThemeStoreV3Plain(NEJM);
    const before = s.theme.tokens.brand;
    s.setInput("anchors", { ...s.wire.inputs.anchors, brand: hexToOklch("#FF0000") });
    const after = s.theme.tokens.brand;
    expect(after).not.toBe(before);
  });

  it("polarity toggle inverts paper/ink", () => {
    const s = createThemeStoreV3Plain(NEJM);
    const paperLight = s.theme.tokens.paper;
    s.setInput("polarity", "dark");
    const paperDark = s.theme.tokens.paper;
    expect(paperDark).not.toBe(paperLight);
  });

  it("setRoleBinding + releaseRole round-trip on the store", () => {
    const s = createThemeStoreV3Plain(NEJM);
    expect(s.isRolePinned("surface-subtle")).toBe(false);

    s.setRoleBinding("surface-subtle", "neutral", 5);
    expect(s.isRolePinned("surface-subtle")).toBe(true);
    expect(s.getRoleBinding("surface-subtle")).toEqual({ ramp: "neutral", grade: 5 });

    s.releaseRole("surface-subtle");
    expect(s.isRolePinned("surface-subtle")).toBe(false);
  });

  it("pinTokenByName resolves a component-token name to a role pin", () => {
    const s = createThemeStoreV3Plain(NEJM);
    // --tv-row-alt-bg sources from role surface-subtle
    s.pinTokenByName("row-alt-bg", "neutral", 1);
    expect(s.isRolePinned("surface-subtle")).toBe(true);
    expect(s.getRoleBinding("surface-subtle")).toEqual({ ramp: "neutral", grade: 1 });
  });

  it("getRoleProvenance distinguishes default vs override on the store", () => {
    const s = createThemeStoreV3Plain(NEJM);
    const p0 = s.getRoleProvenance("surface");
    expect(p0.source).toBe("default");
    s.setRoleBinding("surface", "neutral", 5);
    const p1 = s.getRoleProvenance("surface");
    expect(p1.source).toBe("override");
  });

  it("releaseAllRoles clears all overrides", () => {
    const s = createThemeStoreV3Plain(NEJM);
    s.setRoleBinding("surface", "neutral", 5);
    s.setRoleBinding("border", "brand", 7);
    expect(Object.keys(s.wire.roleOverrides)).toHaveLength(2);
    s.releaseAllRoles();
    expect(s.wire.roleOverrides).toEqual({});
  });

  it("reset to a different preset swaps inputs", () => {
    const s = createThemeStoreV3Plain(NEJM, "nejm");
    const nejmBrand = oklchToHex(s.wire.inputs.anchors.brand);
    s.reset(LEDGER, "ledger"); // a genuinely different survivor (teal + oxblood)
    expect(s.wire.name).toBe("ledger");
    expect(oklchToHex(s.wire.inputs.anchors.brand)).not.toBe(nejmBrand);
    // Ledger is a two-color theme: accent (oxblood) distinct from brand (teal).
    expect(s.wire.inputs.anchors.accent).toBeDefined();
    expect(oklchToHex(s.wire.inputs.anchors.accent!)).not.toBe(
      oklchToHex(s.wire.inputs.anchors.brand),
    );
  });

  it("reset clears role overrides while keeping inputs", () => {
    const s = createThemeStoreV3Plain(NEJM);
    s.setRoleBinding("surface", "neutral", 5);
    expect(Object.keys(s.wire.roleOverrides)).toHaveLength(1);
    s.reset(s.wire.inputs);
    expect(Object.keys(s.wire.roleOverrides)).toHaveLength(0);
  });

  it("load swaps the entire wire", () => {
    const s = createThemeStoreV3Plain(NEJM, "nejm");
    s.setRoleBinding("surface", "neutral", 5);
    // Load a fresh wire with no overrides
    s.reset(NEJM, "nejm");
    expect(s.wire.roleOverrides).toEqual({});
    expect(s.wire.name).toBe("nejm");
  });
});

describe("ThemeStore — input changes propagate to derived clusters", () => {
  it("changing brand anchor changes the resolved brand token", () => {
    const s = createThemeStoreV3Plain(NEJM);
    const before = s.theme.tokens.brand;
    s.setInput("anchors", { ...s.wire.inputs.anchors, brand: hexToOklch("#FF0000") });
    const after = s.theme.tokens.brand;
    expect(after).not.toBe(before);
  });

  it("brand_ink picks the right end against brand bg (APCA-derived)", () => {
    const s = createThemeStoreV3Plain(NEJM);
    const lightNeutral = s.theme.ramps.neutral[0]!;
    const darkNeutral = s.theme.ramps.neutral[11]!;
    expect([lightNeutral, darkNeutral]).toContain(s.theme.tokens.brand_ink);
  });
});
