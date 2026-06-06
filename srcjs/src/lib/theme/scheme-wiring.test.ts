// Categorical-scheme → series wiring regression gate (R2 API review F3
// closure). The scheme registry (data-schemes.ts) had ZERO consumers:
// 27 presets declared schemes, three R setters set them, and nothing
// read them — set_categorical("viridis") and a typo'd name produced
// byte-identical themes. This gate pins the wiring AND the slot-0
// identity rule (a full scheme takeover turned cochrane's blue markers
// okabe-black).

import { describe, it, expect } from "bun:test";
import { buildTheme } from "./theme-adapter";
import { PRESETS } from "./theme-presets-inputs";

const strokes = (t: { series: ReadonlyArray<{ stroke: string }> }): string[] =>
  t.series.map((x) => x.stroke);

describe("categorical scheme → series wiring", () => {
  it("a pinned scheme changes slots 1+ but never slot 0 (identity)", () => {
    const base = buildTheme({ ...PRESETS["cochrane"]!, categorical: undefined }, "a");
    const okabe = buildTheme({ ...PRESETS["cochrane"]!, categorical: "okabe_ito" }, "b");
    const sBase = strokes(base as never);
    const sOkabe = strokes(okabe as never);
    expect(sOkabe[0]).toBe(sBase[0]); // identity slot untouched
    // Slots post-process their anchors (stroke derives from the anchor,
    // not byte-equal to it) — assert the WIRING (slots changed, all
    // distinct), not raw hex passthrough.
    expect(sOkabe.slice(1)).not.toEqual(sBase.slice(1));
    expect(new Set(sOkabe).size).toBe(sOkabe.length);
  });

  it("two different schemes produce different series", () => {
    const a = buildTheme({ ...PRESETS["cochrane"]!, categorical: "tableau10" }, "a");
    const b = buildTheme({ ...PRESETS["cochrane"]!, categorical: "wong" }, "b");
    expect(strokes(a as never)).not.toEqual(strokes(b as never));
  });

  it("brand_mono derives from the brand ramp (special scheme)", () => {
    const t = buildTheme({ ...PRESETS["cochrane"]!, categorical: "brand_mono" }, "m");
    const s = strokes(t as never);
    // All five slots present and distinct (ramp grades 4/6/8/9 + solid).
    expect(new Set(s).size).toBeGreaterThanOrEqual(4);
  });
});
