import { describe, it, expect } from "bun:test";
import {
  resolveCategorical, resolveSequential, resolveDiverging,
  resolveSeriesColor, sampleScheme,
  OKABE_ITO, TABLEAU_10, SET2, CATEGORICAL_SCHEMES,
  SEQUENTIAL_SCHEMES, DIVERGING_SCHEMES,
} from "./data-schemes";
import { buildRamps } from "./theme-resolve";
import type { ThemeInputs } from "../types/theme-inputs";

const COCHRANE: ThemeInputs = { brand: "#0099CC", accent: "#C8553D" };

describe("categorical schemes — fixed palettes", () => {
  it("Okabe-Ito has 8 colors", () => {
    expect(OKABE_ITO.length).toBe(8);
    expect(OKABE_ITO[0]).toBe("#000000");
  });

  it("Tableau 10 has 10 colors", () => {
    expect(TABLEAU_10.length).toBe(10);
  });

  it("Set2 has 8 colors", () => {
    expect(SET2.length).toBe(8);
  });

  it("all registered schemes are non-empty arrays of hex", () => {
    for (const [name, scheme] of Object.entries(CATEGORICAL_SCHEMES)) {
      expect(scheme.length).toBeGreaterThan(0);
      for (const c of scheme) {
        expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
        void name;
      }
    }
  });
});

describe("resolveCategorical", () => {
  it("returns Okabe-Ito by name", () => {
    expect(resolveCategorical("okabe_ito")).toEqual(OKABE_ITO);
  });

  it("unknown scheme falls back to Okabe-Ito", () => {
    expect(resolveCategorical("rainbow")).toEqual(OKABE_ITO);
  });

  it("brand_mono derives from brand ramp", () => {
    const r = buildRamps(COCHRANE);
    const scheme = resolveCategorical("brand_mono", r);
    expect(scheme.length).toBe(5);
    // All steps should be from the brand ramp
    for (const c of scheme) {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("brand_mono without ramps falls back to Okabe-Ito", () => {
    expect(resolveCategorical("brand_mono")).toEqual(OKABE_ITO);
  });
});

describe("resolveSequential / resolveDiverging — stop arrays", () => {
  it("viridis is the sequential default", () => {
    const scheme = resolveSequential("viridis");
    expect(scheme.length).toBe(9);
    for (const c of scheme) expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("unknown sequential falls back to viridis", () => {
    expect(resolveSequential("unknown")).toEqual(resolveSequential("viridis"));
  });

  it("rdbu is the diverging default", () => {
    expect(resolveDiverging("rdbu").length).toBe(9);
  });

  it("all registered sequential / diverging schemes are non-empty hex arrays", () => {
    for (const scheme of Object.values(SEQUENTIAL_SCHEMES)) {
      expect(scheme.length).toBe(9);
      for (const c of scheme) expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
    for (const scheme of Object.values(DIVERGING_SCHEMES)) {
      expect(scheme.length).toBe(9);
      for (const c of scheme) expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe("sampleScheme — linear interpolation", () => {
  it("returns endpoints at t=0 and t=1", () => {
    const v = resolveSequential("viridis");
    expect(sampleScheme(v, 0)).toBe(v[0]!);
    expect(sampleScheme(v, 1)).toBe(v[v.length - 1]!);
  });

  it("returns midpoint at t=0.5 (exact stop for 9-step)", () => {
    const v = resolveSequential("viridis");
    expect(sampleScheme(v, 0.5)).toBe(v[4]!);
  });

  it("interpolates between stops", () => {
    const v = resolveSequential("viridis");
    const between = sampleScheme(v, 0.0625);
    expect(between).toMatch(/^#[0-9A-Fa-f]{6}$/);
    // Should differ from both stop 0 and stop 1
    expect(between).not.toBe(v[0]!);
    expect(between).not.toBe(v[1]!);
  });

  it("clamps out-of-range", () => {
    const v = resolveSequential("viridis");
    expect(sampleScheme(v, -1)).toBe(v[0]!);
    expect(sampleScheme(v, 2)).toBe(v[v.length - 1]!);
  });
});

describe("resolveSeriesColor — anchors + scheme", () => {
  it("uses series_anchors[N] when set", () => {
    expect(resolveSeriesColor(0, "okabe_ito", ["#FF0000", null, null])).toBe("#FF0000");
    expect(resolveSeriesColor(2, "okabe_ito", [null, null, "#00FF00"])).toBe("#00FF00");
  });

  it("falls through to categorical scheme when anchor is null", () => {
    expect(resolveSeriesColor(1, "okabe_ito", [null, null, null])).toBe(OKABE_ITO[1]!);
  });

  it("falls through to categorical scheme when no anchors", () => {
    expect(resolveSeriesColor(0, "okabe_ito", undefined)).toBe(OKABE_ITO[0]!);
  });

  it("wraps around scheme length", () => {
    expect(resolveSeriesColor(8, "okabe_ito", undefined)).toBe(OKABE_ITO[0]!);
    expect(resolveSeriesColor(9, "okabe_ito", undefined)).toBe(OKABE_ITO[1]!);
  });

  it("decoupled from brand: changing brand input doesn't change categorical pick", () => {
    const cochrane = resolveSeriesColor(2, "okabe_ito", undefined);
    const lancet = resolveSeriesColor(2, "okabe_ito", undefined);
    expect(cochrane).toBe(lancet); // brand-independent
  });
});
