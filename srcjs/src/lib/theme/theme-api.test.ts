import { expect, test, describe } from "bun:test";
import {
  themeCochrane, themeLancet, themeJama, themeDark,
  themeDwarven, themeElvish, themeHobbit,
  webTheme, resolveThemeRef,
} from "./theme-api";
import { hexToOklch, oklchToHex } from "../oklch";

describe("preset constructors", () => {
  test("all preset constructors resolve without throwing", () => {
    expect(() => themeCochrane()).not.toThrow();
    expect(() => themeLancet()).not.toThrow();
    expect(() => themeJama()).not.toThrow();
    expect(() => themeDark()).not.toThrow();
    expect(() => themeDwarven()).not.toThrow();
    expect(() => themeElvish()).not.toThrow();
    expect(() => themeHobbit()).not.toThrow();
  });

  test("cochrane has expected brand seed", () => {
    const t = themeCochrane();
    expect(t.authoringInputs && oklchToHex(t.authoringInputs.anchors.brand).toUpperCase()).toBe("#0099CC");
  });

  test("preset name is preserved", () => {
    expect(themeCochrane().name).toBe("cochrane");
    expect(themeLancet().name).toBe("lancet");
  });
});

describe("webTheme", () => {
  test("with no args returns a cochrane-shaped theme", () => {
    const t = webTheme();
    expect(t.name).toBe("custom");
  });

  test("brand anchor overlay seeds a new brand ramp", () => {
    const t = webTheme({ anchors: { brand: hexToOklch("#FF0000") } });
    // Brand hex round-trips via authoringInputs anchors.
    expect(t.authoringInputs && oklchToHex(t.authoringInputs.anchors.brand).toUpperCase()).toBe("#FF0000");
  });

  test("baseTheme inherits inputs not overridden", () => {
    const t = webTheme({
      baseTheme: "lancet",
      anchors: { brand: hexToOklch("#FF0000") },
    });
    // Brand hex round-trips via authoringInputs anchors.
    expect(t.authoringInputs && oklchToHex(t.authoringInputs.anchors.brand).toUpperCase()).toBe("#FF0000");
    expect(t.name).toBe("custom");
  });

  test("polarity dark applies", () => {
    const t = webTheme({
      anchors: { brand: hexToOklch("#1F3A5F") },
      polarity: "dark",
    });
    expect(t.name).toBe("custom");
  });
});

describe("resolveThemeRef", () => {
  test("string name resolves to a preset theme", () => {
    const t = resolveThemeRef("jama");
    expect(t.name).toBe("jama");
  });

  test("already-resolved theme passes through", () => {
    const t1 = themeCochrane();
    const t2 = resolveThemeRef(t1);
    expect(t2).toBe(t1);
  });

  test("extend + overrides applies on top of base", () => {
    const t = resolveThemeRef({
      extend: "cochrane",
      overrides: { anchors: { brand: hexToOklch("#FF0000") } },
    });
    // Brand hex round-trips via authoringInputs anchors.
    expect(t.authoringInputs && oklchToHex(t.authoringInputs.anchors.brand).toUpperCase()).toBe("#FF0000");
  });
});
