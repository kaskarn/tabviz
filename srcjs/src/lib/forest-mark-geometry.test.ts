import { test, expect } from "bun:test";
import { summaryDiamondPoints, markerDiamondPoints, markerTrianglePoints } from "./forest-mark-geometry";

// Reproduce the export's prior inline math to prove byte-identical output.
function legacyExport(xL: number, xP: number, xU: number, y: number, hh: number, mn: number, mx: number, fx: number): string {
  const cl = (v: number) => fx + Math.max(mn, Math.min(mx, v));
  return `${cl(xL)},${y} ${cl(xP)},${y - hh} ${cl(xU)},${y} ${cl(xP)},${y + hh}`;
}

test("summaryDiamondPoints — byte-identical to the export's prior inline math", () => {
  const got = summaryDiamondPoints(40, 55, 70, 100, 5, 0, 120, 12);
  expect(got).toBe(legacyExport(40, 55, 70, 100, 5, 0, 120, 12));
  expect(got).toBe("52,100 67,95 82,100 67,105");
});

test("clamps ALL three positions (incl. the apex/point) to the visible range", () => {
  // point far right of range → apex pinned to clampMax, not allowed to escape
  const s = summaryDiamondPoints(10, 999, 999, 50, 5, 0, 100, 0);
  expect(s).toBe("10,50 100,45 100,50 100,55"); // xP and xU both clamped to 100
});

test("xOffset shifts every coordinate after clamping", () => {
  const a = summaryDiamondPoints(10, 20, 30, 0, 5, 0, 100, 0);
  const b = summaryDiamondPoints(10, 20, 30, 0, 5, 0, 100, 7);
  // b is a verbatim +7 shift of a's x-coords
  expect(b).toBe("17,0 27,-5 37,0 27,5");
  expect(a).toBe("10,0 20,-5 30,0 20,5");
});

test("markerDiamondPoints / markerTrianglePoints — byte-identical to inline math", () => {
  // these are byte-shared between export renderMarker + DOM RowInterval
  expect(markerDiamondPoints(50, 30, 4)).toBe("50,26 54,30 50,34 46,30");
  expect(markerTrianglePoints(50, 30, 4)).toBe("50,26 54,34 46,34");
});
