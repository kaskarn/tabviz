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
    const unset = buildTheme({ ...PRESETS["cochrane"]! }, "a");
    const explicit = buildTheme(
      { ...PRESETS["cochrane"]!, slot_style: "fill_with_darker_stroke" },
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
    const t = buildTheme({ ...PRESETS["cochrane"]!, slot_style: "flat_fill" }, "f");
    for (const s of series(t)) {
      expect(s.stroke).toBe(s.fill);
      expect(s.strokeDim).toBe(s.fillDim);
      expect(s.strokeHot).toBe(s.fillHot);
    }
  });

  it("outlined pales the fill while the stroke keeps the anchor", () => {
    const ring = buildTheme({ ...PRESETS["cochrane"]! }, "r");
    const outlined = buildTheme({ ...PRESETS["cochrane"]!, slot_style: "outlined" }, "o");
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
        buildTheme({ ...PRESETS["cochrane"]!, slot_style: v }, v),
      )));
    expect(new Set(variants).size).toBe(3);
  });
});
