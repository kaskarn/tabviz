// Unit + invariant + fixture-matrix tests for the shared aspect ladder.
//
// Pure arithmetic — no theme resolver, no DOM. Snapshots lock the ladder
// outputs across aspect-direction × anchor × column-mix; explicit invariants
// guard the clamps/floors that make the reshape safe.

import { test, expect, describe } from "bun:test";
import {
  computeAspectLadder,
  resolveAspectTargets,
  minRowHeightFor,
  type AspectLadderInput,
} from "./aspect-ladder";
import { ASPECT } from "../rendering-constants";

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const roundResult = (r: ReturnType<typeof computeAspectLadder>) => ({
  flexWidth: round3(r.flexWidth),
  nonFlexScale: round3(r.nonFlexScale),
  rowHeightScale: round3(r.rowHeightScale),
  chromeScale: round3(r.chromeScale),
  widthResidual: round3(r.widthResidual),
});

// A natural baseline: 600×400 canvas, 200px flex (forest) region, 300px of
// non-flex auto columns, 320px of rows over 80px chrome (60px scalable).
const BASE: AspectLadderInput = {
  targetWidth: 600,
  targetHeight: 400,
  naturalWidth: 600,
  naturalHeight: 400,
  naturalFlexWidth: 200,
  naturalNonFlexAutoSum: 300,
  scalableChromeHeight: 60,
  naturalPlotHeight: 320,
  naturalChromeHeight: 80,
  naturalRowHeight: 32,
  flexCap: 2,
  minRowHeight: 24,
};

const FIXTURES: Record<string, AspectLadderInput> = {
  // Width grows: flex absorbs up to 2×, residual spills to non-flex.
  "grow-wide": { ...BASE, targetWidth: 900 },
  // Width grows past flex cap: flex saturates at 400, residual to non-flex.
  "grow-wide-saturate": { ...BASE, targetWidth: 1200 },
  // Width shrinks.
  "shrink-narrow": { ...BASE, targetWidth: 400 },
  // Height grows: chrome takes CHROME_SHARE, rows take the rest.
  "grow-tall": { ...BASE, targetHeight: 600 },
  // Height shrinks, rows above the floor.
  "shrink-short": { ...BASE, targetHeight: 300 },
  // Height shrinks hard: row floor saturates → chrome absorbs remainder.
  "shrink-short-floor": { ...BASE, targetHeight: 140 },
  // Forest-only: no non-flex auto columns → Lever 1B no-ops.
  "forest-only": { ...BASE, targetWidth: 900, naturalNonFlexAutoSum: 0 },
  // Pinned-only: no flex region → Lever 1A no-ops, all delta to 1B.
  "pinned-only": { ...BASE, targetWidth: 900, naturalFlexWidth: 0 },
  // Auto-wrap consumed the height delta → height scales stay 1.
  "height-consumed": { ...BASE, targetHeight: 600, heightDeltaConsumed: true },
};

describe("computeAspectLadder — fixture matrix", () => {
  for (const [name, input] of Object.entries(FIXTURES)) {
    test(name, () => {
      expect(roundResult(computeAspectLadder(input))).toMatchSnapshot();
    });
  }
});

describe("computeAspectLadder — invariants", () => {
  test("Lever 1A clamps flex width to [natural/cap, natural×cap]", () => {
    for (const input of Object.values(FIXTURES)) {
      const { flexWidth } = computeAspectLadder(input);
      if (input.naturalFlexWidth > 0 && input.flexCap > 1) {
        expect(flexWidth).toBeGreaterThanOrEqual(input.naturalFlexWidth / input.flexCap - 1e-6);
        expect(flexWidth).toBeLessThanOrEqual(input.naturalFlexWidth * input.flexCap + 1e-6);
      } else {
        expect(flexWidth).toBe(input.naturalFlexWidth);
      }
    }
  });

  test("nonFlexScale never collapses below the floor", () => {
    for (const input of Object.values(FIXTURES)) {
      const { nonFlexScale } = computeAspectLadder(input);
      expect(nonFlexScale).toBeGreaterThanOrEqual(ASPECT.NON_FOREST_SCALE_FLOOR - 1e-9);
    }
  });

  test("shrinking never pushes rows below minRowHeight", () => {
    const r = computeAspectLadder(FIXTURES["shrink-short-floor"]);
    expect(r.rowHeightScale * BASE.naturalRowHeight).toBeGreaterThanOrEqual(BASE.minRowHeight - 1e-6);
  });

  test("chromeScale floored when the row floor saturates", () => {
    const r = computeAspectLadder(FIXTURES["shrink-short-floor"]);
    expect(r.chromeScale).toBeGreaterThanOrEqual(ASPECT.CHROME_SCALE_FLOOR - 1e-9);
  });

  test("heightDeltaConsumed → height scales are exactly 1", () => {
    const r = computeAspectLadder(FIXTURES["height-consumed"]);
    expect(r.rowHeightScale).toBe(1);
    expect(r.chromeScale).toBe(1);
  });

  test("forest-only leaves nonFlexScale at 1 (no non-flex columns to scale)", () => {
    expect(computeAspectLadder(FIXTURES["forest-only"]).nonFlexScale).toBe(1);
  });

  test("pinned-only leaves flexWidth untouched (no flex region)", () => {
    const r = computeAspectLadder(FIXTURES["pinned-only"]);
    expect(r.flexWidth).toBe(0);
    expect(r.widthResidual).toBe(FIXTURES["pinned-only"].targetWidth - BASE.naturalWidth);
  });
});

describe("resolveAspectTargets", () => {
  // natural 600×400 → naturalAspect 1.5.
  test("width anchor pins width, derives height", () => {
    const r = resolveAspectTargets(600, 400, 2, "width");
    expect(r).toEqual({ targetWidth: 600, targetHeight: 300, resolvedAnchor: "width" });
  });

  test("height anchor pins height, derives width", () => {
    const r = resolveAspectTargets(600, 400, 2, "height");
    expect(r).toEqual({ targetWidth: 800, targetHeight: 400, resolvedAnchor: "height" });
  });

  test("auto picks height when target wider than natural", () => {
    expect(resolveAspectTargets(600, 400, 2.0, "auto").resolvedAnchor).toBe("height");
  });

  test("auto picks width when target narrower than natural", () => {
    expect(resolveAspectTargets(600, 400, 1.0, "auto").resolvedAnchor).toBe("width");
  });

  test("height anchor caps width at maxWidthMult × natural", () => {
    // ratio 100 would want 40000px; cap at 600×8 = 4800.
    const r = resolveAspectTargets(600, 400, 100, "height", 8);
    expect(r.targetWidth).toBe(4800);
  });
});

describe("minRowHeightFor", () => {
  test("floors at FLOOR for tiny fonts", () => {
    // round(8×1.4)+4 = 15 < 14? no, 15 ≥ 14 → 15. Use 6 to force the floor.
    expect(minRowHeightFor(6)).toBe(ASPECT.MIN_ROW_HEIGHT.FLOOR);
  });
  test("scales with font above the floor", () => {
    // round(14×1.4)+4 = round(19.6)+4 = 20+4 = 24.
    expect(minRowHeightFor(14)).toBe(24);
  });
});
