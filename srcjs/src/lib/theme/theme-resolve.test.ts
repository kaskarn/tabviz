// Tests for the theme resolver:
//   - buildRamps(inputs) — T0 ramp generation from T1 inputs
//   - resolveToken(name, ramps) — T2 token resolution
//   - on-X pair derivation via APCA
//
// PR B will expand these tests when the full T2 vocabulary lands.

import { describe, it, expect } from "bun:test";
import { buildRamps, resolveToken, resolveAllTokens, resolveRef, buildThemeStructure, defaultRoles, defaultClusters } from "./theme-resolve";
import { apcaLc, hexToOklch } from "../oklch";
import type { ThemeInputs } from "../../types/theme-inputs";
import { ref, lit } from "../../types/theme-inputs";

const COCHRANE: ThemeInputs = {
  brand: "#0099CC",
  accent: "#C8553D",
};

const LANCET: ThemeInputs = {
  brand: "#00407A",
  accent: "#A6792A",
  decorative: "#A6792A",
};

const DARK: ThemeInputs = {
  brand: "#89B4FA",
  mode: "dark",
};

describe("buildRamps — T0 ramp generation", () => {
  it("generates 12-step neutral + brand + accent ramps", () => {
    const r = buildRamps(COCHRANE);
    expect(r.neutral.length).toBe(12);
    expect(r.brand.length).toBe(12);
    expect(r.accent.length).toBe(12);
  });

  it("decorative ramp is null when not set", () => {
    const r = buildRamps(COCHRANE);
    expect(r.decorative).toBeNull();
  });

  it("decorative ramp generated when input set (Lancet)", () => {
    const r = buildRamps(LANCET);
    expect(r.decorative).not.toBeNull();
    expect(r.decorative!.length).toBe(12);
  });

  it("status palettes have 5 steps each", () => {
    const r = buildRamps(COCHRANE);
    expect(r.status.positive.length).toBe(5);
    expect(r.status.negative.length).toBe(5);
    expect(r.status.warning.length).toBe(5);
    expect(r.status.info.length).toBe(5);
  });

  it("light-mode ramp: paper bright, ink dark", () => {
    const r = buildRamps(COCHRANE);
    expect(hexToOklch(r.neutral[1]!).L).toBeGreaterThan(0.9); // paper (step 2)
    expect(hexToOklch(r.neutral[11]!).L).toBeLessThan(0.3);   // ink (step 12)
  });

  it("dark-mode ramp: paper dark, ink bright", () => {
    const r = buildRamps(DARK);
    expect(hexToOklch(r.neutral[1]!).L).toBeLessThan(0.4);    // paper (step 2)
    expect(hexToOklch(r.neutral[11]!).L).toBeGreaterThan(0.9); // ink (step 12)
  });
});

describe("resolveToken — T2 token surface", () => {
  it("paper / ink resolve to expected lightness in light mode", () => {
    const r = buildRamps(COCHRANE);
    const paper = resolveToken("paper", r);
    const ink = resolveToken("ink", r);
    expect(hexToOklch(paper).L).toBeGreaterThan(0.9);
    expect(hexToOklch(ink).L).toBeLessThan(0.3);
  });

  it("paper / ink resolve correctly in dark mode", () => {
    const r = buildRamps(DARK);
    const paper = resolveToken("paper", r);
    const ink = resolveToken("ink", r);
    expect(hexToOklch(paper).L).toBeLessThan(0.4); // dark paper
    expect(hexToOklch(ink).L).toBeGreaterThan(0.9); // light ink
  });

  it("brand resolves to brand step 9", () => {
    const r = buildRamps(COCHRANE);
    expect(resolveToken("brand", r)).toBe(r.brand[8]!);
  });

  it("rule_subtle and rule_strong are distinct neutral steps", () => {
    const r = buildRamps(COCHRANE);
    expect(resolveToken("rule_subtle", r)).not.toBe(resolveToken("rule_strong", r));
  });

  it("decorative_subtle falls back to brand when decorative is null", () => {
    const r = buildRamps(COCHRANE);
    expect(resolveToken("decorative_subtle", r)).toBe(r.brand[1]!);
  });

  it("decorative_subtle uses decorative ramp when set", () => {
    const r = buildRamps(LANCET);
    expect(resolveToken("decorative_subtle", r)).toBe(r.decorative![1]!);
  });
});

describe("on-X pair derivation — APCA-aware ink picks", () => {
  it("brand_ink on brand bg meets APCA Lc ≥ 60", () => {
    const r = buildRamps(COCHRANE);
    const brand = resolveToken("brand", r);
    const brandInk = resolveToken("brand_ink", r);
    expect(apcaLc(brandInk, brand)).toBeGreaterThanOrEqual(60);
  });

  it("accent_ink on accent bg meets APCA Lc ≥ 60", () => {
    const r = buildRamps(COCHRANE);
    const accent = resolveToken("accent", r);
    const accentInk = resolveToken("accent_ink", r);
    expect(apcaLc(accentInk, accent)).toBeGreaterThanOrEqual(60);
  });

  it("brand_ink picks an end of the neutral ramp (lightest or darkest)", () => {
    const r = buildRamps(COCHRANE);
    const brandInk = resolveToken("brand_ink", r);
    const lightest = r.neutral[0]!;
    const darkest = r.neutral[11]!;
    expect([lightest, darkest]).toContain(brandInk);
  });

  it("works for dark mode: brand_ink still contrasts well", () => {
    const r = buildRamps(DARK);
    const brand = resolveToken("brand", r);
    const brandInk = resolveToken("brand_ink", r);
    expect(apcaLc(brandInk, brand)).toBeGreaterThanOrEqual(60);
  });

  it("works for unusual brand (Lancet navy)", () => {
    const r = buildRamps(LANCET);
    const brand = resolveToken("brand", r);
    const brandInk = resolveToken("brand_ink", r);
    expect(apcaLc(brandInk, brand)).toBeGreaterThanOrEqual(60);
  });

  it("status inks meet APCA Lc ≥ 45 on status solid bgs (large-text/badge floor)", () => {
    // Status inks are most often used on status fills (badges, callout
    // chips) — large-text contexts, not body. APCA Lc 45 = readable;
    // Lc 60 is aspirational but the warning/orange palette can't always
    // hit it without distorting hue identity.
    const r = buildRamps(COCHRANE);
    for (const name of ["positive", "negative", "warning", "info"] as const) {
      const bg = resolveToken(name, r);
      const ink = resolveToken(`${name}_ink`, r);
      expect(apcaLc(ink, bg)).toBeGreaterThanOrEqual(45);
    }
  });
});

describe("resolveAllTokens — full token map", () => {
  it("returns hex for every token name", () => {
    const r = buildRamps(COCHRANE);
    const tokens = resolveAllTokens(r);
    const expectedKeys = [
      "paper", "paper_alt", "paper_raised", "paper_sunken",
      "ink", "ink_muted", "ink_subtle", "ink_disabled",
      "brand", "brand_hover", "brand_active", "brand_subtle", "brand_ink", "brand_ink_muted",
      "accent", "accent_subtle", "accent_ink", "accent_ink_muted",
      "decorative_subtle", "decorative_chrome",
      "rule_subtle", "rule_strong",
      "positive", "positive_ink",
      "negative", "negative_ink",
      "warning", "warning_ink",
      "info", "info_ink",
    ];
    for (const k of expectedKeys) {
      expect(tokens).toHaveProperty(k);
      expect((tokens as Record<string, string>)[k]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("contrast invariants hold for resolved theme (ink on paper, body floor)", () => {
    const r = buildRamps(COCHRANE);
    const t = resolveAllTokens(r);
    expect(apcaLc(t.ink, t.paper)).toBeGreaterThanOrEqual(75);
    expect(apcaLc(t.ink, t.paper_alt)).toBeGreaterThanOrEqual(75);
    expect(apcaLc(t.ink_muted, t.paper)).toBeGreaterThanOrEqual(45);
  });

  it("contrast invariants hold in dark mode", () => {
    const r = buildRamps(DARK);
    const t = resolveAllTokens(r);
    expect(apcaLc(t.ink, t.paper)).toBeGreaterThanOrEqual(75);
    expect(apcaLc(t.ink, t.paper_alt)).toBeGreaterThanOrEqual(75);
  });
});

describe("Lancet preset — two-color editorial integration", () => {
  it("decorative ramp produces gold-tinted chrome", () => {
    const r = buildRamps(LANCET);
    const decorChrome = resolveToken("decorative_chrome", r);
    const gold = hexToOklch("#A6792A");
    const chromeOk = hexToOklch(decorChrome);
    // Gold's hue is in the warm-yellow range (~85-95° in OKLCH)
    expect(Math.abs(chromeOk.H - gold.H)).toBeLessThan(30);
  });

  it("brand (navy) stays distinct from decorative_chrome (gold-tinted)", () => {
    const r = buildRamps(LANCET);
    const brand = resolveToken("brand", r);
    const decor = resolveToken("decorative_chrome", r);
    expect(brand).not.toBe(decor);
    expect(hexToOklch(brand).H).not.toBeCloseTo(hexToOklch(decor).H, 1);
  });
});

describe("resolveRef — string + tagged-object + hex disambiguation", () => {
  it("hex string passes through", () => {
    const r = buildRamps(COCHRANE);
    expect(resolveRef("#ff0000", r)).toBe("#ff0000");
    expect(resolveRef("#AABBCC", r)).toBe("#AABBCC");
  });

  it("token name string resolves to T2 token hex", () => {
    const r = buildRamps(COCHRANE);
    expect(resolveRef("ink", r)).toBe(resolveToken("ink", r));
    expect(resolveRef("brand", r)).toBe(resolveToken("brand", r));
  });

  it("ramp-step string resolves to ramp step", () => {
    const r = buildRamps(COCHRANE);
    expect(resolveRef("neutral.1", r)).toBe(r.neutral[0]!);
    expect(resolveRef("brand.9", r)).toBe(r.brand[8]!);
    expect(resolveRef("accent.5", r)).toBe(r.accent[4]!);
  });

  it("tagged ref object resolves like the string", () => {
    const r = buildRamps(COCHRANE);
    expect(resolveRef(ref("ink"), r)).toBe(resolveToken("ink", r));
    expect(resolveRef(ref("brand.9"), r)).toBe(r.brand[8]!);
  });

  it("tagged lit object passes through", () => {
    const r = buildRamps(COCHRANE);
    expect(resolveRef(lit("#123456"), r)).toBe("#123456");
  });

  it("alpha tag produces hex8", () => {
    const r = buildRamps(COCHRANE);
    const out = resolveRef(ref("ink", 0.5), r);
    expect(out).toMatch(/^#[0-9A-Fa-f]{8}$/);
  });

  it("null / undefined return null", () => {
    const r = buildRamps(COCHRANE);
    expect(resolveRef(null, r)).toBeNull();
    expect(resolveRef(undefined, r)).toBeNull();
  });

  it("decorative ramp ref falls back to brand when no decorative", () => {
    const r = buildRamps(COCHRANE);
    expect(resolveRef("decorative.5", r)).toBe(r.brand[4]!);
  });

  it("decorative ramp ref uses decorative when set", () => {
    const r = buildRamps(LANCET);
    expect(resolveRef("decorative.5", r)).toBe(r.decorative![4]!);
  });
});

describe("defaultRoles + defaultClusters — recipe shapes", () => {
  it("defaultRoles returns the 9 canonical roles", () => {
    const r = defaultRoles();
    expect(Object.keys(r).sort()).toEqual([
      "accent", "bold", "emphasis", "fill", "info",
      "muted", "negative", "positive", "warning",
    ]);
  });

  it("emphasis recipe uses ink (per locked design)", () => {
    const r = defaultRoles();
    const fg = r.emphasis.fg as { ref: string };
    expect(fg.ref).toBe("ink");
    expect(r.emphasis.fontWeight).toBe(600);
  });

  it("accent recipe uses accent token (engagement, per locked design)", () => {
    const r = defaultRoles();
    const fg = r.accent.fg as { ref: string };
    expect(fg.ref).toBe("accent");
  });

  it("status roles default to fg/markerFill only (Tufte-minimal; no bg)", () => {
    const r = defaultRoles();
    for (const status of ["positive", "negative", "warning", "info"] as const) {
      expect(r[status].bg).toBeUndefined();
      const fg = r[status].fg as { ref: string };
      expect(fg.ref).toBe(status);
    }
  });

  it("defaultClusters has all expected cluster keys", () => {
    const c = defaultClusters();
    expect(Object.keys(c).sort()).toEqual([
      "cell", "columnGroup", "firstColumn", "header",
      "marks", "plot", "row", "rowGroup",
    ]);
  });

  it("header.bold uses brand + brand_ink (per locked design)", () => {
    const c = defaultClusters();
    expect((c.header.bold.bg as { ref: string }).ref).toBe("brand");
    expect((c.header.bold.fg as { ref: string }).ref).toBe("brand_ink");
  });
});

describe("buildThemeStructure — full theme assembly", () => {
  it("returns schemaVersion 3 with inputs + ramps + tokens + roles + clusters", () => {
    const t = buildThemeStructure(COCHRANE);
    expect(t.schemaVersion).toBe(3);
    expect(t.name).toBe("custom");
    expect(t.inputs.brand).toBe("#0099CC");
    expect(t.ramps.brand.length).toBe(12);
    expect(t.tokens.ink).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(t.tokens.paper).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(t.roles.emphasis.fontWeight).toBe(600);
    expect(t.clusters.cell.bg).toBeTruthy();
  });

  it("custom theme name flows through", () => {
    const t = buildThemeStructure(COCHRANE, "cochrane");
    expect(t.name).toBe("cochrane");
  });

  it("Lancet two-color theme produces decorative ramp", () => {
    const t = buildThemeStructure(LANCET, "lancet");
    expect(t.ramps.decorative).not.toBeNull();
    expect(t.tokens.decorative_chrome).toBeTruthy();
  });

  it("Dark theme inverts paper/ink", () => {
    const t = buildThemeStructure(DARK, "dark");
    expect(hexToOklch(t.tokens.paper).L).toBeLessThan(0.4);
    expect(hexToOklch(t.tokens.ink).L).toBeGreaterThan(0.9);
  });

  it("cluster refs resolve correctly against the built theme", () => {
    const t = buildThemeStructure(COCHRANE);
    // header.light.bg ref → paper token → some hex
    const headerLightBg = resolveRef(t.clusters.header.light.bg, t.ramps);
    expect(headerLightBg).toBe(t.tokens.paper);
    // header.bold.bg ref → brand token
    const headerBoldBg = resolveRef(t.clusters.header.bold.bg, t.ramps);
    expect(headerBoldBg).toBe(t.tokens.brand);
    // header.bold.fg ref → brand_ink token
    const headerBoldFg = resolveRef(t.clusters.header.bold.fg, t.ramps);
    expect(headerBoldFg).toBe(t.tokens.brand_ink);
  });

  it("APCA invariant holds for resolved header.bold pair", () => {
    const t = buildThemeStructure(COCHRANE);
    const bg = resolveRef(t.clusters.header.bold.bg, t.ramps)!;
    const fg = resolveRef(t.clusters.header.bold.fg, t.ramps)!;
    expect(apcaLc(fg, bg)).toBeGreaterThanOrEqual(60);
  });
});
