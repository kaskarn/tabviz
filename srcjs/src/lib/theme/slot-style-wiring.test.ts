// slot_style → series wiring regression gate (studio review C closure).
// The input was declared on ThemeInputs but the resolver never read it —
// the ONLY place it did anything was a private ~90-line reimplementation
// inside LayoutControl.svelte (settings panel), so R themes and the
// studio produced identical series regardless of slot_style. The
// derivation now lives in buildTheme's slotRole; this gate pins it.

import { describe, it, expect } from "bun:test";
import { buildTheme } from "./theme-adapter";
import { PRESETS } from "./theme-presets-inputs";
import type { SlotRole } from "../../types/theme-resolved";

const series = (t: unknown): SlotRole[] =>
  (t as { series: SlotRole[] }).series;

describe("slot_style → series slot wiring", () => {
  it("default (unset) equals fill_with_darker_stroke", () => {
    const unset = buildTheme({ ...PRESETS["nejm"]! }, "a");
    const explicit = buildTheme(
      { ...PRESETS["nejm"]!, slot_style: "fill_with_darker_stroke" },
      "b",
    );
    expect(series(unset)).toEqual(series(explicit));
    // Ring convention: stroke is a deepened anchor, distinct from fill
    // on slot 0 (an anchor already at the L floor — e.g. pure black —
    // can't darken further, so deeper slots may legitimately match).
    const s0 = series(unset)[0]!;
    expect(s0.stroke).not.toBe(s0.fill);
  });

  it("flat_fill makes stroke ≡ fill on every slot", () => {
    const t = buildTheme({ ...PRESETS["nejm"]!, slot_style: "flat_fill" }, "f");
    for (const s of series(t)) {
      expect(s.stroke).toBe(s.fill);
      expect(s.strokeDim).toBe(s.fillDim);
      expect(s.strokeHot).toBe(s.fillHot);
    }
  });

  it("outlined pales the fill while the stroke keeps the anchor", () => {
    const ring = buildTheme({ ...PRESETS["nejm"]! }, "r");
    const outlined = buildTheme({ ...PRESETS["nejm"]!, slot_style: "outlined" }, "o");
    const rs = series(ring);
    const os = series(outlined);
    for (let i = 0; i < os.length; i++) {
      // Outlined stroke = the anchor itself = the ring convention's fill.
      expect(os[i]!.stroke).toBe(rs[i]!.fill);
      // Fill is paper-mixed — must differ from the solid anchor fill.
      expect(os[i]!.fill).not.toBe(rs[i]!.fill);
    }
  });

  it("the three conventions are pairwise distinct", () => {
    const variants = (["fill_with_darker_stroke", "flat_fill", "outlined"] as const)
      .map((v) => JSON.stringify(series(
        buildTheme({ ...PRESETS["nejm"]!, slot_style: v }, v),
      )));
    expect(new Set(variants).size).toBe(3);
  });
});

describe("series_overrides (Phase 4 / L3 freeform escape hatch)", () => {
  it("overlays fill + re-derives dim/hot; other slots untouched", () => {
    const base = series(buildTheme({ ...PRESETS["nejm"]! }, "base"));
    const t = buildTheme(
      { ...PRESETS["nejm"]!, series_overrides: [{ fill: "#ff0000" }] },
      "ov",
    );
    const s = series(t);
    expect(s[0]!.fill).toBe("#ff0000");
    // dim/hot re-derived from the new fill (not equal to base, not equal
    // to the raw override).
    expect(s[0]!.fillDim).not.toBe(base[0]!.fillDim);
    expect(s[0]!.fillDim).not.toBe("#ff0000");
    // slot 1 is untouched by a slot-0 override.
    expect(s[1]).toEqual(base[1]);
  });

  it("overlays stroke and shape independently", () => {
    const t = buildTheme(
      { ...PRESETS["nejm"]!, series_overrides: [null, { stroke: "#00aa00", shape: "diamond" }] },
      "ov2",
    );
    const s = series(t);
    expect(s[1]!.stroke).toBe("#00aa00");
    expect(s[1]!.shape).toBe("diamond");
  });

  it("drops an invalid hex defensively (no NaN poisoning)", () => {
    const t = buildTheme(
      { ...PRESETS["nejm"]!, series_overrides: [{ fill: "not-a-hex" }] },
      "ov3",
    );
    const base = series(buildTheme({ ...PRESETS["nejm"]! }, "base3"));
    // Invalid fill ignored → slot 0 equals the un-overridden bundle.
    expect(series(t)[0]).toEqual(base[0]);
  });
});
