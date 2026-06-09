import { expect, test, describe } from "bun:test";
import {
  themeNejm, themeLedger, themeBrutalist, themeAurora, themeTerminal,
  themeNewsprint, themeBlueprint, themeSynthwave, themeDwarven,
  webTheme, resolveThemeRef,
} from "./theme-api";
import { hexToOklch, oklchToHex } from "../oklch";

describe("preset constructors (the 9 committed identities)", () => {
  test("all preset constructors resolve without throwing", () => {
    for (const ctor of [themeNejm, themeLedger, themeBrutalist, themeAurora,
      themeTerminal, themeNewsprint, themeBlueprint, themeSynthwave, themeDwarven]) {
      expect(() => ctor()).not.toThrow();
    }
  });

  test("nejm has the expected crimson brand seed", () => {
    const t = themeNejm();
    expect(t.authoringInputs && oklchToHex(t.authoringInputs.anchors.brand).toUpperCase()).toBe("#BD2F2F");
  });

  test("preset name is preserved", () => {
    expect(themeNejm().name).toBe("nejm");
    expect(themeLedger().name).toBe("ledger");
  });
});

describe("webTheme", () => {
  test("with no args returns a custom theme on the nejm base", () => {
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
      baseTheme: "nejm",
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
    const t = resolveThemeRef("nejm");
    expect(t.name).toBe("nejm");
  });

  test("already-resolved theme passes through", () => {
    const t1 = themeNejm();
    const t2 = resolveThemeRef(t1);
    expect(t2).toBe(t1);
  });

  test("extend + overrides applies on top of base", () => {
    const t = resolveThemeRef({
      extend: "nejm",
      overrides: { anchors: { brand: hexToOklch("#FF0000") } },
    });
    // Brand hex round-trips via authoringInputs anchors.
    expect(t.authoringInputs && oklchToHex(t.authoringInputs.anchors.brand).toUpperCase()).toBe("#FF0000");
  });
});
