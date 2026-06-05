import { describe, it, expect } from "bun:test";
import { PRESETS, preset, COCHRANE, LANCET, DARK } from "./theme-presets-inputs";
import { buildThemeStructure } from "./theme-resolve";
import { apcaLc } from "../oklch";

describe("PRESETS — preset registry", () => {
  it("registers all 27 presets", () => {
    expect(Object.keys(PRESETS).length).toBe(27);
  });

  it("includes all expected names", () => {
    const expected = [
      "cochrane", "lancet", "jama", "nejm", "nature", "bmj", "dark",
      "bauhaus", "swiss", "tufte", "newsprint",
      "solarized", "solarized_dark", "tonal", "tonal_dark",
      "dwarven", "elvish", "hobbit",
      "synthwave", "brutalist", "atelier", "executive",
      "ledger", "terminal", "aurora", "blueprint", "sunprint",
    ];
    for (const name of expected) {
      expect(PRESETS).toHaveProperty(name);
    }
  });

  it("preset() returns cochrane for unknown name", () => {
    expect(preset("not_a_theme")).toBe(COCHRANE);
  });
});

describe("Preset structural correctness (V4 anchors)", () => {
  it("every preset has a valid brand anchor (OKLCH triple)", () => {
    for (const [name, inputs] of Object.entries(PRESETS)) {
      expect(typeof inputs.anchors.brand.L).toBe("number");
      expect(typeof inputs.anchors.brand.C).toBe("number");
      expect(typeof inputs.anchors.brand.H).toBe("number");
      void name;
    }
  });

  it("every preset has paper + ink anchors", () => {
    for (const [name, inputs] of Object.entries(PRESETS)) {
      expect(typeof inputs.anchors.paper.L).toBe("number");
      expect(typeof inputs.anchors.ink.L).toBe("number");
      void name;
    }
  });

  it("dark themes have polarity: dark", () => {
    expect(DARK.polarity).toBe("dark");
    expect(PRESETS.solarized_dark!.polarity).toBe("dark");
    expect(PRESETS.tonal_dark!.polarity).toBe("dark");
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

describe("V4 has no decorative anchor — Lancet's v3 gold folded into accent", () => {
  it("Lancet accent differs from brand", () => {
    // V3 had a separate decorative anchor for two-color themes; V4 folds
    // the second hue into accent (or threads it through neutrals via
    // neutralHueFrom for editorial paper themes like Newsprint/Hobbit).
    expect(LANCET.anchors.accent).toBeDefined();
    expect(LANCET.anchors.accent!.H).not.toBe(LANCET.anchors.brand.H);
  });

  it("buildThemeStructure no longer emits a `decorative` ramp", () => {
    const t = buildThemeStructure(COCHRANE, "cochrane");
    expect(t.ramps).not.toHaveProperty("decorative");
  });
});
