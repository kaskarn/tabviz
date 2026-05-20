import { expect, test, describe } from "bun:test";
import { resolveTheme } from "./theme-resolve";
import presetsJson from "./theme-presets-v2.json";
import {
  COCHRANE_DRAFT, LANCET_DRAFT, JAMA_DRAFT, DARK_DRAFT,
  NEJM_DRAFT, NATURE_DRAFT, BMJ_DRAFT,
  BAUHAUS_DRAFT, SWISS_DRAFT, TUFTE_DRAFT, NEWSPRINT_DRAFT,
  SOLARIZED_DRAFT, SOLARIZED_DARK_DRAFT, TONAL_DRAFT, TONAL_DARK_DRAFT,
  DWARVEN_DRAFT, ELVISH_DRAFT, HOBBIT_DRAFT,
} from "./theme-presets-inputs";
import type { WebThemeV2 } from "../types/theme-v2";

const SNAPSHOTS = presetsJson as Record<string, WebThemeV2>;

describe("resolveTheme — smoke", () => {
  test("default inputs resolve without throwing", () => {
    const t = resolveTheme({
      inputs: { primary: "#0099CC", neutral: ["#FFFFFF", "#FFFFFF", "#F2F4F7", "#5B6470", "#1F2937"] },
    });
    expect(t.schemaVersion).toBe(2);
    expect(t.surface.base).toBeTruthy();
    expect(t.series.length).toBeGreaterThan(0);
  });

  test("validate:false skips contrast checks", () => {
    // Synthetic identity that would fail bold-band contrast: light primary, deep auto-derive
    const fn = () => resolveTheme(
      {
        inputs: { primary: "#FFFF00", primaryDeep: "#FFFFCC", neutral: ["#FFFFFF","#FFFFFF","#F2F4F7","#5B6470","#1F2937"] },
      },
      { validate: false },
    );
    expect(fn).not.toThrow();
  });
});

describe("resolveTheme — drift detection vs canonical snapshot", () => {
  // Since the snapshot is regenerated from this very resolver via
  // `scripts/regenerate-theme-presets.ts`, drift detection is byte-exact:
  // any change to oklch math, the resolver, or preset inputs that affects
  // output will fail these tests until the snapshot is intentionally
  // regenerated. That's the contract — preset output is stable wire-format.
  const cases: Array<[string, typeof COCHRANE_DRAFT]> = [
    ["cochrane",       COCHRANE_DRAFT],
    ["lancet",         LANCET_DRAFT],
    ["jama",           JAMA_DRAFT],
    ["nejm",           NEJM_DRAFT],
    ["nature",         NATURE_DRAFT],
    ["bmj",            BMJ_DRAFT],
    ["dark",           DARK_DRAFT],
    ["bauhaus",        BAUHAUS_DRAFT],
    ["swiss",          SWISS_DRAFT],
    ["tufte",          TUFTE_DRAFT],
    ["newsprint",      NEWSPRINT_DRAFT],
    ["solarized",      SOLARIZED_DRAFT],
    ["solarized_dark", SOLARIZED_DARK_DRAFT],
    ["tonal",          TONAL_DRAFT],
    ["tonal_dark",     TONAL_DARK_DRAFT],
    ["dwarven",        DWARVEN_DRAFT],
    ["elvish",         ELVISH_DRAFT],
    ["hobbit",         HOBBIT_DRAFT],
  ];

  for (const [name, draft] of cases) {
    test(`${name}: TS-resolved output matches snapshot byte-for-byte`, () => {
      const resolved = resolveTheme(draft);
      expect(resolved).toEqual(SNAPSHOTS[name]);
    });
  }
});
