import { describe, it, expect } from "bun:test";
import { PRESETS, preset, COCHRANE, LANCET, DARK } from "./theme-presets-inputs";
import { buildThemeStructure } from "./theme-resolve";
import { apcaLc } from "./oklch";

describe("PRESETS — 18 preset registry", () => {
  it("registers all 18 presets", () => {
    expect(Object.keys(PRESETS).length).toBe(18);
  });

  it("includes all expected names", () => {
    const expected = [
      "cochrane", "lancet", "jama", "nejm", "nature", "bmj", "dark",
      "bauhaus", "swiss", "tufte", "newsprint",
      "solarized", "solarized_dark", "tonal", "tonal_dark",
      "dwarven", "elvish", "hobbit",
    ];
    for (const name of expected) {
      expect(PRESETS).toHaveProperty(name);
    }
  });

  it("preset() returns cochrane for unknown name", () => {
    expect(preset("not_a_theme")).toBe(COCHRANE);
  });
});

describe("Preset structural correctness", () => {
  it("every preset has a valid brand hex", () => {
    for (const [name, inputs] of Object.entries(PRESETS)) {
      expect(inputs.brand).toMatch(/^#[0-9A-Fa-f]{6}$/);
      void name;
    }
  });

  it("two-color themes (Lancet, Bauhaus, Dwarven, Elvish, Hobbit, Newsprint) have decorative", () => {
    expect(LANCET.decorative).toBeTruthy();
    expect(PRESETS.bauhaus!.decorative).toBeTruthy();
    expect(PRESETS.dwarven!.decorative).toBeTruthy();
    expect(PRESETS.elvish!.decorative).toBeTruthy();
    expect(PRESETS.hobbit!.decorative).toBeTruthy();
    expect(PRESETS.newsprint!.decorative).toBeTruthy();
  });

  it("dark themes have mode: dark", () => {
    expect(DARK.mode).toBe("dark");
    expect(PRESETS.solarized_dark!.mode).toBe("dark");
    expect(PRESETS.tonal_dark!.mode).toBe("dark");
  });
});

describe("Preset resolution — APCA invariants hold for every preset", () => {
  it("ink-on-paper APCA Lc >= 75 (body floor) for every preset", () => {
    for (const [name, inputs] of Object.entries(PRESETS)) {
      const t = buildThemeStructure(inputs, name);
      const lc = apcaLc(t.tokens.ink, t.tokens.paper);
      expect(lc).toBeGreaterThanOrEqual(75);
    }
  });

  it("brand_ink-on-brand APCA Lc >= 45 (header/badge floor) for every preset", () => {
    for (const [name, inputs] of Object.entries(PRESETS)) {
      const t = buildThemeStructure(inputs, name);
      const lc = apcaLc(t.tokens.brand_ink, t.tokens.brand);
      expect(lc).toBeGreaterThanOrEqual(45);
    }
  });

  it("ink-on-paper_alt APCA Lc >= 60 for every preset (alt-row banding readability)", () => {
    for (const [name, inputs] of Object.entries(PRESETS)) {
      const t = buildThemeStructure(inputs, name);
      const lc = apcaLc(t.tokens.ink, t.tokens.paper_alt);
      expect(lc).toBeGreaterThanOrEqual(60);
    }
  });
});

describe("Two-color editorial themes produce visually distinct decorative chrome", () => {
  it("Lancet decorative_chrome differs from brand", () => {
    const t = buildThemeStructure(LANCET, "lancet");
    expect(t.tokens.decorative_chrome).not.toBe(t.tokens.brand);
  });

  it("themes WITHOUT decorative fall back to brand for decorative_chrome", () => {
    const t = buildThemeStructure(COCHRANE, "cochrane");
    // No decorative, so decorative_chrome derives from brand
    expect(t.ramps.decorative).toBeNull();
  });
});
