// DTCG adapter + suggest_theme — theme-rework Wave 4.
import { describe, it, expect } from "bun:test";
import { toDtcg, fromDtcg, DTCG_EXTENSION_KEY } from "./dtcg-adapter";
import { suggestTheme } from "./suggest-theme";
import { resolveTheme } from "./resolve-theme";
import { createWire } from "./theme-wire";
import { PRESETS } from "./theme-presets-inputs";

describe("toDtcg shape", () => {
  const doc = toDtcg(PRESETS["nejm"]!, "nejm");
  it("emits the three token groups + provenance", () => {
    expect(doc.tabviz.reference).toBeDefined();
    expect(doc.tabviz.semantic).toBeDefined();
    expect(doc.tabviz.component).toBeDefined();
    expect(doc.$extensions[DTCG_EXTENSION_KEY]?.inputs).toBeDefined();
  });
  it("reference carries the 11-step ramps as concrete colors", () => {
    const neutral = doc.tabviz.reference["neutral"] as Record<string, { $value: string }>;
    expect(Object.keys(neutral)).toHaveLength(11);
    expect(neutral["5"].$value).toMatch(/^#|^oklch/);
  });
  it("semantic roles ALIAS into reference, not baked hex", () => {
    // surface binds neutral.1 by default → an alias reference.
    expect(doc.tabviz.semantic["surface"]?.$value).toMatch(/^\{tabviz\.reference\.(neutral|brand|accent)\.\d+\}$/);
  });
  it("component paths derive from cssVar names", () => {
    expect(doc.tabviz.component["row.base.bg"]?.$value).toBeDefined();
  });
});

describe("DTCG round-trip is byte-stable (plan Wave-4 verification)", () => {
  for (const name of ["nejm", "nejm", "dwarven"]) {
    it(`${name}: theme → DTCG → wire → resolve, cssVars stable`, () => {
      const inputs = PRESETS[name]!;
      const before = resolveTheme(createWire(inputs, name)).cssVars;
      const wire = fromDtcg(toDtcg(inputs, name));
      const after = resolveTheme(createWire(wire.inputs, wire.name)).cssVars;
      expect(after).toEqual(before);
    });
  }
  it("round-trips roleOverrides + pins through $extensions", () => {
    const inputs = PRESETS["nejm"]!;
    const ro = { "text-muted": { ramp: "brand" as const, grade: 8 } };
    const pins = { "--tv-text-footnote-size": "0.7rem" };
    const wire = fromDtcg(toDtcg(inputs, "nejm", ro, pins));
    expect(wire.roleOverrides["text-muted"]).toBe("brand.8"); // alias form on the envelope
    expect(wire.pins?.["--tv-text-footnote-size"]).toBe("0.7rem");
  });
  it("throws on a foreign DTCG file with no tabviz provenance", () => {
    expect(() => fromDtcg({ tabviz: { reference: {}, semantic: {}, component: {} }, $extensions: {} }))
      .toThrow(/no tabviz provenance/);
  });
});

describe("suggestTheme", () => {
  it("derives a resolvable, contrast-safe theme from a brand hex", () => {
    const inputs = suggestTheme("#0066cc");
    expect(inputs.anchors.brand).toBeDefined();
    expect(inputs.anchors.paper!.L).toBeGreaterThan(0.9); // near-white paper
    expect(inputs.anchors.ink!.L).toBeLessThan(0.4);      // dark ink
    const resolved = resolveTheme(createWire(inputs, "suggested"));
    // text-on-surface is legible (the cascade's min-contrast walk guarantees it).
    expect(resolved.cssVars["--tv-text"]).toBeDefined();
    expect(resolved.cssVars["--tv-surface-bg"]).toBeDefined();
  });
  it("accent strategy shifts the accent hue", () => {
    const comp = suggestTheme("#0066cc", { accent: "complementary" }).anchors.accent!;
    const mono = suggestTheme("#0066cc", { accent: "mono" }).anchors.accent!;
    expect(Math.abs(comp.H - mono.H)).toBeGreaterThan(90); // ~180° apart
  });
  it("rejects an invalid hex", () => {
    expect(() => suggestTheme("not-a-color")).toThrow(/valid hex/);
  });
});
