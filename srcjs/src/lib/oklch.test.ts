import { expect, test, describe } from "bun:test";
import {
  oklchLighten,
  oklchDarken,
  oklchMix,
  oklchChroma,
  contrastRatio,
  ensureContrast,
} from "./oklch";

describe("oklchLighten / oklchDarken", () => {
  test("lighten increases perceived brightness", () => {
    const lighter = oklchLighten("#888888", 0.2);
    expect(contrastRatio(lighter, "#000000")).toBeGreaterThan(
      contrastRatio("#888888", "#000000"),
    );
  });

  test("darken with positive amount darkens", () => {
    const darker = oklchDarken("#888888", 0.2);
    expect(contrastRatio(darker, "#FFFFFF")).toBeGreaterThan(
      contrastRatio("#888888", "#FFFFFF"),
    );
  });

  test("lighten and darken are symmetric", () => {
    expect(oklchLighten("#888888", -0.1)).toBe(oklchDarken("#888888", 0.1));
  });
});

describe("oklchMix", () => {
  test("t=0 returns approximately a", () => {
    expect(oklchMix("#FF0000", "#0000FF", 0).toLowerCase()).toBe("#ff0000");
  });
  test("t=1 returns approximately b", () => {
    expect(oklchMix("#FF0000", "#0000FF", 1).toLowerCase()).toBe("#0000ff");
  });
  test("achromatic-endpoint guard: cream + navy at t=0.4 doesn't land in green territory", () => {
    // From R-side comment: shortest-path through hue ~135° (green) was the
    // failure mode. Result should stay in blue/navy territory.
    const mid = oklchMix("#FDFCFB", "#002D54", 0.4);
    const { r, g, b } = (() => {
      const h = mid.replace("#", "");
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
      };
    })();
    // Blue channel should dominate; green should not exceed blue.
    expect(b).toBeGreaterThan(g);
  });
});

describe("oklchChroma", () => {
  test("desaturates toward gray", () => {
    const desaturated = oklchChroma("#FF0000", -0.2);
    // R channel still dominant but closer to G/B than pure red
    const h = desaturated.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    expect(r).toBeGreaterThan(g);
    expect(r - g).toBeLessThan(255);
  });
});

describe("contrastRatio", () => {
  test("white on black is 21:1", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 1);
  });
  test("same color is 1:1", () => {
    expect(contrastRatio("#888888", "#888888")).toBeCloseTo(1, 5);
  });
  test("order-independent", () => {
    expect(contrastRatio("#FF0000", "#00FF00")).toBeCloseTo(
      contrastRatio("#00FF00", "#FF0000"),
      5,
    );
  });
});

describe("ensureContrast", () => {
  test("returns fg unchanged when already passing", () => {
    expect(ensureContrast("#000000", "#FFFFFF", 4.5)).toBe("#000000");
  });
  test("darkens fg on light bg until passing", () => {
    const result = ensureContrast("#CCCCCC", "#FFFFFF", 4.5);
    expect(contrastRatio(result, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });
  test("lightens fg on dark bg until passing", () => {
    const result = ensureContrast("#333333", "#000000", 4.5);
    expect(contrastRatio(result, "#000000")).toBeGreaterThanOrEqual(4.5);
  });
  test("returns extreme when target unachievable", () => {
    // 21:1 (white-on-black) is the theoretical max; 22:1 is unachievable
    const result = ensureContrast("#FFFFFF", "#888888", 22);
    expect(["#000000", "#ffffff"]).toContain(result.toLowerCase());
  });
});
