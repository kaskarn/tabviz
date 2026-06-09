// Interval width-measurement parity (user feedback 2026-06-08, item 7).
// formatInterval (the WIDTH-measurement string) must mirror the variant
// recipe the cell renderer draws — the two diverged for plus_minus
// (renders half-width ±δ) and stacked (renders two lines), mis-sizing the
// column. This locks the measurement string per variant.
import { describe, it, expect } from "bun:test";
import { formatInterval } from "./formatters";

const base = { point: "p", lower: "lo", upper: "hi" } as const;
const opt = (variant?: string) => ({
  interval: { ...base, decimals: 2, ...(variant ? { variant } : {}) },
}) as never;

describe("formatInterval mirrors the renderer recipe per variant", () => {
  // point 0.85, lower 0.72, upper 0.99 → half-width 0.135 → 0.14
  it("traditional: point + (lo, hi)", () => {
    expect(formatInterval(0.85, 0.72, 0.99, opt("traditional"))).toBe("0.85 (0.72, 0.99)");
  });
  it("bracket_muted: point + [lo–hi]", () => {
    expect(formatInterval(0.85, 0.72, 0.99, opt("bracket_muted"))).toBe("0.85 [0.72–0.99]");
  });
  it("plus_minus: point + ± half-width (much shorter — was over-sized)", () => {
    const s = formatInterval(0.85, 0.72, 0.99, opt("plus_minus"));
    expect(s).toBe("0.85 ± 0.14");
    // the bug: it used to measure the full "(0.72, 0.99)" → too wide
    expect(s.length).toBeLessThan("0.85 (0.72, 0.99)".length);
  });
  it("stacked (column): width = the LONGER line, not the concatenation", () => {
    const s = formatInterval(0.85, 0.72, 0.99, opt("stacked"));
    // two lines: "0.85" and "(0.72, 0.99)" → the longer is the bounds line
    expect(s).toBe("(0.72, 0.99)");
    expect(s.length).toBeLessThan("0.85 (0.72, 0.99)".length); // not concatenated
  });
  it("falls back to point only when bounds are missing", () => {
    expect(formatInterval(0.85, undefined, undefined, opt())).toBe("0.85");
  });
});
