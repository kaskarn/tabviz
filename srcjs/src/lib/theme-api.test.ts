import { expect, test, describe } from "bun:test";
import {
  themeCochrane, themeLancet, themeJama, themeDark,
  themeDwarven, themeElvish, themeHobbit,
  webTheme, setInputs, setVariants, setSpacing, setThemeField,
  resolveThemeRef,
} from "./theme-api";

describe("preset constructors", () => {
  test("all 7 presets resolve without throwing", () => {
    expect(() => themeCochrane()).not.toThrow();
    expect(() => themeLancet()).not.toThrow();
    expect(() => themeJama()).not.toThrow();
    expect(() => themeDark()).not.toThrow();
    expect(() => themeDwarven()).not.toThrow();
    expect(() => themeElvish()).not.toThrow();
    expect(() => themeHobbit()).not.toThrow();
  });

  test("cochrane has expected primary", () => {
    expect(themeCochrane().inputs.primary).toBe("#0099CC");
  });

  test("lancet pins primaryDeep (not auto-derived)", () => {
    expect(themeLancet().inputs.primaryDeep).toBe("#002D54");
  });
});

describe("webTheme", () => {
  test("no args returns base preset", () => {
    const t = webTheme();
    expect(t.inputs.primary).toBe("#0099CC");
  });

  test("inputs override propagates", () => {
    const t = webTheme({ inputs: { primary: "#FF0000" } });
    expect(t.inputs.primary).toBe("#FF0000");
    // primaryDeep should auto-derive (since not pinned)
    expect(t.inputs.primaryDeep).not.toBe(null);
  });

  test("base_theme switches preset", () => {
    const t = webTheme({ baseTheme: "lancet", inputs: { primary: "#FF0000" } });
    expect(t.inputs.primary).toBe("#FF0000");
    // Lancet inherits cream neutrals
    expect(t.inputs.neutral[0]).toBe("#FDFCFB");
  });
});

describe("setInputs", () => {
  test("changing primary resets primaryDeep + secondary cascade", () => {
    const t1 = themeCochrane();
    const t2 = setInputs(t1, { primary: "#FF0000" });
    expect(t2.inputs.primary).toBe("#FF0000");
    // primaryDeep should be re-derived (different from t1's)
    expect(t2.inputs.primaryDeep).not.toBe(t1.inputs.primaryDeep);
  });

  test("seriesAnchors change rebuilds series slot bundles", () => {
    const t1 = themeCochrane();
    const t2 = setInputs(t1, { seriesAnchors: ["#FF0000", "#00FF00", "#0000FF"] });
    expect(t2.series.length).toBe(3);
    expect(t2.series[0].fill).toBe("#FF0000");
  });
});

describe("setVariants", () => {
  test("density change updates spacing", () => {
    const t1 = themeCochrane();
    const t2 = setVariants(t1, { density: "compact" });
    expect(t2.spacing.rowHeight).toBe(20); // compact preset
    expect(t1.spacing.rowHeight).toBe(24); // comfortable
  });
});

describe("setSpacing", () => {
  test("token override persists", () => {
    const t = setSpacing(themeCochrane(), { rowHeight: 40 });
    expect(t.spacing.rowHeight).toBe(40);
  });
});

describe("setThemeField", () => {
  test("dot-path override on a Tier 3 cluster", () => {
    const t = setThemeField(themeCochrane(), "rowGroup.L1.bg", "#EEEEEE");
    expect(t.rowGroup.L1.bg).toBe("#EEEEEE");
  });

  test("numeric segment indexes into list", () => {
    const t = setThemeField(themeCochrane(), "series.0.fill", "#FF0000");
    expect(t.series[0].fill).toBe("#FF0000");
  });
});

describe("resolveThemeRef", () => {
  test("string name resolves to preset", () => {
    expect(resolveThemeRef("lancet").name).toBe("lancet");
  });

  test("extend object resolves with overrides", () => {
    const t = resolveThemeRef({ extend: "lancet", variants: { density: "compact" } });
    expect(t.name).toBe("lancet");
    expect(t.spacing.rowHeight).toBe(20); // compact density
  });

  test("already-resolved theme passes through", () => {
    const t1 = themeJama();
    const t2 = resolveThemeRef(t1);
    expect(t2).toBe(t1);
  });
});
