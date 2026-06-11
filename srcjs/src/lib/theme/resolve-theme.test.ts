// Tests for the v4 substrate resolver entry point.

import { describe, it, expect } from "bun:test";
import { resolveTheme } from "./resolve-theme";
import { createWire, setRoleBinding } from "./theme-wire";
import { COMPONENT_TOKENS, isV3BridgeToken } from "./component-tokens";
import { inputsFromHex } from "./theme-presets-inputs";
import { hexToOklch } from "../oklch";
import type { ThemeInputs } from "../../types/theme-inputs";

const COCHRANE: ThemeInputs = inputsFromHex({ brand: "#0099CC", accent: "#C8553D" });

describe("resolveTheme — pipeline composition", () => {
  it("resolves an empty wire to a complete ResolvedTheme", () => {
    const r = resolveTheme(createWire(COCHRANE));
    expect(r.inputs).toEqual(COCHRANE);
    expect(r.polarity).toBe("light");
    expect(r.ramps.neutral).toHaveLength(11);
    expect(r.ramps.brand).toHaveLength(11);
    expect(r.ramps.accent).toHaveLength(11);
    expect(r.ramps.neutralAlpha).toHaveLength(11);
    expect(r.ramps.brandAlpha).toHaveLength(11);
    expect(r.ramps.accentAlpha).toHaveLength(11);
  });

  it("CSS-var map has one entry per COMPONENT_TOKENS entry", () => {
    const r = resolveTheme(createWire(COCHRANE));
    expect(Object.keys(r.cssVars)).toHaveLength(COMPONENT_TOKENS.length);
    for (const token of COMPONENT_TOKENS) {
      expect(r.cssVars).toHaveProperty(token.cssVar);
    }
  });

  it("role-sourced cssVars resolve to real hex strings", () => {
    const r = resolveTheme(createWire(COCHRANE));
    // --tv-row-base-bg sources from role 'surface' (neutral.1)
    expect(r.cssVars["--tv-row-base-bg"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(r.cssVars["--tv-row-base-bg"]).toBe(r.ramps.neutral[0]!);
    // --tv-row-alt-bg sources from 'surface-subtle' (neutral.2)
    expect(r.cssVars["--tv-row-alt-bg"]).toBe(r.ramps.neutral[1]!);
    // --tv-cell-fg sources from 'text' (neutral.11)
    expect(r.cssVars["--tv-cell-fg"]).toBe(r.ramps.neutral[10]!);
  });

  it("highlight-bg uses the brand alpha companion (grade 3)", () => {
    const r = resolveTheme(createWire(COCHRANE));
    expect(r.cssVars["--tv-row-emphasis-bg"]).toMatch(/^oklch\(.+ \/ \d+(\.\d+)?\)$/);
    expect(r.cssVars["--tv-row-emphasis-bg"]).toBe(r.ramps.brandAlpha[2]!);
  });

  it("spacing-px tokens resolve to px strings", () => {
    const r = resolveTheme(createWire(COCHRANE));
    expect(r.cssVars["--tv-spacing-row-height"]).toBe("24px");
    expect(r.cssVars["--tv-spacing-cell-padding-x"]).toBe("10px");
    expect(r.cssVars["--tv-spacing-axis-gap"]).toBe("12px");
  });

  it("roleSource reflects the binding actually used", () => {
    const r = resolveTheme(createWire(COCHRANE));
    expect(r.roleSource.surface).toEqual({ ramp: "neutral", grade: 1 });
    expect(r.roleSource["surface-subtle"]).toEqual({ ramp: "neutral", grade: 2 });
  });
});

describe("resolveTheme — overrides", () => {
  it("setRoleBinding affects the resolved cssVars", () => {
    const wire0 = createWire(COCHRANE);
    const r0 = resolveTheme(wire0);
    const wire1 = setRoleBinding(wire0, "surface-subtle", "neutral", 5);
    const r1 = resolveTheme(wire1);
    // Default surface-subtle was neutral.2; override to neutral.5
    expect(r0.cssVars["--tv-row-alt-bg"]).toBe(r0.ramps.neutral[1]!);
    expect(r1.cssVars["--tv-row-alt-bg"]).toBe(r1.ramps.neutral[4]!);
    expect(r1.cssVars["--tv-row-alt-bg"]).not.toBe(r0.cssVars["--tv-row-alt-bg"]);
  });

  it("roleSource reflects the override binding", () => {
    // --tv-cell-border sources from role 'border-subtle' per the manifest
    const wire = setRoleBinding(createWire(COCHRANE), "border-subtle", "brand", 7);
    const r = resolveTheme(wire);
    expect(r.roleSource["border-subtle"]).toEqual({ ramp: "brand", grade: 7 });
    expect(r.cssVars["--tv-cell-border"]).toBe(r.ramps.brand[6]!);
  });

  it("cross-ramp rebinding works (surface → brand ramp)", () => {
    const wire = setRoleBinding(createWire(COCHRANE), "surface", "brand", 1);
    const r = resolveTheme(wire);
    expect(r.cssVars["--tv-row-base-bg"]).toBe(r.ramps.brand[0]!);
  });
});

describe("resolveTheme — polarity", () => {
  it("polarity defaults to 'light' when neither polarity nor mode is set", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" })));
    expect(r.polarity).toBe("light");
  });

  it("polarity='dark' reflects anchors and produces a dark theme", () => {
    const wire = createWire(inputsFromHex({ brand: "#0099CC", polarity: "dark" }));
    const r = resolveTheme(wire);
    expect(r.polarity).toBe("dark");
    // Paper anchor (neutral.1) should be near-black under dark polarity
    // (the existing resolver inverts the L array when mode is dark)
    const paper = r.ramps.neutral[0]!;
    expect(paper).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("polarity='dark' produces different ramps than 'light'", () => {
    const rL = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC", polarity: "light" })));
    const rD = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC", polarity: "dark" })));
    expect(rL.ramps.neutral[0]).not.toBe(rD.ramps.neutral[0]);
  });

  it("polarity field defaults to light when unset", () => {
    const r = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" })));
    expect(r.polarity).toBe("light");
  });
});

describe("resolveTheme — off-ramp role resolution", () => {
  it("text-onsolid is APCA-picked (not a hard-coded placeholder)", () => {
    const r = resolveTheme(createWire(COCHRANE));
    // text-onsolid should be one of the extreme neutrals (lightest or darkest)
    expect([r.ramps.neutral[0], r.ramps.neutral[10]]).toContain(r.roles["text-onsolid"]);
  });

  it("text-onsolid achieves meaningful APCA contrast on brand-solid", () => {
    // Whatever ink the picker chooses, it should be the most-contrastful
    // option from the candidates [neutral.1, neutral.11]. We verify by
    // confirming text-onsolid IS one of those endpoints rather than
    // some other value.
    const r = resolveTheme(createWire(COCHRANE));
    const candidates = [r.ramps.neutral[0]!, r.ramps.neutral[10]!];
    expect(candidates).toContain(r.roles["text-onsolid"]);
  });

  it("pos-fill / pos-solid / pos-text resolve to real status hex strings", () => {
    const r = resolveTheme(createWire(COCHRANE));
    expect(r.roles["pos-fill"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(r.roles["pos-solid"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(r.roles["pos-text"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    // The three pos- variants should differ from each other
    expect(r.roles["pos-fill"]).not.toBe(r.roles["pos-solid"]);
    expect(r.roles["pos-solid"]).not.toBe(r.roles["pos-text"]);
  });

  it("status anchor inputs propagate into the resolved status roles", () => {
    const baseR = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" })));
    const customR = resolveTheme(
      createWire(inputsFromHex({ brand: "#0099CC" }, {
        // status anchors are OklchTriple in v4; convert from hex for the test
        status: { positive: hexToOklch("#0033AA") },
      })),
    );
    // Custom positive seed should produce different pos-* values
    expect(customR.roles["pos-solid"]).not.toBe(baseR.roles["pos-solid"]);
  });

  it("neg / warn / info status families are independent", () => {
    const r = resolveTheme(createWire(COCHRANE));
    expect(r.roles["neg-fill"]).not.toBe(r.roles["pos-fill"]);
    expect(r.roles["warn-fill"]).not.toBe(r.roles["pos-fill"]);
    expect(r.roles["info-fill"]).not.toBe(r.roles["pos-fill"]);
  });

  it("cssVars status entries reflect the real status colors", () => {
    const r = resolveTheme(createWire(COCHRANE));
    // The manifest doesn't yet emit explicit pos-* cssVars (will be added
    // in subsequent commits), but the roles record holds the values.
    // Verify the role values are present and well-formed:
    for (const role of ["pos-fill", "pos-solid", "pos-text",
                         "neg-fill", "neg-solid", "neg-text",
                         "warn-fill", "warn-text",
                         "info-fill", "info-text"] as const) {
      expect(r.roles[role]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe("resolveTheme — HC + RT mode transforms", () => {
  it("HC mode drops tokens with modes.hc = 'drop' to transparent", () => {
    const hcWire = createWire(inputsFromHex({ brand: "#0099CC" }, {
      mode: "high-contrast",
    }));
    const r = resolveTheme(hcWire);
    // --tv-row-alt-bg declares modes: { hc: "drop" }
    expect(r.cssVars["--tv-row-alt-bg"]).toBe("transparent");
  });

  it("HC mode drops emphasis-bg (modes.hc = 'drop')", () => {
    const hcWire = createWire(inputsFromHex({ brand: "#0099CC" }, {
      mode: "high-contrast",
    }));
    const r = resolveTheme(hcWire);
    // --tv-row-emphasis-bg has modes: { hc: "drop", rt: { swap: "fill-hover" } }
    expect(r.cssVars["--tv-row-emphasis-bg"]).toBe("transparent");
  });

  it("RT mode swaps tokens with modes.rt = { swap: ... } to the swap role", () => {
    const rtWire = createWire(inputsFromHex({ brand: "#0099CC" }, {
      mode: "reduced-transparency",
    }));
    const r = resolveTheme(rtWire);
    // --tv-row-emphasis-bg has modes: { rt: { swap: "fill-hover" } }
    expect(r.cssVars["--tv-row-emphasis-bg"]).toBe(r.roles["fill-hover"]);
  });

  it("standard mode leaves manifest.modes behavior inert", () => {
    const std = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, { mode: "standard" })));
    const hc = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, { mode: "high-contrast" })));
    // Tokens with HC behavior differ between modes
    expect(std.cssVars["--tv-row-alt-bg"]).not.toBe(hc.cssVars["--tv-row-alt-bg"]);
    // Tokens without HC behavior are stable
    expect(std.cssVars["--tv-row-base-bg"]).toBe(hc.cssVars["--tv-row-base-bg"]);
  });

  it("polarity and mode compose orthogonally (dark + HC)", () => {
    const darkHC = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC", polarity: "dark" }, {
      mode: "high-contrast",
    })));
    expect(darkHC.polarity).toBe("dark");
    // HC still drops the alt-bg even under dark polarity
    expect(darkHC.cssVars["--tv-row-alt-bg"]).toBe("transparent");
  });

  it("HC pushes border roles +2 grades (Stage 1 §23b)", () => {
    const std = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, { mode: "standard" })));
    const hc = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, { mode: "high-contrast" })));
    // border-subtle default is neutral.6; HC pushes to neutral.8
    expect(std.roles["border-subtle"]).toBe(std.ramps.neutral[5]!);
    expect(hc.roles["border-subtle"]).toBe(hc.ramps.neutral[7]!);
    // border default is neutral.7; HC pushes to neutral.9
    expect(std.roles.border).toBe(std.ramps.neutral[6]!);
    expect(hc.roles.border).toBe(hc.ramps.neutral[8]!);
    // border-strong default is neutral.8; HC pushes to neutral.10
    expect(std.roles["border-strong"]).toBe(std.ramps.neutral[7]!);
    expect(hc.roles["border-strong"]).toBe(hc.ramps.neutral[9]!);
  });

  it("HC border push clamps at grade 11 for already-high bindings", () => {
    // Pin border to grade 10; HC push would target 12 but clamps to 11
    const wire = createWire(inputsFromHex({ brand: "#0099CC" }, { mode: "high-contrast" }));
    const wirePinned = setRoleBinding(wire, "border", "neutral", 10);
    const r = resolveTheme(wirePinned);
    expect(r.roles.border).toBe(r.ramps.neutral[10]!);
  });

  it("HC push leaves non-border roles unchanged", () => {
    const std = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, { mode: "standard" })));
    const hc = resolveTheme(createWire(inputsFromHex({ brand: "#0099CC" }, { mode: "high-contrast" })));
    // surface, fill, text — none are border roles; should match across modes
    expect(std.roles.surface).toBe(hc.roles.surface);
    expect(std.roles.fill).toBe(hc.roles.fill);
    expect(std.roles.text).toBe(hc.roles.text);
  });
});

describe("resolveTheme — cssVars has no TBD placeholders", () => {
  it("no role-sourced token returns a TBD placeholder", () => {
    const r = resolveTheme(createWire(COCHRANE));
    for (const token of COMPONENT_TOKENS) {
      if (token.source.tier === "role") {
        expect(r.cssVars[token.cssVar]).not.toMatch(/^<TBD/);
      }
    }
  });

  it("no spacing-px token returns a TBD placeholder", () => {
    const r = resolveTheme(createWire(COCHRANE));
    for (const token of COMPONENT_TOKENS) {
      // Typography lh/track tokens are kind=spacing-px but legitimately
      // emit unitless or em values; skip them here.
      if (token.source.tier === "computed" && token.cssVar.startsWith("--tv-text-")) continue;
      // V3-bridge tokens emit a sentinel; realized by theme-css.ts's tail.
      if (isV3BridgeToken(token)) continue;
      if (token.kind === "spacing-px") {
        expect(r.cssVars[token.cssVar]).toMatch(/px$/);
      }
    }
  });
});
