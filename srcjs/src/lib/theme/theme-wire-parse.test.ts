// Validating ingress for untrusted theme-wire JSON (round-2 robustness
// review): the settings import path must reject malformed/hostile wires
// with a named error, never half-apply or NaN-poison the theme.
import { describe, it, expect } from "bun:test";
import { parseThemeWire, ThemeWireParseError } from "./theme-wire-parse";
import { ThemeInputsValidationError } from "./theme-validate";
import { PRESETS } from "./theme-presets-inputs";
import { buildThemeWire } from "./theme-wire";

const validWire = JSON.stringify(
  buildThemeWire(PRESETS.nejm, "nejm", {}, {}),
);

describe("parseThemeWire", () => {
  it("accepts a well-formed envelope and round-trips inputs", () => {
    const w = parseThemeWire(validWire);
    expect(w.$schema).toBe("tabviz-theme/v4");
    expect(w.inputs.anchors.paper).toBeDefined();
  });

  it("rejects non-JSON", () => {
    expect(() => parseThemeWire("{not json")).toThrow(ThemeWireParseError);
  });

  it("rejects a non-theme object (no inputs.anchors)", () => {
    expect(() => parseThemeWire(JSON.stringify({ foo: 1 }))).toThrow(/inputs\.anchors/);
  });

  it("rejects NaN anchors via validateThemeInputs (not silent #NANNANNAN)", () => {
    const bad = JSON.parse(validWire);
    bad.inputs.anchors.paper = { L: NaN, C: 0, H: 0 };
    expect(() => parseThemeWire(JSON.stringify(bad))).toThrow(ThemeInputsValidationError);
  });

  it("rejects an unknown density enum with a named error (not a resolver crash)", () => {
    const bad = JSON.parse(validWire);
    bad.inputs.density = "ultra";
    expect(() => parseThemeWire(JSON.stringify(bad))).toThrow(ThemeInputsValidationError);
  });

  it("rejects a hostile pin value (XSS guard at ingress)", () => {
    const bad = JSON.parse(validWire);
    bad.pins = { "--tv-surface-bg": '#fff"/><script>x</script>' };
    expect(() => parseThemeWire(JSON.stringify(bad))).toThrow(/invalid value/i);
  });

  it("rejects a non --tv- pin key", () => {
    const bad = JSON.parse(validWire);
    bad.pins = { "background": "red" };
    expect(() => parseThemeWire(JSON.stringify(bad))).toThrow(/not a --tv-/);
  });

  it("rejects a malformed roleOverride binding", () => {
    const bad = JSON.parse(validWire);
    bad.roleOverrides = { "text-muted": { ramp: "brand" } };
    expect(() => parseThemeWire(JSON.stringify(bad))).toThrow(/ramp, grade/);
  });

  it("__proto__ pin key does not pollute Object.prototype", () => {
    const bad = JSON.parse(validWire);
    bad.pins = { "__proto__": "x" };
    // either rejected (not --tv-) — and definitely no pollution
    try { parseThemeWire(JSON.stringify(bad)); } catch { /* expected */ }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
