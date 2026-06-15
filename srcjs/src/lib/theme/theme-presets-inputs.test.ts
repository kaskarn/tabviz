import { describe, it, expect } from "bun:test";
import { PRESETS, preset, NEJM, LEDGER } from "./theme-presets-inputs";
import { buildThemeStructure } from "./theme-resolve";
import { apcaLc } from "../oklch";

describe("PRESETS — preset registry (27→9 cull, locked 2026-06-09)", () => {
  // The committed identity set. Each owns a distinct axis (rgc_v4 model).
  const COMMITTED = [
    "nejm", "ledger", "brutalist", "aurora", "terminal",
    "newsprint", "blueprint", "synthwave", "dwarven",
  ];

  it("registers exactly the 9 committed presets", () => {
    expect(Object.keys(PRESETS).sort()).toEqual([...COMMITTED].sort());
  });

  it("includes every committed name and NONE of the deleted ones", () => {
    for (const name of COMMITTED) expect(PRESETS).toHaveProperty(name);
    for (const dead of ["cochrane", "lancet", "jama", "nature", "bmj", "dark",
      "swiss", "bauhaus", "tufte", "solarized", "tonal", "elvish", "hobbit",
      "atelier", "executive", "sunprint"]) {
      expect(PRESETS).not.toHaveProperty(dead);
    }
  });

  it("preset() returns nejm (the default) for an unknown name", () => {
    expect(preset("not_a_theme")).toBe(NEJM);
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

  it("dark-polarity survivors carry polarity: dark", () => {
    expect(PRESETS.aurora!.polarity).toBe("dark");
    expect(PRESETS.terminal!.polarity).toBe("dark");
    expect(PRESETS.synthwave!.polarity).toBe("dark");
  });

  // Maintainer directives (2026-06-15): no shipped preset draws an OUTER
  // table border (frame/boxed read as too thick/unsightly — only the default
  // hairline/ruled horizontal-rule treatments), and no preset opts into the
  // `first_column_style: "bold"` variant (its boxed-divider rendering is buggy
  // and it's an author-only opt-in). These lock the directives so a future
  // preset can't silently reintroduce either.
  it("no preset uses an outer-border border_preset (frame/boxed)", () => {
    for (const [name, inputs] of Object.entries(PRESETS)) {
      // undefined (the hairline default) is fine — only frame/boxed draw an outer table border.
      expect(["frame", "boxed"], `preset "${name}" must not draw an outer border`)
        .not.toContain(inputs.border_preset);
    }
  });

  it("no preset opts into the bold first-column variant", () => {
    for (const [name, inputs] of Object.entries(PRESETS)) {
      expect(inputs.first_column_style ?? "default", `preset "${name}" first_column_style`)
        .toBe("default");
    }
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

describe("V4 has no decorative anchor — a two-color theme's 2nd hue folds into accent", () => {
  it("a two-color preset's accent differs from brand (Ledger: teal + oxblood)", () => {
    // V3 had a separate decorative anchor for two-color themes; V4 folds
    // the second hue into accent (or threads it through neutrals via
    // neutralHueFrom for editorial paper themes like Newsprint).
    expect(LEDGER.anchors.accent).toBeDefined();
    expect(LEDGER.anchors.accent!.H).not.toBe(LEDGER.anchors.brand.H);
  });

  it("buildThemeStructure no longer emits a `decorative` ramp", () => {
    const t = buildThemeStructure(NEJM, "nejm");
    expect(t.ramps).not.toHaveProperty("decorative");
  });
});
