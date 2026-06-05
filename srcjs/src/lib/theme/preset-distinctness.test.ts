// Preset distinctness gate (wire-audit C39c / Pass 1e).
//
// The Round-3 design review found six presets had collapsed to
// near-identical achromatic anchors (jama ≡ brutalist byte-equal) and
// only 3 distinct row heights survived across 22 presets. This gate
// makes silent identity convergence a TEST FAILURE:
//
//   1. IDENTITY TUPLES — no two presets may share a near-identical
//      (brand, accent, ink2) anchor tuple. This is the gate that would
//      have caught jama ≡ brutalist at the moment of introduction.
//   2. ROW-HEIGHT SPREAD — ≥ 6 distinct resolved row heights across the
//      roster (density preset × density_factor identity pins).
//   3. RADIUS SPREAD — ≥ 3 distinct resolved --tv-radius-md values
//      (geometry as an identity dial, not a constant).
//   4. BRAND-HUE CROWDING — a RATCHET, not a target: no more than
//      MAX_HUE_CLUSTER chromatic brands within any 20° hue window.
//      Current reality is a 7-preset blue cluster (journals ARE blue);
//      the ceiling locks it from growing and can only shrink.

import { describe, it, expect } from "bun:test";
import { PRESETS } from "./theme-presets-inputs";
import { createWire } from "./theme-wire";
import { resolveTheme } from "./resolve-theme";
import type { OklchTriple } from "../../types/theme-inputs";

/** Perceptual-ish distance between two OKLCH triples. Hue weighted by
 *  mean chroma (hue is meaningless for achromatic colors). */
function dist(a: OklchTriple | undefined, b: OklchTriple | undefined): number {
  if (!a && !b) return 0;
  if (!a || !b) return Infinity; // one set, one absent = distinct
  const dL = a.L - b.L;
  const dC = a.C - b.C;
  const meanC = (a.C + b.C) / 2;
  let dH = Math.abs(a.H - b.H) % 360;
  if (dH > 180) dH = 360 - dH;
  const hTerm = meanC * (dH / 180) * 2; // chroma-weighted hue distance
  return Math.sqrt(dL * dL + dC * dC + hTerm * hTerm);
}

const TUPLE_MIN_DIST = 0.02; // jama≡brutalist was 0.0; post-C39a min observed ≫ this

describe("preset distinctness (C39c)", () => {
  const names = Object.keys(PRESETS);

  it("no two same-polarity presets share a near-identical (brand, accent, ink2) tuple", () => {
    // Polarity-pair siblings (solarized / solarized_dark) legitimately
    // share anchors — Schoonover's palette uses the same accents in both
    // modes and the resolver's L-reflection is the distinguishing axis.
    // Within ONE polarity, near-identical tuples are convergence bugs.
    const collisions: string[] = [];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const pa = PRESETS[names[i]!]!.polarity ?? "light";
        const pb = PRESETS[names[j]!]!.polarity ?? "light";
        if (pa !== pb) continue;
        const a = PRESETS[names[i]!]!.anchors;
        const b = PRESETS[names[j]!]!.anchors;
        const d =
          dist(a.brand, b.brand) +
          dist(a.accent, b.accent) +
          dist(a.ink2, b.ink2);
        if (d < TUPLE_MIN_DIST) {
          collisions.push(`${names[i]} ≈ ${names[j]} (d=${d.toFixed(4)})`);
        }
      }
    }
    expect(collisions).toEqual([]);
  });

  it("row heights spread across the roster (≥ 6 distinct)", () => {
    const heights = new Set<string>();
    for (const name of names) {
      const cssVars = resolveTheme(createWire(PRESETS[name]!, name)).cssVars;
      heights.add(cssVars["--tv-spacing-row-height"] ?? "?");
    }
    expect(heights.size).toBeGreaterThanOrEqual(6);
  });

  it("radius-md spreads across the roster (≥ 3 distinct)", () => {
    const radii = new Set<string>();
    for (const name of names) {
      const cssVars = resolveTheme(createWire(PRESETS[name]!, name)).cssVars;
      radii.add(cssVars["--tv-radius-md"] ?? "?");
    }
    expect(radii.size).toBeGreaterThanOrEqual(3);
  });

  it("brand-hue crowding ratchet: ≤ 7 chromatic brands per 20° window", () => {
    // RATCHET: 7 is today's blue-journal cluster. New presets must not
    // deepen it; shrink the ceiling as the spectrum spreads (C39b adds
    // ledger/terminal/aurora/blueprint/sunprint at distinct hues).
    const MAX_HUE_CLUSTER = 7;
    const hues = names
      .map((n) => PRESETS[n]!.anchors.brand)
      .filter((b) => b.C > 0.03)
      .map((b) => b.H);
    let worst = 0;
    for (const center of hues) {
      const inWindow = hues.filter((h) => {
        let d = Math.abs(h - center) % 360;
        if (d > 180) d = 360 - d;
        return d <= 10;
      }).length;
      worst = Math.max(worst, inWindow);
    }
    expect(worst).toBeLessThanOrEqual(MAX_HUE_CLUSTER);
  });
});
