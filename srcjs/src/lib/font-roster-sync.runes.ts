/**
 * Roster-sync gate: every NAMED font a shipped preset uses as the PRIMARY
 * family of a font slot must be INDIVIDUALLY MEASURED in
 * `font-metrics.generated.ts` — not silently riding the serif/sans/mono
 * class fallback.
 *
 * Why this gate exists: the empirical estimator (the canvas-free V8/export
 * path — npm `./export`, MCP, hand-JSON) keys per-glyph advances on the
 * primary family name. A named face that ISN'T in the measured roster
 * resolves to Georgia / Helvetica / fixed-mono-advance instead of its own
 * metrics — graceful but SILENT. The measurement roster
 * (`scripts/measure-font-metrics.mjs`) is hand-maintained, so a new preset
 * font would drift out of coverage with no alarm. This test is that alarm.
 *
 * Vitest (not bun): the preset module pulls oklch → `@stdlib`, which bun's
 * runner can't resolve (see CLAUDE.md "Runner split").
 *
 * If this fails: add the offending face to the `FONTS` roster in
 * `scripts/measure-font-metrics.mjs`, run `npm run regen:font-metrics`
 * (needs network — Google Fonts), and commit the regenerated table. If the
 * face is intentionally generic, use a bare CSS keyword (serif / sans-serif
 * / monospace) as the primary instead of a named family.
 */
import { describe, it, expect } from "vitest";
import { PRESETS } from "./theme/theme-presets-inputs";
import { primaryFamily } from "./width-utils";
import { PROP_FONTS, MONO_ADVANCE_BY_FONT } from "./font-metrics.generated";

// CSS generic families legitimately ride the class fallback — they name a
// class, not a face, so there's nothing face-specific to measure.
const GENERIC_FAMILIES = new Set([
  "serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui",
  "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded", "math",
  "emoji", "fangsong", "inherit", "",
]);

const FONT_SLOTS = ["body", "display", "mono", "numeric"] as const;

function isMeasured(name: string): boolean {
  return name in PROP_FONTS || name in MONO_ADVANCE_BY_FONT;
}

describe("font-metrics roster sync", () => {
  it("every preset's primary font face is individually measured (no silent class-fallback drift)", () => {
    const drift: string[] = [];
    for (const [preset, inputs] of Object.entries(PRESETS)) {
      const fonts = inputs.fonts ?? {};
      for (const slot of FONT_SLOTS) {
        const stack = fonts[slot];
        if (!stack) continue;
        const primary = primaryFamily(stack);
        const key = primary.toLowerCase();
        if (GENERIC_FAMILIES.has(key)) continue;
        if (!isMeasured(primary)) {
          drift.push(`${preset}.fonts.${slot}: "${primary}" (from ${JSON.stringify(stack)})`);
        }
      }
    }
    expect(
      drift,
      `Preset primary fonts NOT in the measured roster (font-metrics.generated.ts) — ` +
        `they silently fall back to Georgia/Helvetica/mono-advance in the canvas-free ` +
        `export path. Add to scripts/measure-font-metrics.mjs + regen:\n  ${drift.join("\n  ")}`,
    ).toEqual([]);
  });

  it("the measured roster is non-empty (table actually shipped)", () => {
    expect(Object.keys(PROP_FONTS).length).toBeGreaterThan(0);
    expect(Object.keys(MONO_ADVANCE_BY_FONT).length).toBeGreaterThan(0);
  });
});
