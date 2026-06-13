import { describe, it, expect } from "bun:test";
import { estimateTextWidth, isMonospaceFamily } from "./width-utils";
import { PROP_FONTS, MONO_ADVANCE_BY_FONT } from "./font-metrics.generated";

// The estimator reads REAL measured per-font advance tables
// (font-metrics.generated.ts) and interpolates per glyph across the weight
// axis. These tests pin that contract — the empirical replacement for the
// former hand-tuned character-class magic numbers (WYSIWYG D8 work).

describe("estimateTextWidth — empirical per-font advances", () => {
  it("resolves the primary family to its own measured table", () => {
    // Lora (serif) and Helvetica (sans) have genuinely different advances;
    // the same text must measure differently per face.
    const lora = estimateTextWidth("Hydrochlorothiazide", 14, 400, "'Lora', Georgia, serif");
    const helv = estimateTextWidth("Hydrochlorothiazide", 14, 400, "Helvetica, Arial, sans-serif");
    expect(lora).toBeGreaterThan(0);
    expect(helv).toBeGreaterThan(0);
    expect(lora).not.toBeCloseTo(helv, 0); // different faces, different widths
  });

  it("sums real glyph advances (not a flat per-char constant)", () => {
    // 'i' is far narrower than 'm' — a constant-width model would make
    // "iiii" and "mmmm" equal; real advances make them very different.
    const narrow = estimateTextWidth("iiii", 14, 400, "'Lora', serif");
    const wide = estimateTextWidth("mmmm", 14, 400, "'Lora', serif");
    expect(wide).toBeGreaterThan(narrow * 2);
  });

  it("interpolates weight per glyph (bold ≥ regular)", () => {
    const reg = estimateTextWidth("Treatment", 14, 400, "'Outfit', sans-serif");
    const bold = estimateTextWidth("Treatment", 14, 700, "'Outfit', sans-serif");
    expect(bold).toBeGreaterThanOrEqual(reg);
    // a mid weight lands between the two anchors
    const mid = estimateTextWidth("Treatment", 14, 550, "'Outfit', sans-serif");
    expect(mid).toBeGreaterThanOrEqual(reg);
    expect(mid).toBeLessThanOrEqual(bold);
  });

  it("monospace = a true fixed per-font advance (weight-independent)", () => {
    const fam = "'Space Mono', monospace";
    expect(isMonospaceFamily(fam)).toBe(true);
    const reg = estimateTextWidth("0000", 14, 400, fam);
    const bold = estimateTextWidth("0000", 14, 700, fam);
    expect(reg).toBeCloseTo(bold, 5); // mono bold has the same advance
    // every glyph shares one advance: "0000" === "iiii" width in mono
    expect(estimateTextWidth("iiii", 14, 400, fam)).toBeCloseTo(reg, 5);
  });

  it("unknown family falls back to the serif/sans class table", () => {
    const customSerif = estimateTextWidth("abc", 14, 400, "'Totally Unknown Face', serif");
    const customSans = estimateTextWidth("abc", 14, 400, "'Totally Unknown Face', sans-serif");
    expect(customSerif).toBeGreaterThan(0);
    expect(customSans).toBeGreaterThan(0);
  });

  it("the generated tables actually shipped the preset faces", () => {
    for (const f of ["Lora", "Spectral", "EB Garamond", "Outfit", "Archivo"]) {
      expect(PROP_FONTS[f]).toBeDefined();
    }
    for (const f of ["Space Mono", "JetBrains Mono"]) {
      expect(MONO_ADVANCE_BY_FONT[f]).toBeGreaterThan(0);
    }
  });
});
