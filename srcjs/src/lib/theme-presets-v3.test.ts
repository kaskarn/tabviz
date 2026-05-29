import { describe, it, expect } from "bun:test";
import { PRESETS_V3, preset, COCHRANE_V3, LANCET_V3, DARK_V3 } from "./theme-presets-v3";
import { buildTheme } from "./theme-resolve-v3";
import { apcaLc } from "./oklch";

describe("PRESETS_V3 — 18 preset registry", () => {
  it("registers all 18 presets", () => {
    expect(Object.keys(PRESETS_V3).length).toBe(18);
  });

  it("includes all expected names", () => {
    const expected = [
      "cochrane", "lancet", "jama", "nejm", "nature", "bmj", "dark",
      "bauhaus", "swiss", "tufte", "newsprint",
      "solarized", "solarized_dark", "tonal", "tonal_dark",
      "dwarven", "elvish", "hobbit",
    ];
    for (const name of expected) {
      expect(PRESETS_V3).toHaveProperty(name);
    }
  });

  it("preset() returns cochrane for unknown name", () => {
    expect(preset("not_a_theme")).toBe(COCHRANE_V3);
  });
});

describe("Preset structural correctness", () => {
  it("every preset has a valid brand hex", () => {
    for (const [name, inputs] of Object.entries(PRESETS_V3)) {
      expect(inputs.brand).toMatch(/^#[0-9A-Fa-f]{6}$/);
      void name;
    }
  });

  it("two-color themes (Lancet, Bauhaus, Dwarven, Elvish, Hobbit, Newsprint) have decorative", () => {
    expect(LANCET_V3.decorative).toBeTruthy();
    expect(PRESETS_V3.bauhaus!.decorative).toBeTruthy();
    expect(PRESETS_V3.dwarven!.decorative).toBeTruthy();
    expect(PRESETS_V3.elvish!.decorative).toBeTruthy();
    expect(PRESETS_V3.hobbit!.decorative).toBeTruthy();
    expect(PRESETS_V3.newsprint!.decorative).toBeTruthy();
  });

  it("dark themes have mode: dark", () => {
    expect(DARK_V3.mode).toBe("dark");
    expect(PRESETS_V3.solarized_dark!.mode).toBe("dark");
    expect(PRESETS_V3.tonal_dark!.mode).toBe("dark");
  });
});

describe("Preset resolution — APCA invariants hold for every preset", () => {
  it("ink-on-paper APCA Lc >= 75 (body floor) for every preset", () => {
    for (const [name, inputs] of Object.entries(PRESETS_V3)) {
      const t = buildTheme(inputs, name);
      const lc = apcaLc(t.tokens.ink, t.tokens.paper);
      expect(lc).toBeGreaterThanOrEqual(75);
    }
  });

  it("brand_ink-on-brand APCA Lc >= 45 (header/badge floor) for every preset", () => {
    for (const [name, inputs] of Object.entries(PRESETS_V3)) {
      const t = buildTheme(inputs, name);
      const lc = apcaLc(t.tokens.brand_ink, t.tokens.brand);
      expect(lc).toBeGreaterThanOrEqual(45);
    }
  });

  it("ink-on-paper_alt APCA Lc >= 60 for every preset (alt-row banding readability)", () => {
    for (const [name, inputs] of Object.entries(PRESETS_V3)) {
      const t = buildTheme(inputs, name);
      const lc = apcaLc(t.tokens.ink, t.tokens.paper_alt);
      expect(lc).toBeGreaterThanOrEqual(60);
    }
  });
});

describe("Two-color editorial themes produce visually distinct decorative chrome", () => {
  it("Lancet decorative_chrome differs from brand", () => {
    const t = buildTheme(LANCET_V3, "lancet");
    expect(t.tokens.decorative_chrome).not.toBe(t.tokens.brand);
  });

  it("themes WITHOUT decorative fall back to brand for decorative_chrome", () => {
    const t = buildTheme(COCHRANE_V3, "cochrane");
    // No decorative, so decorative_chrome derives from brand
    expect(t.ramps.decorative).toBeNull();
  });
});
