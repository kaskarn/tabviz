import { test, expect } from "bun:test";
import { trianglePoints, starPoints } from "./annotation-glyph";

// Golden pins — these strings are concatenated into SVG `points=` attributes on
// BOTH the DOM and export paths, so they must stay byte-identical (a WYSIWYG
// invariant). Captured against the pre-extraction inline math.
test("trianglePoints — apex-up, inscribed in ±sz", () => {
  expect(trianglePoints(100, 50, 5)).toBe("100,45 95,55 105,55");
});

test("starPoints — 10 vertices, outer 1.2·sz / inner 0.5·sz, apex up", () => {
  const s = starPoints(100, 50, 5);
  // 10 comma-separated "x,y" vertices
  expect(s.split(" ").length).toBe(10);
  // first vertex is the apex: cx + r·cos(π/2)=cx (cos≈0), cy − r·sin(π/2)=cy−1.2·sz
  expect(s.startsWith("100,44")).toBe(true); // cy − 6 = 44 (within float fmt)
});

test("starPoints is deterministic (identical across calls — the drift guard)", () => {
  expect(starPoints(12.5, 30, 4)).toBe(starPoints(12.5, 30, 4));
});
