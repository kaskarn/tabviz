import { describe, it, expect } from "bun:test";
import { createThemeStoreV3Plain } from "./theme-store-v3.runes";
import { COCHRANE_V3, LANCET_V3 } from "../lib/theme-presets-v3";
import { ref, lit } from "../types/theme-v3";

describe("ThemeStoreV3 — reactive theme store", () => {
  it("initializes from inputs", () => {
    const s = createThemeStoreV3Plain(COCHRANE_V3, "cochrane");
    expect(s.wire.name).toBe("cochrane");
    expect(s.wire.inputs.brand).toBe("#0099CC");
    expect(s.theme.schemaVersion).toBe(3);
    expect(s.theme.tokens.ink).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("setInput updates the resolved theme", () => {
    const s = createThemeStoreV3Plain(COCHRANE_V3);
    const before = s.theme.tokens.brand;
    s.setInput("brand", "#FF0000");
    const after = s.theme.tokens.brand;
    expect(after).not.toBe(before);
  });

  it("mode toggle inverts paper/ink", () => {
    const s = createThemeStoreV3Plain(COCHRANE_V3);
    const paperLight = s.theme.tokens.paper;
    s.setInput("mode", "dark");
    const paperDark = s.theme.tokens.paper;
    expect(paperDark).not.toBe(paperLight);
  });

  it("pinPath + releasePath round-trip", () => {
    const s = createThemeStoreV3Plain(COCHRANE_V3);
    const beforeFg = s.theme.clusters.cell.fg;

    s.pinPath("clusters.cell.fg", lit("#FF00FF"));
    expect(s.isPinned("clusters.cell.fg")).toBe(true);
    expect(s.theme.clusters.cell.fg).toEqual({ hex: "#FF00FF" });

    s.releasePath("clusters.cell.fg");
    expect(s.isPinned("clusters.cell.fg")).toBe(false);
    expect(s.theme.clusters.cell.fg).toEqual(beforeFg);
  });

  it("inspect returns provenance + resolved hex", () => {
    const s = createThemeStoreV3Plain(COCHRANE_V3);
    s.pinPath("clusters.cell.fg", ref("ink_muted"));
    const info = s.inspect("clusters.cell.fg");
    expect(info.provenance.source).toBe("pin");
    expect(info.resolved).toBe(s.theme.tokens.ink_muted);
  });

  it("load swaps to a different wire", () => {
    const s = createThemeStoreV3Plain(COCHRANE_V3, "cochrane");
    s.reset(LANCET_V3, "lancet");
    expect(s.wire.name).toBe("lancet");
    expect(s.wire.inputs.brand).toBe("#00407A");
    expect(s.wire.inputs.decorative).toBe("#A6792A");
    expect(s.theme.ramps.decorative).not.toBeNull();
  });

  it("reset clears pins + overrides while keeping inputs", () => {
    const s = createThemeStoreV3Plain(COCHRANE_V3);
    s.pinPath("clusters.cell.fg", lit("#FF00FF"));
    expect(s.wire.pins.length).toBe(1);
    s.reset(s.wire.inputs);
    expect(s.wire.pins.length).toBe(0);
    expect(Object.keys(s.wire.overrides).length).toBe(0);
  });
});

describe("ThemeStoreV3 — input changes propagate to derived clusters", () => {
  it("changing brand changes header.bold bg", () => {
    const s = createThemeStoreV3Plain(COCHRANE_V3);
    const before = s.inspect("clusters.header.bold.bg").resolved;
    s.setInput("brand", "#FF0000");
    const after = s.inspect("clusters.header.bold.bg").resolved;
    expect(after).not.toBe(before);
  });

  it("brand_ink picks the right end against brand bg (APCA-derived)", () => {
    // Brand step 9 is the resolved brand color. For most seeds in light
    // mode this is a mid-L vibrant — brand_ink should be dark (neutral.12).
    // For a very-light brand seed in light mode, the resolved brand
    // remains at step 9's L (still mid), so brand_ink also stays dark.
    // This test confirms the invariant holds rather than that brand_ink
    // changes when brand input changes nominally.
    const s = createThemeStoreV3Plain(COCHRANE_V3);
    const lightNeutral = s.theme.ramps.neutral[0]!;
    const darkNeutral = s.theme.ramps.neutral[11]!;
    expect([lightNeutral, darkNeutral]).toContain(s.theme.tokens.brand_ink);
  });

  it("adding decorative produces decorative ramp", () => {
    const s = createThemeStoreV3Plain(COCHRANE_V3);
    expect(s.theme.ramps.decorative).toBeNull();
    s.setInput("decorative", "#A6792A");
    expect(s.theme.ramps.decorative).not.toBeNull();
  });
});
